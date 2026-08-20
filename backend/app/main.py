import base64
import hashlib
import hmac
import json
import os
import random
import re
import secrets
import sqlite3
import time
from pathlib import Path
from typing import Any, Literal
from urllib.parse import quote, urljoin, urlparse

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

PURSTREAM_URL = os.getenv(
    "PURSTREAM_URL", "https://api.purstream.art/api/v1/catalog/movies"
)
TIMEOUT_SECONDS = float(os.getenv("UPSTREAM_TIMEOUT", "20"))
AUTH_SECRET = os.getenv("AUTH_SECRET", "change-this-development-secret")
DB_PATH = Path(os.getenv("DATABASE_PATH", Path(__file__).resolve().parent.parent / "alocine.db"))

app = FastAPI(title="Alocine API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)


class AuthRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    name: str | None = Field(default=None, max_length=80)


class ProgressRequest(BaseModel):
    profile_id: int
    media_id: int
    season: int = Field(default=1, ge=1)
    episode: int = Field(default=1, ge=1)
    position: float = Field(default=0, ge=0)
    duration: float = Field(default=0, ge=0)
    title: str = Field(default="", max_length=250)
    episode_title: str = Field(default="", max_length=250)
    poster: str = Field(default="", max_length=2000)
    completed: bool = False
    skipped_auto: bool = False


class ProfileRequest(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    avatar: int = Field(default=0, ge=0, le=5)
    language: Literal["fr", "vo"] = "fr"
    auto_next_seconds: int = Field(default=10, ge=0, le=900)


class SeriesSettingRequest(BaseModel):
    profile_id: int
    trigger_seconds: int = Field(default=10, ge=0, le=900)


def db() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    with db() as connection:
        connection.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS progress (
            user_id INTEGER NOT NULL,
            media_id INTEGER NOT NULL,
            season INTEGER NOT NULL,
            episode INTEGER NOT NULL,
            position REAL NOT NULL DEFAULT 0,
            duration REAL NOT NULL DEFAULT 0,
            title TEXT NOT NULL DEFAULT '',
            episode_title TEXT NOT NULL DEFAULT '',
            poster TEXT NOT NULL DEFAULT '',
            updated_at INTEGER NOT NULL,
            PRIMARY KEY (user_id, media_id, season, episode),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            avatar INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS profile_progress (
            profile_id INTEGER NOT NULL,
            media_id INTEGER NOT NULL,
            season INTEGER NOT NULL,
            episode INTEGER NOT NULL,
            position REAL NOT NULL DEFAULT 0,
            duration REAL NOT NULL DEFAULT 0,
            title TEXT NOT NULL DEFAULT '',
            episode_title TEXT NOT NULL DEFAULT '',
            poster TEXT NOT NULL DEFAULT '',
            updated_at INTEGER NOT NULL,
            PRIMARY KEY (profile_id, media_id, season, episode),
            FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS series_settings (
            profile_id INTEGER NOT NULL,
            media_id INTEGER NOT NULL,
            trigger_seconds INTEGER NOT NULL DEFAULT 10,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY (profile_id, media_id),
            FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
        );
        """)
        columns = {row[1] for row in connection.execute("PRAGMA table_info(profiles)").fetchall()}
        if "language" not in columns:
            connection.execute("ALTER TABLE profiles ADD COLUMN language TEXT NOT NULL DEFAULT 'fr'")
        if "auto_next_seconds" not in columns:
            connection.execute("ALTER TABLE profiles ADD COLUMN auto_next_seconds INTEGER NOT NULL DEFAULT 10")
        progress_columns = {row[1] for row in connection.execute("PRAGMA table_info(profile_progress)").fetchall()}
        if "completed" not in progress_columns:
            connection.execute("ALTER TABLE profile_progress ADD COLUMN completed INTEGER NOT NULL DEFAULT 0")
        if "skipped_auto" not in progress_columns:
            connection.execute("ALTER TABLE profile_progress ADD COLUMN skipped_auto INTEGER NOT NULL DEFAULT 0")


init_db()


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310_000)
    return f"{base64.urlsafe_b64encode(salt).decode()}:{base64.urlsafe_b64encode(digest).decode()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_value, digest_value = stored.split(":", 1)
        candidate = hash_password(password, base64.urlsafe_b64decode(salt_value))
        return hmac.compare_digest(candidate.split(":", 1)[1], digest_value)
    except (ValueError, TypeError):
        return False


def create_token(user_id: int) -> str:
    payload = base64.urlsafe_b64encode(json.dumps({"sub": user_id, "exp": int(time.time()) + 2_592_000}, separators=(",", ":")).encode()).decode().rstrip("=")
    signature = base64.urlsafe_b64encode(hmac.new(AUTH_SECRET.encode(), payload.encode(), hashlib.sha256).digest()).decode().rstrip("=")
    return f"{payload}.{signature}"


def current_user(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentification requise")
    try:
        payload, signature = authorization[7:].split(".", 1)
        expected = base64.urlsafe_b64encode(hmac.new(AUTH_SECRET.encode(), payload.encode(), hashlib.sha256).digest()).decode().rstrip("=")
        if not hmac.compare_digest(signature, expected):
            raise ValueError
        decoded = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        if int(decoded["exp"]) < time.time():
            raise ValueError
        with db() as connection:
            row = connection.execute("SELECT id,email,name FROM users WHERE id=?", (int(decoded["sub"]),)).fetchone()
        if not row:
            raise ValueError
        return dict(row)
    except (ValueError, KeyError, TypeError, json.JSONDecodeError):
        raise HTTPException(status_code=401, detail="Session invalide")


async def fetch_catalog(
    media_type: Literal["tv", "movie"],
    *,
    search: str = "",
    sort_by: str = "best-rated",
    per_page: int = 40,
    page: int = 1,
    category_ids: list[int] | None = None,
) -> list[dict[str, Any]]:
    params = {
        "search": search,
        "page": page,
        "sortBy": sort_by,
        "types": media_type,
        "categoriesIds": "*" if not category_ids else category_ids[0],
        "franchisesIds": "*",
        "displayMode": "large",
        "perPage": per_page,
    }
    if category_ids and len(category_ids) > 1:
        params.pop("categoriesIds", None)
        params["categoriesIds[]"] = category_ids
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            response = await client.get(PURSTREAM_URL, params=params)
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="Le catalogue distant est indisponible") from exc

    items = payload.get("data", {}).get("items", {}).get("data", [])
    return [{**item, "type": media_type} for item in items if isinstance(item, dict)]


async def fetch_media(path: str) -> dict[str, Any]:
    base_url = PURSTREAM_URL.split("/catalog/movies", 1)[0]
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            response = await client.get(f"{base_url}{path}")
            response.raise_for_status()
            return response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="Le média distant est indisponible") from exc


@app.get("/api/hls/master.m3u8")
async def localized_hls_master(url: str = Query(..., max_length=2000), lang: Literal["fr", "vo"] = "fr") -> Response:
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname or not (parsed.hostname == "finepulfe.xyz" or parsed.hostname.endswith(".finepulfe.xyz")):
        raise HTTPException(status_code=400, detail="Source HLS non autorisée")
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS, follow_redirects=True) as client:
            upstream = await client.get(url)
            upstream.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Manifeste HLS indisponible") from exc
    lines = upstream.text.splitlines()
    audio_lines = [line for line in lines if line.startswith("#EXT-X-MEDIA:") and "TYPE=AUDIO" in line.upper()]
    wanted = re.compile(r'LANGUAGE="?(en|eng)"?|NAME="?English', re.I) if lang == "vo" else re.compile(r'LANGUAGE="?(fr|fre|fra)"?|NAME="?Fran', re.I)
    selected = next((line for line in audio_lines if wanted.search(line)), None)
    if not selected:
        raise HTTPException(status_code=404, detail="Piste audio demandée indisponible")
    rewritten: list[str] = []
    for line in lines:
        if line in audio_lines and line != selected:
            continue
        if line == selected:
            line = re.sub(r"DEFAULT=(YES|NO)", "DEFAULT=YES", line, flags=re.I)
            line = re.sub(r"AUTOSELECT=(YES|NO)", "AUTOSELECT=YES", line, flags=re.I)
        line = re.sub(r'URI="([^"]+)"', lambda match: f'URI="{urljoin(url, match.group(1))}"', line)
        if line.strip() and not line.lstrip().startswith("#"):
            line = urljoin(url, line.strip())
        rewritten.append(line)
    return Response("\n".join(rewritten) + "\n", media_type="application/vnd.apple.mpegurl", headers={"Cache-Control": "no-store"})


@app.post("/api/auth/register")
async def register(body: AuthRequest) -> dict[str, Any]:
    email = body.email.strip().casefold()
    if "@" not in email:
        raise HTTPException(status_code=422, detail="Adresse email invalide")
    name = (body.name or email.split("@", 1)[0]).strip() or "Utilisateur"
    try:
        with db() as connection:
            cursor = connection.execute("INSERT INTO users(email,name,password_hash,created_at) VALUES(?,?,?,?)", (email, name, hash_password(body.password), int(time.time())))
            user_id = int(cursor.lastrowid)
            connection.execute("INSERT INTO profiles(user_id,name,avatar,created_at) VALUES(?,?,?,?)", (user_id, name, 0, int(time.time())))
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Un compte existe déjà avec cet email")
    return {"token": create_token(user_id), "user": {"id": user_id, "email": email, "name": name}}


@app.post("/api/auth/login")
async def login(body: AuthRequest) -> dict[str, Any]:
    with db() as connection:
        row = connection.execute("SELECT id,email,name,password_hash FROM users WHERE email=?", (body.email.strip().casefold(),)).fetchone()
    if not row or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    user = {"id": row["id"], "email": row["email"], "name": row["name"]}
    return {"token": create_token(row["id"]), "user": user}


@app.get("/api/auth/me")
async def me(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    return {"user": user}


@app.get("/api/profiles")
async def profiles(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    with db() as connection:
        rows = connection.execute("SELECT id,name,avatar,language,auto_next_seconds FROM profiles WHERE user_id=? ORDER BY id", (user["id"],)).fetchall()
        if not rows:
            connection.execute("INSERT INTO profiles(user_id,name,avatar,created_at) VALUES(?,?,?,?)", (user["id"], user["name"], 0, int(time.time())))
            rows = connection.execute("SELECT id,name,avatar,language,auto_next_seconds FROM profiles WHERE user_id=? ORDER BY id", (user["id"],)).fetchall()
    return {"items": [dict(row) for row in rows]}


@app.post("/api/profiles")
async def create_profile(body: ProfileRequest, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    with db() as connection:
        count = connection.execute("SELECT COUNT(*) FROM profiles WHERE user_id=?", (user["id"],)).fetchone()[0]
        if count >= 5:
            raise HTTPException(status_code=409, detail="Vous pouvez créer au maximum 5 profils")
        cursor = connection.execute("INSERT INTO profiles(user_id,name,avatar,language,auto_next_seconds,created_at) VALUES(?,?,?,?,?,?)", (user["id"], body.name.strip(), body.avatar, body.language, body.auto_next_seconds, int(time.time())))
        profile_id = int(cursor.lastrowid)
    return {"profile": {"id": profile_id, "name": body.name.strip(), "avatar": body.avatar, "language": body.language, "auto_next_seconds": body.auto_next_seconds}}


@app.put("/api/profiles/{profile_id}")
async def update_profile(profile_id: int, body: ProfileRequest, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    with db() as connection:
        cursor = connection.execute("UPDATE profiles SET name=?,avatar=?,language=?,auto_next_seconds=? WHERE id=? AND user_id=?", (body.name.strip(), body.avatar, body.language, body.auto_next_seconds, profile_id, user["id"]))
        if not cursor.rowcount:
            raise HTTPException(status_code=404, detail="Profil introuvable")
    return {"profile": {"id": profile_id, "name": body.name.strip(), "avatar": body.avatar, "language": body.language, "auto_next_seconds": body.auto_next_seconds}}


@app.put("/api/progress")
async def save_progress(body: ProgressRequest, user: dict[str, Any] = Depends(current_user)) -> dict[str, str]:
    with db() as connection:
        owns = connection.execute("SELECT 1 FROM profiles WHERE id=? AND user_id=?", (body.profile_id, user["id"])).fetchone()
        if not owns:
            raise HTTPException(status_code=403, detail="Profil invalide")
        connection.execute("""INSERT INTO profile_progress(profile_id,media_id,season,episode,position,duration,title,episode_title,poster,updated_at,completed,skipped_auto)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(profile_id,media_id,season,episode) DO UPDATE SET
            position=excluded.position,duration=excluded.duration,title=excluded.title,episode_title=excluded.episode_title,poster=excluded.poster,updated_at=excluded.updated_at,
            completed=MAX(profile_progress.completed,excluded.completed),skipped_auto=MAX(profile_progress.skipped_auto,excluded.skipped_auto)""",
            (body.profile_id, body.media_id, body.season, body.episode, body.position, body.duration, body.title, body.episode_title, body.poster, int(time.time()), int(body.completed), int(body.skipped_auto)))
    return {"status": "saved"}


@app.get("/api/series-settings/{media_id}")
async def get_series_setting(media_id: int, profile_id: int = Query(...), user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    with db() as connection:
        owns = connection.execute("SELECT 1 FROM profiles WHERE id=? AND user_id=?", (profile_id, user["id"])).fetchone()
        if not owns:
            raise HTTPException(status_code=403, detail="Profil invalide")
        row = connection.execute("SELECT trigger_seconds FROM series_settings WHERE profile_id=? AND media_id=?", (profile_id, media_id)).fetchone()
        profile_row = connection.execute("SELECT auto_next_seconds FROM profiles WHERE id=?", (profile_id,)).fetchone()
    return {"trigger_seconds": int(row["trigger_seconds"]) if row else int(profile_row["auto_next_seconds"]), "is_override": bool(row)}


@app.put("/api/series-settings/{media_id}")
async def save_series_setting(media_id: int, body: SeriesSettingRequest, user: dict[str, Any] = Depends(current_user)) -> dict[str, int]:
    with db() as connection:
        owns = connection.execute("SELECT 1 FROM profiles WHERE id=? AND user_id=?", (body.profile_id, user["id"])).fetchone()
        if not owns:
            raise HTTPException(status_code=403, detail="Profil invalide")
        connection.execute("""INSERT INTO series_settings(profile_id,media_id,trigger_seconds,updated_at) VALUES(?,?,?,?)
            ON CONFLICT(profile_id,media_id) DO UPDATE SET trigger_seconds=excluded.trigger_seconds,updated_at=excluded.updated_at""",
            (body.profile_id, media_id, body.trigger_seconds, int(time.time())))
    return {"trigger_seconds": body.trigger_seconds}


@app.get("/api/progress")
async def history(profile_id: int = Query(...), user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    with db() as connection:
        owns = connection.execute("SELECT 1 FROM profiles WHERE id=? AND user_id=?", (profile_id, user["id"])).fetchone()
        if not owns: raise HTTPException(status_code=403, detail="Profil invalide")
        rows = connection.execute("""SELECT p.* FROM profile_progress p JOIN
            (SELECT media_id,MAX(updated_at) updated_at FROM profile_progress WHERE profile_id=? GROUP BY media_id) latest
            ON latest.media_id=p.media_id AND latest.updated_at=p.updated_at
            WHERE p.profile_id=? ORDER BY p.updated_at DESC LIMIT 100""", (profile_id, profile_id)).fetchall()
    return {"items": [dict(row) for row in rows]}


@app.get("/api/progress/media/{media_id}")
async def media_progress(media_id: int, profile_id: int = Query(...), user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    with db() as connection:
        owns = connection.execute("SELECT 1 FROM profiles WHERE id=? AND user_id=?", (profile_id, user["id"])).fetchone()
        if not owns: raise HTTPException(status_code=403, detail="Profil invalide")
        row = connection.execute("SELECT * FROM profile_progress WHERE profile_id=? AND media_id=? ORDER BY updated_at DESC LIMIT 1", (profile_id, media_id)).fetchone()
    return {"item": dict(row) if row else None}


@app.get("/api/progress/media/{media_id}/episodes")
async def episode_progress(media_id: int, profile_id: int = Query(...), season: int = Query(1, ge=1), user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    with db() as connection:
        owns = connection.execute("SELECT 1 FROM profiles WHERE id=? AND user_id=?", (profile_id, user["id"])).fetchone()
        if not owns:
            raise HTTPException(status_code=403, detail="Profil invalide")
        rows = connection.execute("SELECT episode,position,duration,completed,skipped_auto,updated_at FROM profile_progress WHERE profile_id=? AND media_id=? AND season=? ORDER BY episode", (profile_id, media_id, season)).fetchall()
    return {"items": [dict(row) for row in rows]}


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/home")
async def home() -> dict[str, Any]:
    featured_series = await fetch_catalog("tv", sort_by="newest", per_page=20)
    featured_movies = await fetch_catalog("movie", sort_by="newest", per_page=20)
    series = await fetch_catalog("tv", per_page=200)
    movies = await fetch_catalog("movie", per_page=200)
    featured = featured_series + featured_movies
    return {
        "hero": random.choice(featured) if featured else None,
        "featuredSeries": featured_series,
        "featuredMovies": featured_movies,
        "series": series,
        "movies": movies,
    }


@app.get("/api/catalog")
async def catalog(
    media_type: Literal["tv", "movie"] = Query("tv", alias="type"),
    search: str = Query("", max_length=100),
    sort_by: Literal["newest", "best-rated"] = Query("best-rated", alias="sortBy"),
    page: int = Query(1, ge=1),
    per_page: int = Query(40, alias="perPage", ge=1, le=200),
    categories: str = Query("", max_length=300),
) -> dict[str, Any]:
    category_ids = [int(value) for value in categories.split(",") if value.strip().isdigit()]
    items = await fetch_catalog(
        media_type,
        search=search.strip(),
        sort_by=sort_by,
        page=page,
        per_page=per_page,
        category_ids=category_ids,
    )
    return {"items": items, "page": page, "type": media_type}


@app.get("/api/categories")
async def categories() -> dict[str, Any]:
    base_url = PURSTREAM_URL.split("/catalog/movies", 1)[0]
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            response = await client.get(f"{base_url}/catalog/categories")
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="Les catégories sont indisponibles") from exc
    data = payload.get("data", payload) if isinstance(payload, dict) else payload
    if isinstance(data, dict):
        items = data.get("items", data.get("data", data.get("categories", [])))
    else:
        items = data
    if isinstance(items, dict):
        items = list(items.values())
    return {"items": items if isinstance(items, list) else []}


@app.get("/api/search")
async def search(q: str = Query(..., min_length=2, max_length=100)) -> dict[str, Any]:
    query = q.strip()
    base_url = PURSTREAM_URL.split("/catalog/movies", 1)[0]
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            response = await client.get(
                f"{base_url}/search-bar/search/{quote(query, safe='')}"
            )
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="La recherche distante est indisponible") from exc

    raw_items = (
        payload.get("data", {})
        .get("items", {})
        .get("movies", {})
        .get("items", [])
    )
    needle = query.casefold()

    def relevance(item: dict[str, Any]) -> tuple[int, int, str]:
        item_title = str(item.get("title") or "").casefold()
        rank = 0 if item_title == needle else 1 if item_title.startswith(needle) else 2
        return rank, item_title.find(needle) if needle in item_title else 9999, item_title

    items = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        release_date = str(item.get("release_date") or "")
        items.append(
            {
                **item,
                "poster_path": item.get("large_poster_path"),
                "backdrop_path": item.get("small_poster_path"),
                "year": release_date[:4] if release_date else None,
            }
        )
    items.sort(key=relevance)
    return {"items": items, "count": len(items), "query": query}


@app.get("/api/media/{media_id}")
async def media_detail(
    media_id: int,
    season: int = Query(1, ge=1),
    lang: Literal["fr", "vo"] = "fr",
) -> dict[str, Any]:
    sheet_payload = await fetch_media(f"/media/{media_id}/sheet")
    media = sheet_payload.get("data", {}).get("items") or {}
    if not media:
        raise HTTPException(status_code=404, detail="Média introuvable")

    is_series = media.get("type") == "tv"
    episodes: list[dict[str, Any]] = []
    if is_series:
        season_payload = await fetch_media(f"/media/{media_id}/season/{season}")
        episodes = season_payload.get("data", {}).get("items", {}).get("episodes", [])

    streams: dict[str, Any] = {"fr": {}, "vo": {}}
    for item in media.get("urls", []):
        language = "fr" if "VF" in str(item.get("name", "")).upper() else "vo"
        if is_series:
            match = re.search(r"S(\d+)/E(\d+)", str(item.get("url", "")))
            if match:
                # Expose stable, unpadded keys ("1" instead of "01") so the
                # frontend can address a season/episode using their numeric ids.
                season_key = str(int(match.group(1)))
                episode_key = str(int(match.group(2)))
                streams[language].setdefault(season_key, {})[episode_key] = item
        else:
            streams[language].setdefault("movie", []).append(item)

    return {"media": media, "episodes": episodes, "streams": streams, "season": season, "language": lang, "isSeries": is_series}
