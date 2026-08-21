import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  History,
  Home,
  Eye,
  EyeOff,
  Info,
  Maximize,
  Minimize,
  Play,
  Plus,
  Search,
  Settings,
  Send,
  Sparkles,
  Star,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import Hls from "hls.js";
import "./styles.css";
import "./detail.css";
import "./player.css";
import "./responsive.css";
import "./auth.css";
import "./profiles.css";
import "./profile-settings.css";
import "./next-episode.css";
import "./auto-next-profile.css";
import "./detail-navigation.css";
import "./avatar-fix.css";
import "./profile-menu-polish.css";
import "./mobile-player.css";
import "./custom-fullscreen.css";
import "./smooth-loader.css";
import "./player-auto-hide.css";
import "./modal-fullscreen.css";
import "./episode-progress.css";
import "./player-close-fix.css";
import "./history-mobile.css";
import "./series-slider.css";
import "./explore.css";
import "./access-control.css";
import "./friends.css";

const API = import.meta.env.VITE_API_URL ?? "";
const PURSTREAM_API =
  import.meta.env.VITE_PURSTREAM_API || "https://api.purstream.store/api/v1";
const HLS_PROXY_URL = String(import.meta.env.VITE_HLS_PROXY_URL || "").replace(
  /\/+$/,
  "",
);
const hlsUrl = (url) => {
  if (!HLS_PROXY_URL) return url;
  try {
    const target = new URL(url);
    if (target.hostname !== "free.finepulfe.xyz") return url;
    return `${HLS_PROXY_URL}?url=${encodeURIComponent(target.href)}`;
  } catch {
    return url;
  }
};
const publicJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`Purstream HTTP ${response.status}`);
  return response.json();
};
const publicCatalog = async ({
  type = "tv",
  sort = "best-rated",
  page = 1,
  perPage = 40,
  category = "all",
  signal,
} = {}) => {
  const params = new URLSearchParams({
      search: "",
      page: String(page),
      sortBy: sort,
      types: type,
      categoriesIds: category === "all" ? "*" : String(category),
      franchisesIds: "*",
      displayMode: "large",
      perPage: String(perPage),
    }),
    payload = await publicJson(`${PURSTREAM_API}/catalog/movies?${params}`, {
      signal,
    }),
    raw = payload?.data?.items?.data || [];
  return raw
    .filter((item) => item && typeof item === "object")
    .map((item) => ({ ...item, type }));
};
const publicCategories = async () => {
  const payload = await publicJson(`${PURSTREAM_API}/catalog/categories`),
    data = payload?.data ?? payload,
    raw = data?.items ?? data?.data ?? data?.categories ?? data;
  return Array.isArray(raw) ? raw : Object.values(raw || {});
};
const publicSearch = async (query, signal) => {
  const payload = await publicJson(
      `${PURSTREAM_API}/search-bar/search/${encodeURIComponent(query)}`,
      { signal },
    ),
    raw = payload?.data?.items?.movies?.items || [],
    needle = query.toLowerCase();
  return raw
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const date = String(item.release_date || "");
      return {
        ...item,
        poster_path: item.large_poster_path,
        backdrop_path: item.small_poster_path,
        year: date ? date.slice(0, 4) : null,
      };
    })
    .sort((a, b) => {
      const rank = (item) => {
        const value = String(item.title || "").toLowerCase();
        return [
          value === needle ? 0 : value.startsWith(needle) ? 1 : 2,
          value.includes(needle) ? value.indexOf(needle) : 9999,
          value,
        ];
      };
      return (
        rank(a)[0] - rank(b)[0] ||
        rank(a)[1] - rank(b)[1] ||
        rank(a)[2].localeCompare(rank(b)[2])
      );
    });
};
const publicMedia = async (id, season = 1) => {
  const sheet = await publicJson(`${PURSTREAM_API}/media/${id}/sheet`),
    media = sheet?.data?.items || {};
  if (!media?.id) throw new Error("Média introuvable");
  const isSeries = media.type === "tv",
    seasonPayload = isSeries
      ? await publicJson(`${PURSTREAM_API}/media/${id}/season/${season}`)
      : null,
    episodes = seasonPayload?.data?.items?.episodes || [],
    streams = { fr: {}, vo: {} };
  (media.urls || []).forEach((item) => {
    const sourceName = String(item.name || ""),
      languages = /\bMULTI\b/i.test(sourceName)
        ? ["fr", "vo"]
        : /\bVF\b/i.test(sourceName)
          ? ["fr"]
          : ["vo"];
    for (const lang of languages) {
      if (isSeries) {
        const match = String(item.url || "").match(/S(\d+)\/E(\d+)/i);
        if (match) {
          const seasonKey = String(Number(match[1])),
            episodeKey = String(Number(match[2]));
          streams[lang][seasonKey] ??= {};
          streams[lang][seasonKey][episodeKey] = item;
        }
      } else {
        streams[lang].movie ??= [];
        streams[lang].movie.push(item);
      }
    }
  });
  return { media, episodes, streams, season, isSeries, language: "fr" };
};
const fallback =
  "https://placehold.co/900x1300/19151f/e08dff?text=Knockturn+Alley";
const loadingSpells = [
  "Un peu de poudre de cheminette…",
  "La carte révèle peu à peu ses secrets…",
  "Les hiboux apportent votre sélection…",
  "Le Choixpeau cherche quoi regarder…",
  "Quelques sortilèges sont encore nécessaires…",
  "Votre malle magique est presque prête…",
  "Les portraits se mettent en mouvement…",
  "Une potion de cinéma est en préparation…",
  "Les chandelles s’allument dans la grande salle…",
  "La bibliothèque interdite ouvre ses portes…",
];
const image = (item, wide = false) =>
  wide
    ? item?.backdrop_path ||
      item?.small_poster_path ||
      item?.poster_path ||
      fallback
    : item?.poster_path ||
      item?.small_poster_path ||
      item?.backdrop_path ||
      fallback;
const title = (item) =>
  item?.title || item?.name || item?.original_title || "Sans titre";

function Row({ heading, items = [], onSelect }) {
  const id = `row-${heading.replaceAll(" ", "-")}`;
  const scroll = (direction) =>
    document
      .getElementById(id)
      ?.scrollBy({ left: direction * 760, behavior: "smooth" });
  return (
    <section className="shelf">
      <div className="shelf-title">
        <div>
          <span>Notre sélection</span>
          <h2>{heading}</h2>
        </div>
        <div className="row-actions">
          <button onClick={() => scroll(-1)}>
            <ChevronLeft />
          </button>
          <button onClick={() => scroll(1)}>
            <ChevronRight />
          </button>
        </div>
      </div>
      <div className="cards" id={id}>
        {items.map((item, i) => (
          <button
            className="card"
            key={`${item.id}-${i}`}
            onClick={() => onSelect(item)}
          >
            <img src={image(item)} alt="" loading="lazy" />
            <div className="card-shade" />
            <div className="card-info">
              <small>{item.type === "movie" ? "FILM" : "SÉRIE"}</small>
              <strong>{title(item)}</strong>
              <span>{item.year || item.release_year || "À découvrir"}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function Player({ item, episodes, onPlayEpisode, onClose }) {
  const videoRef = useRef(null),
    playerBoxRef = useRef(null),
    hlsRef = useRef(null),
    retryRef = useRef(null),
    saveRef = useRef(0),
    progressSaveRef = useRef(() => {}),
    externalVisitRef = useRef({ waiting: false, hidden: false }),
    triggerRef = useRef(10),
    skipAutoRef = useRef(false),
    restoreFullscreenRef = useRef(false);
  const [tracks, setTracks] = useState([]),
    [track, setTrack] = useState(0),
    [audioLanguage, setAudioLanguage] = useState(
      item?.playbackLanguage || "fr",
    ),
    [manifestLanguages, setManifestLanguages] = useState([]),
    [countdown, setCountdown] = useState(null),
    [error, setError] = useState(""),
    [settingsOpen, setSettingsOpen] = useState(false),
    [triggerSeconds, setTriggerSeconds] = useState(10),
    [settingValue, setSettingValue] = useState(10),
    [settingSaved, setSettingSaved] = useState(false),
    [externalPrompt, setExternalPrompt] = useState(null),
    [externalTime, setExternalTime] = useState(""),
    [externalTimeError, setExternalTimeError] = useState(""),
    [fullscreen, setFullscreen] = useState(false);
  useEffect(
    () => {
      setAudioLanguage(item?.playbackLanguage || "fr");
      setExternalPrompt(null);
      setExternalTime("");
      externalVisitRef.current = { waiting: false, hidden: false };
    },
    [item?.key],
  );
  useEffect(() => {
    const trackExternalVisit = () => {
      const visit = externalVisitRef.current;
      if (!visit.waiting) return;
      if (document.visibilityState === "hidden") {
        visit.hidden = true;
        return;
      }
      if (visit.hidden) {
        externalVisitRef.current = { waiting: false, hidden: false };
        setExternalTime("");
        setExternalTimeError("");
        setExternalPrompt({ stage: "return" });
      }
    };
    document.addEventListener("visibilitychange", trackExternalVisit);
    return () =>
      document.removeEventListener("visibilitychange", trackExternalVisit);
  }, []);
  useEffect(() => {
    const changed = () =>
      setFullscreen(
        Boolean(document.fullscreenElement || document.webkitFullscreenElement),
      );
    document.addEventListener("fullscreenchange", changed);
    document.addEventListener("webkitfullscreenchange", changed);
    return () => {
      document.removeEventListener("fullscreenchange", changed);
      document.removeEventListener("webkitfullscreenchange", changed);
    };
  }, []);
  useEffect(() => {
    const modal = playerBoxRef.current?.closest(".player-modal");
    if (!modal) return;
    let timer;
    const wake = () => {
      modal.classList.remove("controls-idle");
      clearTimeout(timer);
      timer = setTimeout(() => modal.classList.add("controls-idle"), 3000);
    };
    const events = ["pointerdown", "pointermove", "touchstart", "keydown"];
    events.forEach((event) =>
      modal.addEventListener(event, wake, { passive: true }),
    );
    wake();
    return () => {
      clearTimeout(timer);
      modal.classList.remove("controls-idle");
      events.forEach((event) => modal.removeEventListener(event, wake));
    };
  }, []);
  const toggleFullscreen = async () => {
    const box = playerBoxRef.current?.closest(".player-modal");
    if (!box) return;
    const active =
      document.fullscreenElement || document.webkitFullscreenElement;
    try {
      if (active) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else document.webkitExitFullscreen?.();
      } else if (box.requestFullscreen) await box.requestFullscreen();
      else box.webkitRequestFullscreen?.();
    } catch {
      setError(
        "Le plein écran personnalisé n’est pas disponible sur ce navigateur.",
      );
    }
  };
  const restoreFullscreen = async () => {
    if (!restoreFullscreenRef.current) return;
    const active =
      document.fullscreenElement || document.webkitFullscreenElement;
    if (active) {
      restoreFullscreenRef.current = false;
      return;
    }
    const box = playerBoxRef.current?.closest(".player-modal");
    try {
      if (box?.requestFullscreen) await box.requestFullscreen();
      else if (box?.webkitRequestFullscreen)
        await box.webkitRequestFullscreen();
      restoreFullscreenRef.current = false;
    } catch {
      setError("Touchez le bouton plein écran pour revenir en plein écran.");
    }
  };
  useEffect(() => {
    if (!item?.mediaId || !episodes.length) return;
    const profileId = Number(localStorage.getItem("alocine_profile")),
      token = localStorage.getItem("alocine_token"),
      fallbackValue = Number(
        localStorage.getItem(`alocine_next_${item.mediaId}`) || 10,
      );
    const apply = (value) => {
      const seconds = Math.max(0, Math.min(900, Number(value) || 0));
      triggerRef.current = seconds;
      setTriggerSeconds(seconds);
      setSettingValue(seconds);
    };
    apply(fallbackValue);
    if (profileId && token)
      fetch(
        `${API}/api/series-settings/${item.mediaId}?profile_id=${profileId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((value) => {
          if (value) apply(value.trigger_seconds);
        })
        .catch(() => {});
  }, [item?.mediaId]);
  const saveSeriesSetting = async () => {
    const seconds = Math.max(0, Math.min(900, Number(settingValue) || 0)),
      profileId = Number(localStorage.getItem("alocine_profile")),
      token = localStorage.getItem("alocine_token");
    triggerRef.current = seconds;
    setTriggerSeconds(seconds);
    setSettingValue(seconds);
    localStorage.setItem(`alocine_next_${item.mediaId}`, seconds);
    if (profileId && token)
      await fetch(`${API}/api/series-settings/${item.mediaId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          profile_id: profileId,
          trigger_seconds: seconds,
        }),
      }).catch(() => {});
    setSettingSaved(true);
    setTimeout(() => {
      setSettingSaved(false);
      setSettingsOpen(false);
    }, 700);
  };
  useEffect(() => {
    const video = videoRef.current,
      url = item?.sources?.[audioLanguage] || item?.url;
    if (!video || !url) return;
    const languageChoices = Object.entries(item?.sources || {})
      .filter(([, source]) => source)
      .map(([code]) => ({
        name: code === "vo" ? "VO · English" : "VF · Français",
        lang: code,
        playbackLanguage: code,
      }));
    setError("");
    setTracks(languageChoices);
    setTrack(
      Math.max(
        0,
        languageChoices.findIndex(
          (choice) => choice.playbackLanguage === audioLanguage,
        ),
      ),
    );
    setCountdown(null);
    skipAutoRef.current = false;
    const controller = new AbortController();
    let networkRetries = 0;
    const temporaryManifests = [],
      sourceName = String(item?.sourceName || ""),
      advertisedQuality =
        sourceName.match(/\b(2160|1440|1080|720|480)p\b/i)?.[1] ||
        (/\/hd\/master\.m3u8/i.test(url) ? "1080" : "720"),
      renditionCandidates = [
        ...new Set([advertisedQuality, "1080", "720", "480"]),
      ];
    let renditionIndex = 0;
    const resolvePlaybackUrl = async (forcedQuality = null) => {
      if (!/\.m3u8(?:\?.*)?$/i.test(url)) return url;
      if (/\/master\.m3u8(?:\?.*)?$/i.test(url)) {
        if (!forcedQuality) {
          try {
            const masterResponse = await fetch(hlsUrl(url), {
              signal: controller.signal,
              mode: "cors",
              credentials: "omit",
              referrerPolicy: "no-referrer",
            });
            if (!masterResponse.ok)
              throw new Error(`HTTP ${masterResponse.status}`);
            const masterLines = (await masterResponse.text())
                .split(/\r?\n/)
                .map((line) => line.trim()),
              audioLines = masterLines.filter(
                (line) =>
                  line.startsWith("#EXT-X-MEDIA:") &&
                  /TYPE=AUDIO/i.test(line),
              ),
              wantedAudio =
                audioLanguage === "vo"
                  ? /LANGUAGE="?(en|eng)"?|NAME="?English/i
                  : /LANGUAGE="?(fr|fre|fra)"?|NAME="?Fran/i,
              selectedAudio = audioLines.find((line) =>
                wantedAudio.test(line),
              ),
              variants = [];
            for (let index = 0; index < masterLines.length; index += 1) {
              if (!masterLines[index].startsWith("#EXT-X-STREAM-INF:"))
                continue;
              const uri = masterLines
                .slice(index + 1)
                .find((line) => line && !line.startsWith("#"));
              if (uri)
                variants.push({
                  info: masterLines[index],
                  uri,
                  height: Number(
                    masterLines[index].match(/RESOLUTION=\d+x(\d+)/i)?.[1] ||
                      0,
                  ),
                  bandwidth: Number(
                    masterLines[index].match(/BANDWIDTH=(\d+)/i)?.[1] || 0,
                  ),
                });
            }
            variants.sort(
              (a, b) => b.height - a.height || b.bandwidth - a.bandwidth,
            );
            const selectedVariant = variants[0];
            // Preserve the proven 720p VF path. HD movie masters use the same
            // layout, so feed hls.js the exact rendition advertised by the
            // master instead of rebuilding a video + external AAC manifest.
            if (
              audioLanguage === "fr" &&
              (selectedVariant?.height === 720 ||
                /\/movies\/[^/]+\/hd\/master\.m3u8(?:\?.*)?$/i.test(url))
            ) {
              if (audioLines.length > 1) setManifestLanguages(["fr", "vo"]);
              return hlsUrl(new URL(selectedVariant.uri, url).href);
            }
            if (selectedVariant && selectedAudio) {
              const codecs =
                  selectedVariant.info.match(/CODECS="([^"]+)"/i)?.[1] || "",
                usesHevc = /\b(hvc1|hev1)\b/i.test(codecs),
                hevcCodec = codecs
                  .split(",")
                  .map((codec) => codec.trim())
                  .find((codec) => /^(hvc1|hev1)/i.test(codec)),
                hevcSupported =
                  !usesHevc ||
                  (hevcCodec &&
                    window.MediaSource?.isTypeSupported(
                      `video/mp4; codecs="${hevcCodec}"`,
                    ));
              if (!hevcSupported) {
                setError(
                  "Cette source est encodée en HEVC (hvc1), un format que ce navigateur ne sait pas décoder. Essayez Safari sur iPhone/Mac ou un navigateur Windows disposant du codec HEVC.",
                );
                return null;
              }
              const absoluteAudio = selectedAudio
                  .replace(/DEFAULT=(YES|NO)/i, "DEFAULT=YES")
                  .replace(/AUTOSELECT=(YES|NO)/i, "AUTOSELECT=YES")
                  .replace(
                    /URI="([^"]+)"/i,
                    (_, path) => `URI="${hlsUrl(new URL(path, url).href)}"`,
                  ),
                exactStreamInfo = selectedVariant.info.replace(
                  /,?SUBTITLES="[^"]+"/i,
                  "",
                ),
                exactVideoUrl = hlsUrl(
                  new URL(selectedVariant.uri, url).href,
                ),
                exactManifest = [
                  "#EXTM3U",
                  "#EXT-X-VERSION:3",
                  absoluteAudio,
                  exactStreamInfo,
                  exactVideoUrl,
                ],
                exactManifestUrl = URL.createObjectURL(
                  new Blob([`${exactManifest.join("\n")}\n`], {
                    type: "application/vnd.apple.mpegurl",
                  }),
                );
              temporaryManifests.push(exactManifestUrl);
              if (audioLines.length > 1) setManifestLanguages(["fr", "vo"]);
              return exactManifestUrl;
            }
          } catch (reason) {
            if (reason?.name === "AbortError") throw reason;
            // Some Cloudflare edges reject master.m3u8. Keep the quality-based
            // fallback below so playback can still start.
          }
        }
        const quality = forcedQuality || advertisedQuality,
          videoPlaylist = hlsUrl(
            new URL(`${quality}p/playlist.m3u8`, url).href,
          );

        // Fallback only when the master cannot be read on this Cloudflare edge.
        if (/\bMULTI\b/i.test(sourceName)) setManifestLanguages(["fr", "vo"]);
        if (audioLanguage === "fr") return videoPlaylist;

        const englishAudio = hlsUrl(
            new URL("audio_en/playlist.m3u8", url).href,
          ),
          resolution =
            quality === "2160"
              ? "3840x2160"
              : quality === "1440"
                ? "2560x1440"
                : quality === "1080"
                  ? "1920x1080"
                  : quality === "480"
                    ? "854x480"
                    : "1280x720",
          synthetic = [
            "#EXTM3U",
            "#EXT-X-VERSION:3",
            `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="English",DEFAULT=YES,AUTOSELECT=YES,LANGUAGE="en",URI="${englishAudio}"`,
            `#EXT-X-STREAM-INF:BANDWIDTH=5500000,RESOLUTION=${resolution},CODECS="avc1.640028,mp4a.40.2",AUDIO="audio"`,
            videoPlaylist,
          ],
          manifestUrl = URL.createObjectURL(
            new Blob([`${synthetic.join("\n")}\n`], {
              type: "application/vnd.apple.mpegurl",
            }),
          );
        temporaryManifests.push(manifestUrl);
        return manifestUrl;
      }
      // It is already a final media playlist. Do not pre-fetch it: an extra
      // Fetch/XHR request can trigger Cloudflare before hls.js starts playback.
      return hlsUrl(url);
      /* Legacy parser kept unreachable for the moment; master manifests are
         deliberately bypassed above because the CDN rejects them. */
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          mode: "cors",
          credentials: "omit",
          cache: "no-store",
          referrerPolicy: "no-referrer",
          headers: {
            Accept: "application/vnd.apple.mpegurl, application/x-mpegURL, */*",
          },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const lines = (await response.text())
          .split(/\r?\n/)
          .map((line) => line.trim());
        const detectedAudio = lines.filter(
          (line) =>
            line.startsWith("#EXT-X-MEDIA:") && /TYPE=AUDIO/i.test(line),
        );
        const detectedLanguages = [];
        if (
          detectedAudio.some((line) =>
            /LANGUAGE="?(fr|fre|fra)"?|NAME="?Fran/i.test(line),
          )
        )
          detectedLanguages.push("fr");
        if (
          detectedAudio.some((line) =>
            /LANGUAGE="?(en|eng)"?|NAME="?English/i.test(line),
          )
        )
          detectedLanguages.push("vo");
        if (detectedLanguages.length) setManifestLanguages(detectedLanguages);
        if (audioLanguage === "vo") {
          const audioLines = detectedAudio;
          const english = audioLines.find((line) =>
            /LANGUAGE="?(en|eng)"?|NAME="?English/i.test(line),
          );
          if (english) {
            const choices = [];
            for (let i = 0; i < lines.length; i++)
              if (lines[i].startsWith("#EXT-X-STREAM-INF:")) {
                const uri = lines
                  .slice(i + 1)
                  .find((line) => line && !line.startsWith("#"));
                if (uri)
                  choices.push({
                    info: lines[i],
                    uri,
                    height: Number(
                      lines[i].match(/RESOLUTION=\d+x(\d+)/i)?.[1] || 0,
                    ),
                    bandwidth: Number(
                      lines[i].match(/BANDWIDTH=(\d+)/i)?.[1] || 0,
                    ),
                  });
              }
            choices.sort(
              (a, b) => b.height - a.height || b.bandwidth - a.bandwidth,
            );
            const best = choices[0];
            if (!best) throw new Error("Aucune variante vidéo");
            const audio = english
              .replace(/DEFAULT=(YES|NO)/i, "DEFAULT=YES")
              .replace(/AUTOSELECT=(YES|NO)/i, "AUTOSELECT=YES")
              .replace(
                /URI="([^"]+)"/i,
                (_, uri) => `URI="${new URL(uri, url).href}"`,
              );
            const streamInfo = best.info.replace(/,?SUBTITLES="[^"]+"/i, "");
            const rewritten = [
              "#EXTM3U",
              "#EXT-X-VERSION:3",
              audio,
              streamInfo,
              new URL(best.uri, url).href,
            ];
            const manifestUrl = URL.createObjectURL(
              new Blob([`${rewritten.join("\n")}\n`], {
                type: "application/vnd.apple.mpegurl",
              }),
            );
            temporaryManifests.push(manifestUrl);
            return manifestUrl;
          }
        }
        const variants = [];
        for (let i = 0; i < lines.length; i++) {
          if (!lines[i].startsWith("#EXT-X-STREAM-INF:")) continue;
          const uri = lines
            .slice(i + 1)
            .find((line) => line && !line.startsWith("#"));
          if (!uri) continue;
          const height = Number(
            lines[i].match(/RESOLUTION=\d+x(\d+)/i)?.[1] || 0,
          );
          const bandwidth = Number(
            lines[i].match(/BANDWIDTH=(\d+)/i)?.[1] || 0,
          );
          variants.push({ url: new URL(uri, url).href, height, bandwidth });
        }
        variants.sort(
          (a, b) => b.height - a.height || b.bandwidth - a.bandwidth,
        );
        return variants[0]?.url || url;
      } catch (reason) {
        if (reason?.name !== "AbortError") {
          const quality =
              String(item?.sourceName || "").match(
                /\b(2160|1440|1080|720|480)p\b/i,
              )?.[1] || "720",
            fallbackPlaylist = /\/master\.m3u8(?:\?.*)?$/i.test(url)
              ? new URL(`${quality}p/playlist.m3u8`, url).href
              : url;
          setError(
            `Impossible d'analyser le manifeste maître (${reason?.message || "erreur inconnue"}). Utilisation de la playlist ${quality}p de secours…`,
          );
          return fallbackPlaylist;
        }
        return url;
      }
    };
    const saveProgress = (overrides = {}) => {
      const position = Math.floor(overrides.position ?? video.currentTime ?? 0),
        duration = Math.floor(video.duration || 0);
      localStorage.setItem(`alocine_resume_${item.key}`, String(position));
      const token = localStorage.getItem("alocine_token"),
        profileId = Number(localStorage.getItem("alocine_profile"));
      if (!token || !profileId || !item.mediaId) return;
      fetch(`${API}/api/progress`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          profile_id: profileId,
          media_id: Number(item.mediaId),
          season: Number(item.season || 1),
          episode: Number(item.episodeNumber || 1),
          position,
          duration,
          title: item.mediaTitle || item.title,
          episode_title: item.title || "",
          poster: item.poster || "",
          media_type: episodes.length > 0 ? "tv" : "movie",
          completed: Boolean(overrides.completed),
          skipped_auto: Boolean(overrides.skipped_auto),
        }),
      }).catch(() => {});
    };
    progressSaveRef.current = saveProgress;
    const onMetadata = () => {
      const saved = Number(
        item.resumePosition ??
          localStorage.getItem(`alocine_resume_${item.key}`) ??
          0,
      );
      if (saved > 0 && saved < video.duration - 10) video.currentTime = saved;
      const nativeTracks = video.audioTracks;
      if (nativeTracks?.length > 1) {
        const wantsVo = audioLanguage === "vo";
        for (let i = 0; i < nativeTracks.length; i++) {
          const label =
            `${nativeTracks[i].language || ""} ${nativeTracks[i].label || ""}`.toLowerCase();
          nativeTracks[i].enabled = wantsVo
            ? /\b(en|eng|english|originale?|vo)\b/.test(label)
            : /\b(fr|fre|fra|french|fran[cç]ais|vf)\b/.test(label);
        }
      }
      restoreFullscreen();
    };
    const onTime = () => {
      if (Date.now() - saveRef.current > 10000) {
        saveRef.current = Date.now();
        saveProgress();
      }
      const next = episodes[item.index + 1],
        remaining = video.duration - video.currentTime;
      if (
        !skipAutoRef.current &&
        triggerRef.current > 0 &&
        next?.url &&
        Number.isFinite(remaining) &&
        remaining <= triggerRef.current
      )
        setCountdown((current) => (current === null ? 10 : current));
    };
    const onPause = () => saveProgress();
    const onEnded = () => {
      saveProgress({ completed: true, position: video.duration });
      if (!skipAutoRef.current && episodes[item.index + 1]?.url)
        setCountdown((current) => (current === null ? 10 : current));
    };
    const onPlaying = () => {
      networkRetries = 0;
      setError("");
    };
    const onVideoError = () => {
      const code = video.error?.code;
      setError(
        `Erreur vidéo${code ? ` (code ${code})` : ""}. Vérifiez les requêtes HLS dans l'onglet Réseau.`,
      );
    };
    const tryPlay = () =>
      video.play().catch((reason) => {
        if (reason?.name !== "NotAllowedError")
          setError(
            `Lecture impossible : ${reason?.message || "erreur inconnue"}`,
          );
      });
    video.addEventListener("loadedmetadata", onMetadata);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("error", onVideoError);
    if (
      video.canPlayType("application/vnd.apple.mpegurl") &&
      !(audioLanguage === "vo" && Hls.isSupported())
    ) {
      resolvePlaybackUrl().then((playbackUrl) => {
        if (controller.signal.aborted || !playbackUrl) return;
        video.src = playbackUrl;
        video.load();
        tryPlay();
      });
    } else if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        // Some 1080p fragments are nearly 6 MB each and the CDN rate-limits
        // burst downloads. Keep only a small rolling buffer instead of the
        // default ~60 MB window.
        maxBufferLength: 10,
        maxMaxBufferLength: 20,
        maxBufferSize: 30 * 1024 * 1024,
        backBufferLength: 20,
        startFragPrefetch: false,
        manifestLoadingMaxRetry: 1,
        levelLoadingMaxRetry: 1,
        fragLoadingMaxRetry: 1,
        fragLoadingRetryDelay: 8000,
        fragLoadingMaxRetryTimeout: 20000,
      });
      hlsRef.current = hls;
      hls.on(Hls.Events.MEDIA_ATTACHED, async () => {
        const playbackUrl = await resolvePlaybackUrl();
        if (
          playbackUrl &&
          !controller.signal.aborted &&
          hlsRef.current === hls
        )
          hls.loadSource(playbackUrl);
      });
      hls.on(Hls.Events.MANIFEST_PARSED, tryPlay);
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_, data) => {
        const available = data.audioTracks || [],
          wantsVo = audioLanguage === "vo",
          preferred = available.findIndex((audio) => {
            const label =
              `${audio.lang || ""} ${audio.name || ""}`.toLowerCase();
            return wantsVo
              ? /\b(en|eng|english|originale?|vo)\b/.test(label)
              : /\b(fr|fre|fra|french|fran[cç]ais|vf)\b/.test(label);
          }),
          selected =
            preferred >= 0
              ? preferred
              : hls.audioTrack >= 0
                ? hls.audioTrack
                : 0;
        if (available.length > 1) {
          setTracks(available);
          setTrack(selected);
        }
        hls.audioTrack = selected;
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          const status = data.response?.code || data.response?.status;
          if (
            Number(status) === 404 &&
            /\/master\.m3u8(?:\?.*)?$/i.test(url) &&
            renditionIndex < renditionCandidates.length - 1
          ) {
            renditionIndex += 1;
            networkRetries = 0;
            setError(
              `Qualité indisponible, tentative en ${renditionCandidates[renditionIndex]}p…`,
            );
            resolvePlaybackUrl(renditionCandidates[renditionIndex]).then(
              (fallbackUrl) => {
                if (!controller.signal.aborted && hlsRef.current === hls) {
                  setError("");
                  hls.loadSource(fallbackUrl);
                }
              },
            );
            return;
          }
          const limited = Number(status) === 429;
          if (limited) {
            clearTimeout(retryRef.current);
            hls.stopLoad();
            setError(
              "Le serveur vidéo a déclenché sa protection 429. Patientez quelques instants puis rouvrez le lecteur.",
            );
            return;
          }
          networkRetries += 1;
          if (networkRetries > 2) {
            clearTimeout(retryRef.current);
            hls.stopLoad();
            setError(
              `Lecture arrêtée après plusieurs échecs${status ? ` HTTP ${status}` : ""} (${data.details}). Recharge la source ou réessaie plus tard.`,
            );
            return;
          }
          setError(
            limited
              ? "Le serveur vidéo limite temporairement les requêtes (429). Nouvelle tentative dans 15 secondes…"
              : `Flux inaccessible : ${data.details}. Nouvelle tentative…`,
          );
          clearTimeout(retryRef.current);
          retryRef.current = setTimeout(
            () => {
              setError("");
              hls.startLoad();
            },
            limited ? 15000 : 3000,
          );
          return;
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          setError(`Erreur de décodage : ${data.details}. Récupération…`);
          hls.recoverMediaError();
          return;
        }
        setError(`Erreur HLS : ${data.details || data.type}`);
        hls.destroy();
        hlsRef.current = null;
      });
      hls.attachMedia(video);
    } else setError("Votre navigateur ne supporte pas la lecture HLS.");
    return () => {
      saveProgress();
      controller.abort();
      clearTimeout(retryRef.current);
      video.removeEventListener("loadedmetadata", onMetadata);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("error", onVideoError);
      hlsRef.current?.destroy();
      hlsRef.current = null;
      temporaryManifests.forEach((manifest) => URL.revokeObjectURL(manifest));
      video.removeAttribute("src");
      video.load();
    };
  }, [item, audioLanguage]);
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      const next = episodes[item.index + 1];
      progressSaveRef.current({
        completed: true,
        skipped_auto: true,
        position: videoRef.current?.duration || 0,
      });
      restoreFullscreenRef.current = Boolean(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        fullscreen,
      );
      setCountdown(null);
      if (next) onPlayEpisode(next);
      return;
    }
    const timer = setTimeout(() => setCountdown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);
  const changeTrack = (e) => {
    const value = Number(e.target.value),
      selected = tracks[value];
    if (selected?.playbackLanguage) {
      setAudioLanguage(selected.playbackLanguage);
      localStorage.setItem("alocine_language", selected.playbackLanguage);
      return;
    }
    setTrack(value);
    if (hlsRef.current) hlsRef.current.audioTrack = value;
    const lang = selected?.lang || selected?.name;
    if (lang) localStorage.setItem("preferred_audio_lang", lang);
  };
  const availableLanguages = [
    ...new Set([
      ...Object.entries(item?.sources || {})
        .filter(([, source]) => source)
        .map(([code]) => code),
      ...manifestLanguages,
    ]),
  ];
  const externalSource =
      item?.sources?.[audioLanguage] || item?.url || "",
    externalLinks = (() => {
      if (!externalSource) return [];
      try {
        const source = new URL(externalSource),
          links = [];
        if (/\.m3u8(?:\?.*)?$/i.test(source.href)) {
          const base = /\/master\.m3u8(?:\?.*)?$/i.test(source.href)
            ? source
            : new URL("../master.m3u8", source);
          links.push(
            {
              label: "720p",
              url: new URL("720p/playlist.m3u8", base).href,
            },
            {
              label: "1080p",
              url: new URL("1080p/playlist.m3u8", base).href,
            },
          );
          if (!/\/hd\/master\.m3u8(?:\?.*)?$/i.test(base.href))
            links.push({
              label: "HD 1080p",
              url: new URL("hd/1080p/playlist.m3u8", base).href,
            });
        }
        links.push({
          label: /\/master\.m3u8(?:\?.*)?$/i.test(source.href)
            ? "Master"
            : "Source",
          url: source.href,
        });
        return links.filter(
          ({ url }, index, values) =>
            values.findIndex((entry) => entry.url === url) === index,
        );
      } catch {
        return [];
      }
    })();
  const formatExternalTime = (seconds) => {
    const value = Math.max(0, Math.floor(Number(seconds) || 0)),
      hours = Math.floor(value / 3600),
      minutes = Math.floor((value % 3600) / 60),
      remaining = value % 60,
      paddedMinutes = String(minutes).padStart(2, "0"),
      paddedSeconds = String(remaining).padStart(2, "0");
    return hours
      ? hours + ":" + paddedMinutes + ":" + paddedSeconds
      : minutes + ":" + paddedSeconds;
  };
  const parseExternalTime = (value) => {
    const clean = String(value || "").trim();
    if (!clean) return null;
    const parts = clean.split(":");
    if (parts.length > 3 || parts.some((part) => !/^\d+$/.test(part)))
      return null;
    if (parts.length === 1) return Number(parts[0]) * 60;
    return parts
      .map(Number)
      .reverse()
      .reduce((total, part, index) => total + part * 60 ** index, 0);
  };
  const launchExternalSource = (link) => {
    setExternalPrompt(null);
    externalVisitRef.current = { waiting: true, hidden: false };
    window.open(link.url, "_blank", "noopener,noreferrer");
  };
  const requestExternalSource = (link) => {
    const saved = Number(
      item.resumePosition ??
        localStorage.getItem(`alocine_resume_${item.key}`) ??
        0,
    );
    if (saved > 0) {
      setExternalPrompt({ stage: "resume", link, saved });
      return;
    }
    launchExternalSource(link);
  };
  const saveExternalProgress = () => {
    const position = parseExternalTime(externalTime);
    if (position === null) {
      setExternalTimeError("Indiquez un temps comme 10:20 ou 1:10:20.");
      return;
    }
    progressSaveRef.current({ position });
    setExternalPrompt(null);
    setExternalTimeError("");
  };
  const completeExternalPlayback = () => {
    progressSaveRef.current({
      completed: true,
      position: videoRef.current?.duration || 0,
    });
    setExternalPrompt(null);
    const next = episodes[item.index + 1];
    if (next) onPlayEpisode(next);
  };
  return (
    <div
      className="player-modal"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <button className="close" onClick={onClose}>
        <X />
      </button>
      <div className="player-box" ref={playerBoxRef}>
        <div className="player-head">
          <h3>{item.title}</h3>
          <div className="player-tools">
            {(episodes.length > 0 || availableLanguages.length > 1) && (
              <button
                title="Réglages du lecteur"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings />
              </button>
            )}
            <button
              title={fullscreen ? "Quitter le plein écran" : "Plein écran"}
              onClick={toggleFullscreen}
            >
              {fullscreen ? <Minimize /> : <Maximize />}
            </button>
          </div>
        </div>
        <video
          ref={videoRef}
          controls
          controlsList="nofullscreen"
          playsInline
          preload="auto"
          referrerPolicy="no-referrer"
        />
        {error && <p className="player-error">{error}</p>}
        {externalLinks.length > 0 && (
          <div className="external-source-links">
            <span>
              Ouvrir directement · {audioLanguage === "vo" ? "VO" : "VF"}
            </span>
            <div>
              {externalLinks.map((link) => (
                <button
                  key={link.url}
                  type="button"
                  onClick={() => requestExternalSource(link)}
                >
                  {link.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {externalPrompt && (
          <div className="external-progress-overlay">
            <div className="external-progress-card">
              <button
                className="external-progress-close"
                onClick={() => setExternalPrompt(null)}
                aria-label="Fermer"
              >
                <X />
              </button>
              {externalPrompt.stage === "resume" ? (
                <>
                  <Sparkles />
                  <small>REPRISE DE LA LECTURE</small>
                  <h4>Vous aviez déjà commencé</h4>
                  <p>
                    Dans le lecteur externe, avancez jusqu’à{" "}
                    <strong>{formatExternalTime(externalPrompt.saved)}</strong>{" "}
                    pour reprendre là où vous en étiez.
                  </p>
                  <button
                    className="external-progress-primary"
                    onClick={() => launchExternalSource(externalPrompt.link)}
                  >
                    Ouvrir et reprendre
                  </button>
                  <button onClick={() => setExternalPrompt(null)}>
                    Annuler
                  </button>
                </>
              ) : (
                <>
                  <Clock />
                  <small>RETOUR DE LECTURE</small>
                  <h4>Où vous êtes-vous arrêté ?</h4>
                  <p>
                    Nous ne pouvons pas lire automatiquement la position de
                    l’autre onglet. Indiquez-la pour mettre à jour l’historique.
                  </p>
                  <label>
                    Temps de pause
                    <input
                      value={externalTime}
                      onChange={(event) => {
                        setExternalTime(event.target.value);
                        setExternalTimeError("");
                      }}
                      placeholder="10:20"
                      inputMode="numeric"
                      autoFocus
                    />
                  </label>
                  {externalTimeError && (
                    <p className="external-time-error">{externalTimeError}</p>
                  )}
                  <button
                    className="external-progress-primary"
                    onClick={saveExternalProgress}
                  >
                    Enregistrer ma progression
                  </button>
                  <button onClick={completeExternalPlayback}>
                    ✓ Lecture terminée
                    {episodes[item.index + 1] ? " · Épisode suivant" : ""}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        {settingsOpen && (
          <div className="next-settings">
            <button
              className="settings-close"
              onClick={() => setSettingsOpen(false)}
            >
              <X />
            </button>
            <Settings />
            <h4>Réglages du lecteur</h4>
            {availableLanguages.includes("fr") &&
              availableLanguages.includes("vo") && (
                <div className="player-language-setting">
                  <span>Langue audio</span>
                  <div className="language-choice">
                    <button
                      className={audioLanguage === "fr" ? "selected" : ""}
                      onClick={() => {
                        setAudioLanguage("fr");
                        localStorage.setItem("alocine_language", "fr");
                      }}
                    >
                      VF · Français
                    </button>
                    <button
                      className={audioLanguage === "vo" ? "selected" : ""}
                      onClick={() => {
                        setAudioLanguage("vo");
                        localStorage.setItem("alocine_language", "vo");
                      }}
                    >
                      VO · English
                    </button>
                  </div>
                </div>
              )}
            {episodes.length > 0 && (
              <>
                <p>
                  Choisissez quand lancer le compte à rebours de 10 secondes.
                </p>
                <div className="auto-next-setting next-trigger-setting">
                  <label>
                    <span>Avant la fin</span>
                    <b>
                      {Number(settingValue) === 0
                        ? "Désactivé"
                        : Number(settingValue) < 60
                          ? `${settingValue} s`
                          : `${Math.floor(Number(settingValue) / 60)} min ${Number(settingValue) % 60 ? `${Number(settingValue) % 60} s` : ""}`}
                    </b>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="900"
                    step="5"
                    value={settingValue}
                    onChange={(event) =>
                      setSettingValue(Number(event.target.value))
                    }
                  />
                  <div>
                    <small>Désactivé</small>
                    <small>15 min</small>
                  </div>
                </div>
                <small>
                  Exemple : 60 secondes permet d’ignorer un générique d’une
                  minute.
                </small>
                <button
                  className="save-next-setting"
                  onClick={saveSeriesSetting}
                >
                  {settingSaved
                    ? "✓ Enregistré"
                    : "Enregistrer pour cette série"}
                </button>
              </>
            )}
          </div>
        )}
        {countdown !== null && (
          <div className="next-overlay">
            <div
              className="countdown-ring"
              style={{ "--progress": `${(10 - countdown) * 36}deg` }}
            >
              <b>{countdown}</b>
            </div>
            <p>Prochain épisode</p>
            <h4>{episodes[item.index + 1]?.title || "Épisode suivant"}</h4>
            <p>
              Lecture automatique dans <b>{countdown}</b> seconde
              {countdown > 1 ? "s" : ""}
            </p>
            <button onClick={() => setCountdown(0)}>▶ Lancer maintenant</button>
            <button
              onClick={() => {
                skipAutoRef.current = true;
                setCountdown(null);
              }}
            >
              Rester sur cet épisode
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({
  id,
  onBack,
  profile,
  onProfile,
  query,
  onQuery,
  onHistory,
  onRecommend,
}) {
  const [detail, setDetail] = useState(null),
    [season, setSeason] = useState(1),
    [language, setLanguage] = useState(
      () =>
        profile?.language || localStorage.getItem("alocine_language") || "fr",
    ),
    [playing, setPlaying] = useState(null),
    [resume, setResume] = useState(null),
    [episodeProgress, setEpisodeProgress] = useState({}),
    [error, setError] = useState("");
  useEffect(() => {
    const token = localStorage.getItem("alocine_token"),
      profileId = localStorage.getItem("alocine_profile");
    if (!token || !profileId) return;
    fetch(`${API}/api/progress/media/${id}?profile_id=${profileId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((value) => {
        if (value?.item) {
          setResume(value.item);
          setSeason(Number(value.item.season || 1));
        }
      })
      .catch(() => {});
  }, [id]);
  useEffect(() => {
    const token = localStorage.getItem("alocine_token"),
      profileId = localStorage.getItem("alocine_profile");
    if (!token || !profileId) {
      setEpisodeProgress({});
      return;
    }
    fetch(
      `${API}/api/progress/media/${id}/episodes?profile_id=${profileId}&season=${season}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((value) =>
        setEpisodeProgress(
          Object.fromEntries(
            (value?.items || []).map((item) => [Number(item.episode), item]),
          ),
        ),
      )
      .catch(() => setEpisodeProgress({}));
  }, [id, season, playing]);
  useEffect(() => {
    const controller = new AbortController();
    setDetail(null);
    setError("");
    publicMedia(id, season)
      .then(setDetail)
      .catch(() => setError("Cette fiche est momentanément indisponible."));
    return () => controller.abort();
  }, [id, season]);
  if (error)
    return (
      <div className="state error">
        {error}
        <button onClick={onBack}>
          <ArrowLeft /> Retour au catalogue
        </button>
      </div>
    );
  if (!detail)
    return (
      <div className="state">
        <Sparkles className="spin" /> Chargement de la fiche…
      </div>
    );
  const media = detail.media,
    seasonCount = Number(media.seasons || 1),
    categories = media.categories || [];
  const streamFor = (episode) => {
    const seasonKeys = [String(season), String(season).padStart(2, "0")];
    const episodeKeys = [String(episode), String(episode).padStart(2, "0")];
    for (const lang of [language, "fr", "vo"]) {
      for (const seasonKey of seasonKeys) {
        for (const episodeKey of episodeKeys) {
          const stream = detail.streams?.[lang]?.[seasonKey]?.[episodeKey];
          if (stream?.url) return stream;
        }
      }
    }
    return null;
  };
  const exactStreamFor = (episode, lang) => {
    for (const seasonKey of [String(season), String(season).padStart(2, "0")])
      for (const episodeKey of [
        String(episode),
        String(episode).padStart(2, "0"),
      ]) {
        const stream = detail.streams?.[lang]?.[seasonKey]?.[episodeKey];
        if (stream?.url) return stream;
      }
    return null;
  };
  const movieStream =
    detail.streams?.[language]?.movie?.[0] ||
    detail.streams?.fr?.movie?.[0] ||
    detail.streams?.vo?.movie?.[0];
  const playerEpisodes = detail.episodes.map((episode, index) => ({
    index,
    key: `${id}_${season}_${episode.episode}`,
    url: streamFor(episode.episode)?.url,
    sourceName: streamFor(episode.episode)?.name || "",
    sources: {
      fr: exactStreamFor(episode.episode, "fr")?.url,
      vo: exactStreamFor(episode.episode, "vo")?.url,
    },
    title: episode.name || `Épisode ${episode.episode}`,
    episode,
    mediaId: id,
    season,
    episodeNumber: episode.episode,
    mediaTitle: title(media),
    poster: media.posters?.large || image(media),
    playbackLanguage: language,
    resumePosition:
      Number(resume?.season) === season &&
      Number(resume?.episode) === Number(episode.episode)
        ? resume.position
        : undefined,
  }));
  const movieItem = {
    index: 0,
    key: `${id}_movie`,
    url: movieStream?.url,
    sourceName: movieStream?.name || "",
    sources: {
      fr: detail.streams?.fr?.movie?.[0]?.url,
      vo: detail.streams?.vo?.movie?.[0]?.url,
    },
    title: title(media),
    mediaId: id,
    season: 1,
    episodeNumber: 1,
    mediaTitle: title(media),
    poster: media.posters?.large || image(media),
    playbackLanguage: language,
    resumePosition: resume?.position,
  };
  const resumeItem =
    detail.isSeries && Number(resume?.season) === season
      ? playerEpisodes.find(
          (item) => Number(item.episodeNumber) === Number(resume?.episode),
        )
      : null;
  const play = (item) =>
    item?.url
      ? setPlaying(item)
      : alert("Aucune source vidéo disponible dans cette langue.");
  return (
    <div className="detail-page">
      <div className="detail-nav">
        <button onClick={onBack} title="Retour">
          <ArrowLeft />
        </button>
        <button className="detail-brand" onClick={onBack}>
          <i>K</i>
          <span>Knockturn Alley</span>
        </button>
        <nav>
          <button onClick={onBack}>
            <Home />
            Accueil
          </button>
          <button onClick={onHistory}>
            <History />
            Historique
          </button>
        </nav>
        <label className="search">
          <Search />
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Rechercher un titre…"
          />
        </label>
        <button
          className="mobile-history"
          title="Historique"
          onClick={onHistory}
        >
          <History />
        </button>
        <button className="avatar" onClick={onProfile}>
          {profile ? <ProfileAvatar avatar={profile.avatar} /> : "?"}
        </button>
      </div>
      <section
        className="detail-hero"
        style={{
          backgroundImage: `url("${media.posters?.small || image(media, true)}")`,
        }}
      >
        <div className="detail-filter" />
        <div className="detail-copy">
          <div className="eyebrow">
            <span />
            {detail.isSeries ? "SÉRIE ORIGINALE" : "FILM"}
          </div>
          <h1>{title(media)}</h1>
          <div className="detail-meta">
            <b>
              <Star fill="currentColor" />{" "}
              {media.rating || media.vote_average || "Nouveau"}
            </b>
            <span>{media.year || ""}</span>
            {detail.isSeries && (
              <span>
                {seasonCount} saison{seasonCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="genres">
            {categories.map((c, i) => (
              <span key={i}>{c.name || c}</span>
            ))}
          </div>
          <p>
            {media.overview ||
              media.description ||
              "Découvrez ce titre dans votre cinémathèque."}
          </p>
          <div className="buttons">
            <button
              className="primary"
              onClick={() =>
                play(
                  detail.isSeries ? resumeItem || playerEpisodes[0] : movieItem,
                )
              }
            >
              <Play fill="currentColor" />
              {resume ? "Reprendre" : "Regarder"}
            </button>
            <button
              className="circle"
              title="Recommander à un ami"
              onClick={() =>
                onRecommend({
                  media_id: Number(id),
                  media_type: detail.isSeries ? "tv" : "movie",
                  title: title(media),
                  poster: media.posters?.large || image(media),
                })
              }
            >
              <Plus />
            </button>
          </div>
        </div>
      </section>
      <main className="detail-content">
        <div className="detail-main">
          <div className="detail-toolbar">
            <h2>{detail.isSeries ? "Épisodes" : "Lecture"}</h2>
            <div className="language">
              <button
                className={language === "fr" ? "selected" : ""}
                onClick={() => setLanguage("fr")}
              >
                VF
              </button>
              <button
                className={language === "vo" ? "selected" : ""}
                onClick={() => setLanguage("vo")}
              >
                VO
              </button>
            </div>
          </div>
          {detail.isSeries ? (
            <>
              <div className="seasons">
                {Array.from({ length: seasonCount }, (_, i) => i + 1).map(
                  (n) => (
                    <button
                      className={season === n ? "selected" : ""}
                      onClick={() => setSeason(n)}
                      key={n}
                    >
                      Saison {n}
                    </button>
                  ),
                )}
              </div>
              <div className="episodes">
                {detail.episodes.map((episode, i) => {
                  const watched = episodeProgress[Number(episode.episode)],
                    completed = Boolean(watched?.completed),
                    percent = completed
                      ? 100
                      : watched?.duration
                        ? Math.min(
                            100,
                            (watched.position / watched.duration) * 100,
                          )
                        : 0;
                  return (
                    <button
                      className={`episode ${completed ? "watched" : watched?.position ? "in-progress" : ""}`}
                      key={episode.id || i}
                      onClick={() => play(playerEpisodes[i])}
                    >
                      <div className="episode-image">
                        <img src={episode.poster || fallback} />
                        <span>
                          <Play fill="currentColor" />
                        </span>
                        {completed && <b className="watched-badge">✓ Vu</b>}
                        {percent > 0 && (
                          <i className="episode-progress">
                            <b style={{ width: `${percent}%` }} />
                          </i>
                        )}
                      </div>
                      <div>
                        <small>
                          ÉPISODE {episode.episode || i + 1}{" "}
                          {completed
                            ? "· TERMINÉ"
                            : watched?.position
                              ? "· EN COURS"
                              : ""}
                        </small>
                        <h3>{episode.name || `Épisode ${i + 1}`}</h3>
                        <p>{episode.overview || "Aucun résumé disponible."}</p>
                        <em>
                          <Clock />
                          {completed
                            ? "Épisode terminé"
                            : watched?.position
                              ? `${Math.floor(watched.position / 60)} min regardées sur ${episode.runtime?.minutes || Math.ceil(watched.duration / 60)} min`
                              : episode.runtime?.human || ""}
                        </em>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <button className="movie-play" onClick={() => play(movieItem)}>
              <Play fill="currentColor" />
              <div>
                <strong>Lancer le film</strong>
                <span>{language.toUpperCase()}</span>
              </div>
            </button>
          )}
        </div>
        <aside>
          <h3>À propos</h3>
          <dl>
            <dt>Type</dt>
            <dd>{detail.isSeries ? "Série" : "Film"}</dd>
            <dt>Genres</dt>
            <dd>
              {categories.map((c) => c.name || c).join(", ") || "Non renseigné"}
            </dd>
            <dt>Langue</dt>
            <dd>{language.toUpperCase()}</dd>
          </dl>
        </aside>
      </main>
      {playing && (
        <Player
          item={playing}
          episodes={detail.isSeries ? playerEpisodes : []}
          onPlayEpisode={setPlaying}
          onClose={() => setPlaying(null)}
        />
      )}
    </div>
  );
}

const ProfileAvatar = ({ avatar = 0, className = "" }) => (
  <span className={`profile-avatar avatar-${avatar} ${className}`} />
);

function WhoWatching({ profiles, onSelect, onAdd, canClose = false, onClose }) {
  const [adding, setAdding] = useState(profiles.length === 0),
    [name, setName] = useState(""),
    [avatar, setAvatar] = useState(0);
  const create = async (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    const created = await onAdd({ name: name.trim(), avatar });
    if (!created) return;
    setAdding(false);
    setName("");
    onSelect(created);
  };
  return (
    <div className="watching">
      <div className="watching-panel">
        {canClose && (
          <button className="modal-close" onClick={onClose}>
            <X />
          </button>
        )}
        <small>PROFILS</small>
        <h1>Qui regarde ?</h1>
        {adding ? (
          <form className="profile-create" onSubmit={create}>
            <ProfileAvatar avatar={avatar} />
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nom du profil"
              maxLength="40"
              autoFocus
            />
            <div className="avatar-picker">
              {Array.from({ length: 6 }, (_, index) => (
                <button
                  type="button"
                  className={avatar === index ? "selected" : ""}
                  onClick={() => setAvatar(index)}
                  key={index}
                >
                  <ProfileAvatar avatar={index} />
                </button>
              ))}
            </div>
            <div>
              <button className="primary-profile">Créer le profil</button>
              {profiles.length > 0 && (
                <button type="button" onClick={() => setAdding(false)}>
                  Annuler
                </button>
              )}
            </div>
          </form>
        ) : (
          <div className="profile-grid">
            {profiles.map((profile) => (
              <button onClick={() => onSelect(profile)} key={profile.id}>
                <ProfileAvatar avatar={profile.avatar} />
                <strong>{profile.name}</strong>
              </button>
            ))}
            {profiles.length < 5 && (
              <button onClick={() => setAdding(true)}>
                <span className="profile-add">
                  <Plus />
                </span>
                <strong>Ajouter</strong>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileMenu({
  user,
  profile,
  onClose,
  onSwitch,
  onLogout,
  onUpdate,
  onFriends,
  onAdmin,
}) {
  const [editing, setEditing] = useState(false),
    [avatar, setAvatar] = useState(profile?.avatar || 0),
    [language, setLanguage] = useState(profile?.language || "fr"),
    [autoNext, setAutoNext] = useState(profile?.auto_next_seconds ?? 10),
    [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    await onUpdate({
      ...profile,
      avatar,
      language,
      auto_next_seconds: Number(autoNext),
    });
    setSaving(false);
    setEditing(false);
  };
  const autoNextLabel =
    Number(autoNext) === 0
      ? "Désactivé"
      : Number(autoNext) < 60
        ? `${autoNext} s`
        : `${Math.floor(autoNext / 60)} min ${autoNext % 60 ? `${autoNext % 60} s` : ""}`;
  return (
    <div
      className="account-modal"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="profile-menu">
        <button className="modal-close" onClick={onClose}>
          <X />
        </button>
        <ProfileAvatar avatar={editing ? avatar : profile?.avatar} />
        <h2>{profile?.name}</h2>
        <p>{user.email}</p>
        {editing ? (
          <div className="profile-settings">
            <label>Choisir un avatar</label>
            <div className="avatar-picker">
              {Array.from({ length: 6 }, (_, index) => (
                <button
                  type="button"
                  className={avatar === index ? "selected" : ""}
                  onClick={() => setAvatar(index)}
                  key={index}
                >
                  <ProfileAvatar avatar={index} />
                </button>
              ))}
            </div>
            <label>Langue de lecture par défaut</label>
            <div className="language-choice">
              <button
                className={language === "fr" ? "selected" : ""}
                onClick={() => setLanguage("fr")}
              >
                VF · Français
              </button>
              <button
                className={language === "vo" ? "selected" : ""}
                onClick={() => setLanguage("vo")}
              >
                VO · Originale
              </button>
            </div>
            <div className="auto-next-setting">
              <label>
                <span>Épisode suivant par défaut</span>
                <b>{autoNextLabel}</b>
              </label>
              <input
                type="range"
                min="0"
                max="600"
                step="5"
                value={autoNext}
                onChange={(event) => setAutoNext(Number(event.target.value))}
              />
              <div>
                <small>Désactivé</small>
                <small>10 min</small>
              </div>
              <p>
                Le compte à rebours de 10 secondes commencera à ce moment avant
                la fin. Chaque série peut garder son propre réglage.
              </p>
            </div>
            <button
              className="profile-action primary-profile"
              disabled={saving}
              onClick={save}
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button
              className="profile-action"
              onClick={() => setEditing(false)}
            >
              Annuler
            </button>
          </div>
        ) : (
          <>
            <div className="profile-preference">
              Langue : <b>{profile?.language === "vo" ? "VO" : "VF"}</b> ·
              Épisode suivant :{" "}
              <b>
                {profile?.auto_next_seconds === 0
                  ? "désactivé"
                  : `${profile?.auto_next_seconds ?? 10} s`}
              </b>
            </div>
            <button className="profile-action" onClick={() => setEditing(true)}>
              Modifier le profil
            </button>
            <button className="profile-action" onClick={onSwitch}>
              Changer de profil
            </button>
            <button className="profile-action" onClick={onFriends}>
              <Users /> Mes amis
            </button>
            {user?.is_superadmin && (
              <button
                className="profile-action admin-action"
                onClick={onAdmin}
              >
                Administration
              </button>
            )}
            <button className="profile-action danger" onClick={onLogout}>
              Se déconnecter
            </button>
          </>
        )}
      </section>
    </div>
  );
}

function AuthModal({ onClose, onAuthenticated }) {
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(
        `${API}/api/auth/${register ? "register" : "login"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: form.get("email"),
            password: form.get("password"),
            name: form.get("name"),
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok)
        throw Error(payload.detail || "Authentification impossible");
      localStorage.setItem("alocine_token", payload.token);
      onAuthenticated(payload.user);
      onClose();
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="account-modal"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <form onSubmit={submit}>
        <button type="button" className="modal-close" onClick={onClose}>
          <X />
        </button>
        <small>VOTRE ESPACE</small>
        <h2>{register ? "Créer un compte" : "Bon retour parmi nous"}</h2>
        <p>
          Synchronisez votre historique et reprenez chaque épisode au bon
          moment.
        </p>
        {register && (
          <label>
            Nom
            <input name="name" required minLength="2" autoComplete="name" />
          </label>
        )}
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Mot de passe
          <input
            name="password"
            type="password"
            required
            minLength="8"
            autoComplete={register ? "new-password" : "current-password"}
          />
        </label>
        {error && <div className="form-error">{error}</div>}
        <button className="auth-submit" disabled={busy}>
          {busy ? "Patientez…" : register ? "Créer mon compte" : "Se connecter"}
        </button>
        <button
          type="button"
          className="auth-switch"
          onClick={() => {
            setRegister((value) => !value);
            setError("");
          }}
        >
          {register ? "J’ai déjà un compte" : "Créer un compte"}
        </button>
      </form>
    </div>
  );
}

function AccessGate({ onAuthenticated }) {
  const invitationParams = new URLSearchParams(window.location.search),
    invitationCode = invitationParams.get("invite") || "",
    invitationEmail = invitationParams.get("email") || "",
    [mode, setMode] = useState(invitationCode ? "register" : "request"),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true);
    setError("");
    setNotice("");
    const form = new FormData(formElement);
    try {
      if (mode === "request") {
        const response = await fetch(`${API}/api/access/request`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: form.get("email"),
              message: form.get("message"),
              referral_code: "",
            }),
          }),
          value = await response.json();
        if (!response.ok) throw Error(value.detail || "Demande impossible");
        setNotice(
          "Votre hibou est parti. Vous recevrez bientôt votre code d’invitation.",
        );
        formElement.reset();
      } else {
        const response = await fetch(
            `${API}/api/auth/${mode === "register" ? "register" : "login"}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: form.get("email"),
                password: form.get("password"),
                name: form.get("name"),
                invite_code: form.get("invite_code"),
              }),
            },
          ),
          value = await response.json();
        if (!response.ok) throw Error(value.detail || "Connexion impossible");
        localStorage.setItem("alocine_token", value.token);
        onAuthenticated(value.user);
      }
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="access-gate">
      <div className="gate-glow" />
      <section>
        <div className="gate-brand">
          <i>K</i>
          <span>Knockturn Alley</span>
        </div>
        <small>ACCÈS SUR INVITATION</small>
        <h1>
          {mode === "request"
            ? "La porte est protégée par un sortilège"
            : mode === "login"
              ? "Heureux de vous revoir"
              : "Prononcez la formule magique"}
        </h1>
        <p>
          {mode === "request"
            ? "Présentez-vous au ministere. Une invitation vous sera envoyée après validation."
            : mode === "login"
              ? "Connectez-vous pour rejoindre votre profil."
              : "On vous a confié la formule permettant d’ouvrir le passage ? Inscrivez-la ici sans attirer l’attention des Moldus."}
        </p>
        <form onSubmit={submit}>
          {mode === "register" && (
            <label>
              Nom
              <input name="name" required minLength="2" />
            </label>
          )}
          <label>
            Adresse email
            <input
              name="email"
              type="email"
              defaultValue={invitationEmail}
              required
            />
          </label>
          {mode === "request" ? (
            <>
              <label>
                Votre message
                <textarea
                  name="message"
                  rows="4"
                  placeholder="Dites-nous pourquoi vous souhaitez penetrer le passage"
                />
              </label>
            </>
          ) : (
            <>
              <label>
                Mot de passe
                <input name="password" type="password" required minLength="8" />
              </label>
              {mode === "register" && (
                <label>
                  Formule à prononcer <em>votre code de parrainage</em>
                  <input
                    name="invite_code"
                    defaultValue={invitationCode}
                    required
                    placeholder="KNOCK-XXXXXXXX"
                  />
                </label>
              )}
            </>
          )}
          {error && <div className="gate-message error">{error}</div>}
          {notice && <div className="gate-message success">{notice}</div>}
          <button className="gate-submit" disabled={busy}>
            {busy
              ? "Le hibou s’envole…"
              : mode === "request"
                ? "Demander une invitation"
                : mode === "login"
                  ? "Se connecter"
                  : "Ouvrir le passage"}
          </button>
        </form>
        <div className="gate-switch">
          {mode !== "request" && (
            <button onClick={() => setMode("request")}>
              Demander un accès
            </button>
          )}
          <button
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login"
              ? "On m’a confié la formule"
              : "J’ai déjà un compte"}
          </button>
          {mode === "request" && (
            <button onClick={() => setMode("register")}>
              Vous connaissez la formule pour ouvrir le passage ?
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

function AdminPanel({ onClose }) {
  const [data, setData] = useState({
      requests: [],
      invitations: [],
      users: [],
      dashboard: {},
    }),
    [tab, setTab] = useState("dashboard"),
    [error, setError] = useState(""),
    [created, setCreated] = useState(""),
    [mailNotice, setMailNotice] = useState("");
  const formatWatchTime = (seconds) => {
    const total = Math.max(0, Number(seconds) || 0),
      hours = Math.floor(total / 3600),
      minutes = Math.floor((total % 3600) / 60);
    if (hours >= 24) return `${Math.floor(hours / 24)} j ${hours % 24} h`;
    return hours ? `${hours} h ${minutes} min` : `${minutes} min`;
  };
  const token = localStorage.getItem("alocine_token"),
    headers = { Authorization: `Bearer ${token}` };
  const load = () =>
    fetch(`${API}/api/admin/access`, { headers })
      .then(async (response) => {
        const value = await response.json();
        if (!response.ok) throw Error(value.detail);
        setData(value);
      })
      .catch((reason) => setError(reason.message));
  useEffect(load, []);
  const action = async (url, options = {}) => {
    setError("");
    setMailNotice("");
    const response = await fetch(`${API}${url}`, {
        ...options,
        headers: { ...headers, ...options.headers },
      }),
      value = await response.json();
    if (!response.ok) {
      setError(value.detail || "Action impossible");
      return;
    }
    if (value.invitation) {
      setCreated(value.invitation.code);
      setMailNotice(
        value.mail_sent
          ? `Le hibou a bien été envoyé à ${value.invitation.email}.`
          : value.mail_error ||
              (value.invitation.email
                ? "Le code est prêt, mais aucun hibou n’a été envoyé."
                : "Code sans destinataire : transmettez-le manuellement."),
      );
    }
    load();
  };
  const create = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    action("/api/admin/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email") || null,
        max_uses: Number(form.get("max_uses") || 1),
        expires_hours: Number(form.get("expires_hours") || 168),
      }),
    });
    event.currentTarget.reset();
  };
  return (
    <div className="admin-shell">
      <header>
        <div>
          <small>SUPERADMIN</small>
          <h1>La salle des clés</h1>
        </div>
        <button onClick={onClose}>
          <X />
        </button>
      </header>
      <nav>
        {[
          ["dashboard", "Tableau de bord"],
          ["requests", "Demandes"],
          ["invitations", "Invitations"],
          ["users", "Membres"],
        ].map(([id, label]) => (
          <button
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
            key={id}
          >
            {label}
            {id !== "dashboard" && <b>{data[id]?.length || 0}</b>}
          </button>
        ))}
      </nav>
      {error && <div className="admin-error">{error}</div>}
      {mailNotice && <div className="created-code">{mailNotice}</div>}
      {created && (
        <div className="created-code">
          Code créé : <strong>{created}</strong>
          <button onClick={() => navigator.clipboard.writeText(created)}>
            Copier
          </button>
        </div>
      )}
      <main>
        {tab === "dashboard" && (
          <div className="admin-dashboard">
            <div className="admin-kpis">
              <article>
                <Users />
                <span>Membres inscrits</span>
                <strong>{data.dashboard?.members || 0}</strong>
              </article>
              <article>
                <Clock />
                <span>Temps de visionnage</span>
                <strong>{formatWatchTime(data.dashboard?.watch_seconds)}</strong>
              </article>
              <article>
                <Play />
                <span>Titres terminés</span>
                <strong>{data.dashboard?.completed_titles || 0}</strong>
              </article>
              <article>
                <Sparkles />
                <span>Actifs sur 7 jours</span>
                <strong>{data.dashboard?.active_profiles_7d || 0}</strong>
              </article>
            </div>
            <div className="admin-leaderboard">
              <div className="admin-dashboard-title">
                <div><small>CARTE DU MARAUDEUR</small><h2>Activité des membres</h2></div>
                <span>{data.users.length} sorcier{data.users.length > 1 ? "s" : ""}</span>
              </div>
              <div className="admin-member-grid">
                {[...data.users]
                  .sort((a, b) => Number(b.watch_seconds) - Number(a.watch_seconds))
                  .map((item, index) => (
                    <article className="admin-member-card" key={item.id}>
                      <div className="admin-member-rank">#{index + 1}</div>
                      <div className="admin-member-identity">
                        <i>{item.name?.[0]?.toUpperCase()}</i>
                        <div><strong>{item.name}</strong><span>{item.email}</span></div>
                      </div>
                      <div className="admin-member-stats">
                        <div><b>{formatWatchTime(item.watch_seconds)}</b><span>regardées</span></div>
                        <div><b>{item.movies_completed || 0}</b><span>films terminés</span></div>
                        <div><b>{item.episodes_completed || 0}</b><span>épisodes terminés</span></div>
                        <div><b>{item.episodes_in_progress || 0}</b><span>épisodes en cours</span></div>
                      </div>
                      <div className="admin-member-foot">
                        <span><UserPlus /> {item.referrals_count || 0} filleul{item.referrals_count > 1 ? "s" : ""} · {item.series_started || 0} série{item.series_started > 1 ? "s" : ""} suivie{item.series_started > 1 ? "s" : ""}</span>
                        <span>{item.last_activity ? `Actif le ${new Date(item.last_activity * 1000).toLocaleDateString("fr-FR")}` : "Aucune lecture"}</span>
                      </div>
                    </article>
                  ))}
              </div>
            </div>
          </div>
        )}
        {tab === "requests" && (
          <div className="admin-list">
            {data.requests.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.email}</strong>
                  <p>{item.message || "Aucun message"}</p>
                  <small>
                    Parrainage : {item.referral_code || "—"} · {item.status}
                  </small>
                </div>
                {item.status === "pending" && (
                  <aside>
                    <button
                      onClick={() =>
                        action(`/api/admin/requests/${item.id}/approve`, {
                          method: "POST",
                        })
                      }
                    >
                      Approuver
                    </button>
                    <button
                      className="danger"
                      onClick={() =>
                        action(`/api/admin/requests/${item.id}/reject`, {
                          method: "POST",
                        })
                      }
                    >
                      Refuser
                    </button>
                  </aside>
                )}
              </article>
            ))}
          </div>
        )}
        {tab === "invitations" && (
          <>
            <form className="invite-form" onSubmit={create}>
              <input
                name="email"
                type="email"
                placeholder="Email réservé (facultatif)"
              />
              <input
                name="max_uses"
                type="number"
                min="1"
                max="100"
                defaultValue="1"
              />
              <select name="expires_hours" defaultValue="168">
                <option value="24">24 heures</option>
                <option value="168">7 jours</option>
                <option value="720">30 jours</option>
              </select>
              <button>Créer une invitation</button>
            </form>
            <div className="admin-list">
              {data.invitations.map((item) => (
                <article key={item.id}>
                  <div>
                    <strong>{item.code}</strong>
                    <p>{item.email || "Code utilisable par tous"}</p>
                    <small>
                      {item.uses}/{item.max_uses} utilisation(s) ·{" "}
                      {item.active ? "Actif" : "Révoqué"}
                    </small>
                  </div>
                  {item.active === 1 && (
                    <button
                      className="danger"
                      onClick={() =>
                        action(`/api/admin/invitations/${item.id}`, {
                          method: "DELETE",
                        })
                      }
                    >
                      Révoquer
                    </button>
                  )}
                </article>
              ))}
            </div>
          </>
        )}
        {tab === "users" && (
          <div className="admin-list">
            {data.users.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.email}</p>
                  <small>
                    {item.is_superadmin
                      ? "Superadmin"
                      : item.is_blocked
                        ? "Bloqué"
                        : "Membre actif"}
                  </small>
                  <div className="admin-user-metrics">
                    <span>{formatWatchTime(item.watch_seconds)} regardées</span>
                    <span>{item.movies_completed || 0} films</span>
                    <span>{item.episodes_completed || 0} épisodes terminés</span>
                    <span>{item.episodes_in_progress || 0} épisodes en cours</span>
                    <span>{item.series_started || 0} séries suivies</span>
                    <span>{item.referrals_count || 0} filleuls</span>
                  </div>
                </div>
                {!item.is_superadmin && (
                  <button
                    className={item.is_blocked ? "" : "danger"}
                    onClick={() =>
                      action(`/api/admin/users/${item.id}/toggle-block`, {
                        method: "POST",
                      })
                    }
                  >
                    {item.is_blocked ? "Débloquer" : "Bloquer"}
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function FriendsModal({ onClose, onSelect }) {
  const [friends, setFriends] = useState([]),
    [recommendations, setRecommendations] = useState([]),
    [results, setResults] = useState([]),
    [query, setQuery] = useState(""),
    [friendHistory, setFriendHistory] = useState(null),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(true);
  const token = localStorage.getItem("alocine_token"),
    api = async (path, options = {}) => {
      const response = await fetch(`${API}${path}`, {
        ...options,
        headers: {
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      });
      const value = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(value.detail || "Opération impossible");
      return value;
    };
  const refresh = async () => {
    setLoading(true);
    try {
      const [friendData, recommendationData] = await Promise.all([
        api("/api/friends"),
        api("/api/recommendations"),
      ]);
      setFriends(friendData.items || []);
      setRecommendations(recommendationData.items || []);
    } catch (reason) {
      setMessage(reason.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    refresh();
  }, []);
  const search = async (event) => {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setMessage("");
    try {
      const value = await api(
        `/api/friends/search?q=${encodeURIComponent(query.trim())}`,
      );
      setResults(value.items || []);
    } catch (reason) {
      setMessage(reason.message);
    }
  };
  const action = async (path, options) => {
    setMessage("");
    try {
      await api(path, options);
      setResults([]);
      await refresh();
    } catch (reason) {
      setMessage(reason.message);
    }
  };
  const showHistory = async (friend) => {
    setMessage("");
    try {
      const value = await api(`/api/friends/${friend.id}/history`);
      setFriendHistory({ friend, items: value.items || [] });
    } catch (reason) {
      setMessage(reason.message);
    }
  };
  const accepted = friends.filter((friend) => friend.status === "accepted"),
    pending = friends.filter((friend) => friend.status === "pending");
  return (
    <div
      className="account-modal friends-modal"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section>
        <button className="modal-close" onClick={onClose}>
          <X />
        </button>
        <small>RÉSEAU DES SORCIERS</small>
        <h2>Mes amis</h2>
        <p className="friends-intro">
          Retrouvez vos proches, partagez vos découvertes et choisissez qui
          peut consulter votre historique.
        </p>
        <form className="friend-search" onSubmit={search}>
          <Search />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Email ou pseudo…"
          />
          <button>Rechercher</button>
        </form>
        {message && <p className="friends-message">{message}</p>}
        {results.length > 0 && (
          <div className="friend-results">
            {results.map((person) => (
              <article key={person.id}>
                <div className="friend-initial">{person.name[0]}</div>
                <div>
                  <strong>{person.name}</strong>
                  <span>{person.email}</span>
                </div>
                <button
                  disabled={Boolean(person.relation)}
                  onClick={() =>
                    action("/api/friends/request", {
                      method: "POST",
                      body: JSON.stringify({ user_id: person.id }),
                    })
                  }
                >
                  <UserPlus /> {person.relation ? "Déjà invité" : "Ajouter"}
                </button>
              </article>
            ))}
          </div>
        )}
        {loading ? (
          <div className="friends-empty"><Sparkles className="spin" /> Chargement…</div>
        ) : (
          <div className="friends-scroll">
            {pending.length > 0 && (
              <div className="friends-section">
                <h3>Invitations</h3>
                {pending.map((friend) => (
                  <article className="friend-card pending" key={friend.id}>
                    <div className="friend-initial">{friend.name[0]}</div>
                    <div><strong>{friend.name}</strong><span>{friend.incoming ? "Souhaite devenir votre ami" : "Invitation envoyée"}</span></div>
                    <div className="friend-card-actions">
                      {friend.incoming && (
                        <button onClick={() => action(`/api/friends/${friend.id}/accept`, { method: "POST" })}>Accepter</button>
                      )}
                      <button onClick={() => action(`/api/friends/${friend.id}`, { method: "DELETE" })}>{friend.incoming ? "Refuser" : "Annuler"}</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            <div className="friends-section">
              <h3>Amis ({accepted.length})</h3>
              {accepted.length ? accepted.map((friend) => (
                <article className="friend-card" key={friend.id}>
                  <div className="friend-initial">{friend.name[0]}</div>
                  <div className="friend-main">
                    <strong>{friend.name}</strong><span>{friend.email}</span>
                    <label className="history-permission">
                      <input type="checkbox" checked={friend.share_my_history} onChange={(event) => action(`/api/friends/${friend.id}/history-permission`, { method: "PUT", body: JSON.stringify({ allowed: event.target.checked }) })} />
                      {friend.share_my_history ? <Eye /> : <EyeOff />}
                      Autoriser mon historique
                    </label>
                  </div>
                  <div className="friend-card-actions">
                    <button disabled={!friend.can_view_history} onClick={() => showHistory(friend)}>Voir l’historique</button>
                    <button className="danger" onClick={() => action(`/api/friends/${friend.id}`, { method: "DELETE" })}>Retirer</button>
                  </div>
                </article>
              )) : <div className="friends-empty">Aucun ami pour le moment.</div>}
            </div>
            <div className="friends-section recommendations-section">
              <h3>Recommandations reçues ({recommendations.length})</h3>
              {recommendations.map((item) => (
                <article key={item.id} className="recommendation-card">
                  <img src={item.poster || fallback} alt="" />
                  <button onClick={() => onSelect(item.media_id)}>
                    <small>{item.sender_name} vous recommande</small>
                    <strong>{item.title}</strong>
                    {item.message && <span>« {item.message} »</span>}
                  </button>
                  <button className="recommendation-delete" onClick={() => action(`/api/recommendations/${item.id}`, { method: "DELETE" })}><X /></button>
                </article>
              ))}
            </div>
          </div>
        )}
        {friendHistory && (
          <div className="friend-history-panel">
            <button onClick={() => setFriendHistory(null)}><ArrowLeft /> Retour</button>
            <h3>Historique de {friendHistory.friend.name}</h3>
            {friendHistory.items.length ? friendHistory.items.map((item) => (
              <button key={`${item.profile_id}-${item.media_id}`} onClick={() => onSelect(item.media_id)}>
                <img src={item.poster || fallback} alt="" />
                <div><strong>{item.title}</strong><span>{item.profile_name} · S{item.season} E{item.episode}</span></div>
              </button>
            )) : <div className="friends-empty">Aucun historique partagé.</div>}
          </div>
        )}
      </section>
    </div>
  );
}

function RecommendModal({ media, onClose }) {
  const [friends, setFriends] = useState([]),
    [selected, setSelected] = useState(null),
    [message, setMessage] = useState(""),
    [status, setStatus] = useState("");
  useEffect(() => {
    const token = localStorage.getItem("alocine_token");
    fetch(`${API}/api/friends`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((value) => setFriends((value.items || []).filter((item) => item.status === "accepted")));
  }, []);
  const send = async () => {
    if (!selected) return;
    const token = localStorage.getItem("alocine_token"),
      response = await fetch(`${API}/api/recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...media, friend_id: selected, message }),
      }),
      value = await response.json().catch(() => ({}));
    if (!response.ok) return setStatus(value.detail || "Envoi impossible");
    setStatus("Le hibou a livré votre recommandation ✨");
    setTimeout(onClose, 900);
  };
  return (
    <div className="account-modal recommend-modal" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section>
        <button className="modal-close" onClick={onClose}><X /></button>
        <Send />
        <small>HIBOU EXPRESS</small><h2>Recommander</h2>
        <div className="recommend-media"><img src={media.poster || fallback} alt="" /><strong>{media.title}</strong></div>
        <div className="recommend-friends">
          {friends.map((friend) => <button className={selected === friend.id ? "selected" : ""} onClick={() => setSelected(friend.id)} key={friend.id}><span>{friend.name[0]}</span>{friend.name}</button>)}
        </div>
        {!friends.length && <p>Ajoutez d’abord un ami pour lui recommander ce titre.</p>}
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength="500" placeholder="Ajouter un petit message…" />
        {status && <p className="friends-message">{status}</p>}
        <button className="recommend-send" disabled={!selected} onClick={send}>Envoyer la recommandation</button>
      </section>
    </div>
  );
}

function HistoryModal({ profileId, onClose, onSelect }) {
  const [items, setItems] = useState([]),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const token = localStorage.getItem("alocine_token");
    fetch(`${API}/api/progress?profile_id=${profileId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((value) => setItems(value.items || []))
      .finally(() => setLoading(false));
  }, [profileId]);
  return (
    <div
      className="account-modal history-modal"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section>
        <button className="modal-close" onClick={onClose}>
          <X />
        </button>
        <small>CONTINUER À REGARDER</small>
        <h2>Votre historique</h2>
        {loading ? (
          <div className="history-empty">
            <Sparkles className="spin" /> Chargement…
          </div>
        ) : items.length ? (
          <div className="history-list">
            {items.map((item) => (
              <button
                key={`${item.media_id}-${item.season}-${item.episode}`}
                onClick={() => onSelect(item.media_id)}
              >
                <img src={item.poster || fallback} />
                <div>
                  <strong>{item.title}</strong>
                  <span>
                    S{item.season} · E{item.episode}{" "}
                    {item.episode_title && `· ${item.episode_title}`}
                  </span>
                  <i>
                    <b
                      style={{
                        width: `${item.duration ? Math.min(100, (item.position / item.duration) * 100) : 0}%`,
                      }}
                    />
                  </i>
                  <em>{Math.floor(item.position / 60)} min regardées</em>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="history-empty">
            Votre historique apparaîtra après le lancement d’une vidéo.
          </div>
        )}
      </section>
    </div>
  );
}

function SearchResultsModal({
  query,
  loading,
  error,
  results,
  onClose,
  onSelect,
}) {
  if (!query) return null;
  return (
    <div
      className="search-modal"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Résultats de recherche"
      >
        <div className="search-modal-head">
          <div>
            <small>RECHERCHE</small>
            <h2>
              {query.trim().length < 2
                ? "Continuez à saisir…"
                : `Résultats pour « ${query.trim()} »`}
            </h2>
          </div>
          <button aria-label="Fermer" onClick={onClose}>
            <X />
          </button>
        </div>
        {loading ? (
          <div className="search-status">
            <Sparkles className="spin" /> Recherche en cours…
          </div>
        ) : error ? (
          <div className="search-status error">{error}</div>
        ) : query.trim().length < 2 ? (
          <div className="search-status">
            Saisissez au moins deux caractères.
          </div>
        ) : results.length ? (
          <div className="result-grid">
            {results.map((item, i) => (
              <button
                className="card"
                key={`${item.type || "media"}-${item.id}-${i}`}
                onClick={() => onSelect(item)}
              >
                <img src={image(item)} alt="" />
                <div className="card-shade" />
                <div className="card-info">
                  <small>{item.type === "movie" ? "FILM" : "SÉRIE"}</small>
                  <strong>{title(item)}</strong>
                  <span>{item.year || item.release_year || ""}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="search-status">Aucun résultat trouvé.</div>
        )}
      </section>
    </div>
  );
}

function ExplorePage({
  onBack,
  onSelect,
  onHistory,
  onProfile,
  profile,
  query,
  onQuery,
}) {
  const [type, setType] = useState("tv"),
    [sort, setSort] = useState("best-rated"),
    [category, setCategory] = useState("all"),
    [categories, setCategories] = useState([]),
    [items, setItems] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [visible, setVisible] = useState(36);
  useEffect(() => {
    publicCategories()
      .then((value) =>
        setCategories(
          value
            .map((entry) => ({
              id: String(entry?.id ?? entry?.value ?? ""),
              name: entry?.name ?? entry?.label ?? entry?.title ?? "",
            }))
            .filter((entry) => entry.id && entry.name)
            .sort((a, b) => a.name.localeCompare(b.name, "fr")),
        ),
      )
      .catch(() => setCategories([]));
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setVisible(36);
    publicCatalog({
      type,
      sort,
      page: 1,
      perPage: 200,
      category,
      signal: controller.signal,
    })
      .then(setItems)
      .catch((reason) => {
        if (reason?.name !== "AbortError")
          setError("Le rayon demandé est momentanément inaccessible.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [type, sort, category]);
  const filtered = items;
  return (
    <div className="explore-page">
      <header>
        <button className="brand explore-brand" onClick={onBack}>
          <i>K</i>
          <span>
            Knockturn<small>Alley</small>
          </span>
        </button>
        <nav>
          <button onClick={onBack}>
            <Home />
            Accueil
          </button>
          <button className="active">
            <Compass />
            Explorer
          </button>
          <button onClick={onHistory}>
            <History />
            Historique
          </button>
        </nav>
        <label className="search">
          <Search />
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Rechercher un titre…"
          />
        </label>
        <button className="mobile-explore active" title="Explorer">
          <Compass />
        </button>
        <button
          className="mobile-history"
          title="Historique"
          onClick={onHistory}
        >
          <History />
        </button>
        <button className="avatar" onClick={onProfile}>
          {profile ? <ProfileAvatar avatar={profile.avatar} /> : "?"}
        </button>
      </header>
      <main className="explore-content">
        <div className="explore-heading">
          <span>LA SALLE SUR DEMANDE</span>
          <h1>Que voulez-vous regarder ?</h1>
          <p>
            Parcourez les rayons de la cinémathèque par catégorie et laissez la
            magie choisir la suite.
          </p>
        </div>
        <div className="explore-controls">
          <div className="explore-toggle">
            <button
              className={type === "tv" ? "selected" : ""}
              onClick={() => setType("tv")}
            >
              Séries
            </button>
            <button
              className={type === "movie" ? "selected" : ""}
              onClick={() => setType("movie")}
            >
              Films
            </button>
          </div>
          <div className="explore-toggle">
            <button
              className={sort === "best-rated" ? "selected" : ""}
              onClick={() => setSort("best-rated")}
            >
              Mieux notés
            </button>
            <button
              className={sort === "newest" ? "selected" : ""}
              onClick={() => setSort("newest")}
            >
              Nouveautés
            </button>
          </div>
        </div>
        {categories.length > 0 && (
          <div className="category-scroll">
            <button
              className={category === "all" ? "selected" : ""}
              onClick={() => setCategory("all")}
            >
              Tout
            </button>
            {categories.map((entry) => (
              <button
                className={category === entry.id ? "selected" : ""}
                onClick={() => setCategory(entry.id)}
                key={entry.id}
              >
                {entry.name}
              </button>
            ))}
          </div>
        )}
        {loading ? (
          <div className="explore-state">
            <Sparkles className="spin" /> Les étagères se réorganisent…
          </div>
        ) : error ? (
          <div className="explore-state error">{error}</div>
        ) : filtered.length ? (
          <>
            <div className="explore-grid">
              {filtered.slice(0, visible).map((item, index) => (
                <button
                  className="card"
                  onClick={() => onSelect(item)}
                  key={`${item.id}-${index}`}
                >
                  <img src={image(item)} alt="" loading="lazy" />
                  <div className="card-shade" />
                  <div className="card-info">
                    <small>{type === "movie" ? "FILM" : "SÉRIE"}</small>
                    <strong>{title(item)}</strong>
                    <span>{item.year || item.release_year || ""}</span>
                  </div>
                </button>
              ))}
            </div>
            {visible < filtered.length && (
              <button
                className="explore-more"
                onClick={() => setVisible((value) => value + 36)}
              >
                Découvrir davantage
              </button>
            )}
          </>
        ) : (
          <div className="explore-state">Aucun titre trouvé dans ce rayon.</div>
        )}
      </main>
    </div>
  );
}

function App() {
  const loadingSpell = useRef(
    loadingSpells[Math.floor(Math.random() * loadingSpells.length)],
  ).current;
  const initialMatch = location.pathname.match(/^\/media\/(\d+)/);
  const [mediaId, setMediaId] = useState(initialMatch?.[1] || null),
    [exploreOpen, setExploreOpen] = useState(location.pathname === "/explore");
  const [data, setData] = useState(null);
  const [hero, setHero] = useState(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [user, setUser] = useState(null),
    [authChecked, setAuthChecked] = useState(false),
    [inviteOnly, setInviteOnly] = useState(true),
    [profiles, setProfiles] = useState([]),
    [profile, setProfile] = useState(null),
    [authOpen, setAuthOpen] = useState(false),
    [historyOpen, setHistoryOpen] = useState(false),
    [friendsOpen, setFriendsOpen] = useState(false),
    [recommendMedia, setRecommendMedia] = useState(null),
    [profileOpen, setProfileOpen] = useState(false),
    [watchOpen, setWatchOpen] = useState(false),
    [adminOpen, setAdminOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([
      publicCatalog({ type: "tv", sort: "newest", perPage: 20 }),
      publicCatalog({ type: "movie", sort: "newest", perPage: 20 }),
      publicCatalog({ type: "tv", sort: "best-rated", perPage: 200 }),
      publicCatalog({ type: "movie", sort: "best-rated", perPage: 200 }),
    ])
      .then(([featuredSeries, featuredMovies, series, movies]) => {
        const featured = [...featuredSeries, ...featuredMovies],
          value = {
            featuredSeries,
            featuredMovies,
            series,
            movies,
            hero: featured[Math.floor(Math.random() * featured.length)] || null,
          };
        setData(value);
        setHero(value.hero);
      })
      .catch(() => setError("Impossible de charger le catalogue."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    fetch(`${API}/api/access/status`)
      .then((r) => r.json())
      .then((value) => setInviteOnly(Boolean(value.invite_only)))
      .catch(() => setInviteOnly(true));
    const token = localStorage.getItem("alocine_token");
    if (!token) {
      setAuthChecked(true);
      return;
    }
    fetch(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((value) => setUser(value.user))
      .catch(() => localStorage.removeItem("alocine_token"))
      .finally(() => setAuthChecked(true));
  }, []);
  useEffect(() => {
    if (!user) return;
    const validateSession = () => {
      const token = localStorage.getItem("alocine_token");
      if (!token) return;
      fetch(`${API}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((response) => {
        if (response.ok) return;
        localStorage.removeItem("alocine_token");
        localStorage.removeItem("alocine_profile");
        setUser(null);
        setProfile(null);
        setProfiles([]);
      });
    };
    const interval = window.setInterval(validateSession, 30_000),
      onVisibility = () => {
        if (document.visibilityState === "visible") validateSession();
      };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user]);
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("alocine_token");
    fetch(`${API}/api/profiles`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((value) => {
        const list = value.items || [];
        setProfiles(list);
        const saved = Number(localStorage.getItem("alocine_profile"));
        const active = list.find((item) => item.id === saved);
        if (active) {
          setProfile(active);
          localStorage.setItem("alocine_language", active.language || "fr");
        } else setWatchOpen(true);
      });
  }, [user]);
  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) {
      setResults([]);
      setSearchLoading(false);
      setSearchError("");
      return;
    }
    const controller = new AbortController();
    setSearchLoading(true);
    setSearchError("");
    const timer = setTimeout(async () => {
      try {
        setResults(await publicSearch(value, controller.signal));
      } catch (reason) {
        if (reason?.name !== "AbortError") {
          setResults([]);
          setSearchError("Impossible d’effectuer la recherche pour le moment.");
        }
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 600);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  useEffect(() => {
    if (!query) return;
    const close = (event) => {
      if (event.key === "Escape") setQuery("");
    };
    addEventListener("keydown", close);
    return () => removeEventListener("keydown", close);
  }, [query]);
  useEffect(() => {
    const pop = () => {
      setMediaId(location.pathname.match(/^\/media\/(\d+)/)?.[1] || null);
      setExploreOpen(location.pathname === "/explore");
    };
    addEventListener("popstate", pop);
    return () => removeEventListener("popstate", pop);
  }, []);
  const openDetail = (item) => {
    if (!item?.id) return;
    setQuery("");
    history.pushState({}, "", `/media/${item.id}`);
    setExploreOpen(false);
    setMediaId(String(item.id));
    scrollTo(0, 0);
  };
  const openExplore = () => {
    history.pushState({}, "", "/explore");
    setMediaId(null);
    setExploreOpen(true);
    scrollTo(0, 0);
  };
  const closeDetail = () => {
    history.pushState({}, "", "/");
    setMediaId(null);
    scrollTo(0, 0);
  };
  const selectProfile = (selected) => {
    localStorage.setItem("alocine_profile", selected.id);
    localStorage.setItem("alocine_language", selected.language || "fr");
    setProfile(selected);
    setWatchOpen(false);
    setProfileOpen(false);
  };
  const addProfile = async (body) => {
    const token = localStorage.getItem("alocine_token");
    const response = await fetch(`${API}/api/profiles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const value = await response.json();
    if (response.ok) {
      setProfiles((items) => [...items, value.profile]);
      return value.profile;
    }
    return null;
  };
  const updateProfile = async (updated) => {
    const token = localStorage.getItem("alocine_token");
    const response = await fetch(`${API}/api/profiles/${updated.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: updated.name,
        avatar: updated.avatar,
        language: updated.language,
        auto_next_seconds: updated.auto_next_seconds,
      }),
    });
    const value = await response.json();
    if (response.ok) {
      setProfiles((items) =>
        items.map((item) => (item.id === updated.id ? value.profile : item)),
      );
      selectProfile(value.profile);
    }
  };
  const logout = () => {
    localStorage.removeItem("alocine_token");
    localStorage.removeItem("alocine_profile");
    setUser(null);
    setProfile(null);
    setProfiles([]);
    setProfileOpen(false);
  };
  if (!authChecked)
    return (
      <div className="state">
        <Sparkles className="spin" /> Vérification du sceau magique…
      </div>
    );
  if (inviteOnly && !user) return <AccessGate onAuthenticated={setUser} />;
  if (adminOpen) return <AdminPanel onClose={() => setAdminOpen(false)} />;
  if (mediaId)
    return (
      <>
        <Detail
          id={mediaId}
          onBack={closeDetail}
          profile={profile}
          onProfile={() => (user ? setProfileOpen(true) : setAuthOpen(true))}
          query={query}
          onQuery={setQuery}
          onHistory={() =>
            user && profile ? setHistoryOpen(true) : setAuthOpen(true)
          }
          onRecommend={(media) =>
            user ? setRecommendMedia(media) : setAuthOpen(true)
          }
        />
        <SearchResultsModal
          query={query}
          loading={searchLoading}
          error={searchError}
          results={results}
          onClose={() => setQuery("")}
          onSelect={openDetail}
        />
        {authOpen && (
          <AuthModal
            onClose={() => setAuthOpen(false)}
            onAuthenticated={setUser}
          />
        )}{" "}
        {profileOpen && (
          <ProfileMenu
            user={user}
            profile={profile}
            onClose={() => setProfileOpen(false)}
            onSwitch={() => {
              setProfileOpen(false);
              setWatchOpen(true);
            }}
            onLogout={logout}
            onUpdate={updateProfile}
            onFriends={() => {
              setProfileOpen(false);
              setFriendsOpen(true);
            }}
            onAdmin={() => {
              setProfileOpen(false);
              setAdminOpen(true);
            }}
          />
        )}{" "}
        {watchOpen && (
          <WhoWatching
            profiles={profiles}
            onSelect={selectProfile}
            onAdd={addProfile}
            canClose={Boolean(profile)}
            onClose={() => setWatchOpen(false)}
          />
        )}{" "}
        {historyOpen && profile && (
          <HistoryModal
            profileId={profile.id}
            onClose={() => setHistoryOpen(false)}
            onSelect={(id) => {
              setHistoryOpen(false);
              openDetail({ id });
            }}
          />
        )}
        {friendsOpen && (
          <FriendsModal
            onClose={() => setFriendsOpen(false)}
            onSelect={(id) => {
              setFriendsOpen(false);
              openDetail({ id });
            }}
          />
        )}
        {recommendMedia && (
          <RecommendModal
            media={recommendMedia}
            onClose={() => setRecommendMedia(null)}
          />
        )}
      </>
    );
  if (exploreOpen)
    return (
      <>
        <ExplorePage
          onBack={() => {
            history.pushState({}, "", "/");
            setExploreOpen(false);
            scrollTo(0, 0);
          }}
          onSelect={openDetail}
          profile={profile}
          query={query}
          onQuery={setQuery}
          onProfile={() => (user ? setProfileOpen(true) : setAuthOpen(true))}
          onHistory={() =>
            user && profile ? setHistoryOpen(true) : setAuthOpen(true)
          }
        />
        <SearchResultsModal
          query={query}
          loading={searchLoading}
          error={searchError}
          results={results}
          onClose={() => setQuery("")}
          onSelect={openDetail}
        />
        {authOpen && (
          <AuthModal
            onClose={() => setAuthOpen(false)}
            onAuthenticated={setUser}
          />
        )}{" "}
        {profileOpen && (
          <ProfileMenu
            user={user}
            profile={profile}
            onClose={() => setProfileOpen(false)}
            onSwitch={() => {
              setProfileOpen(false);
              setWatchOpen(true);
            }}
            onLogout={logout}
            onUpdate={updateProfile}
            onFriends={() => {
              setProfileOpen(false);
              setFriendsOpen(true);
            }}
            onAdmin={() => {
              setProfileOpen(false);
              setAdminOpen(true);
            }}
          />
        )}{" "}
        {historyOpen && profile && (
          <HistoryModal
            profileId={profile.id}
            onClose={() => setHistoryOpen(false)}
            onSelect={(id) => {
              setHistoryOpen(false);
              openDetail({ id });
            }}
          />
        )}
        {friendsOpen && (
          <FriendsModal
            onClose={() => setFriendsOpen(false)}
            onSelect={(id) => {
              setFriendsOpen(false);
              openDetail({ id });
            }}
          />
        )}
      </>
    );
  if (loading)
    return (
      <div className="state">
        <Sparkles className="spin" /> {loadingSpell}
      </div>
    );
  if (error)
    return (
      <div className="state error">
        {error}
        <button onClick={() => location.reload()}>Réessayer</button>
      </div>
    );
  return (
    <div>
      <header>
        <a className="brand" href="#">
          <i>K</i>
          <span>
            Knockturn<small>Alley</small>
          </span>
        </a>
        <nav>
          <a className="active" href="#">
            <Home />
            Accueil
          </a>
          <button onClick={openExplore}>
            <Compass />
            Explorer
          </button>
          <a href="#series">Séries</a>
          <a href="#films">Films</a>
          <button
            onClick={() =>
              user && profile ? setHistoryOpen(true) : setAuthOpen(true)
            }
          >
            <History />
            Historique
          </button>
          <button onClick={() => (user ? setFriendsOpen(true) : setAuthOpen(true))}>
            <Users />
            Amis
          </button>
        </nav>
        <label className="search">
          <Search />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un titre…"
          />
        </label>
        <button
          className="mobile-explore"
          title="Explorer"
          onClick={openExplore}
        >
          <Compass />
        </button>
        <button
          className="mobile-history"
          title="Historique"
          onClick={() =>
            user && profile ? setHistoryOpen(true) : setAuthOpen(true)
          }
        >
          <History />
        </button>
        <button
          className="mobile-friends"
          title="Amis"
          onClick={() => (user ? setFriendsOpen(true) : setAuthOpen(true))}
        >
          <Users />
        </button>
        <button
          className="avatar"
          title={profile?.name || "Se connecter"}
          onClick={() => (user ? setProfileOpen(true) : setAuthOpen(true))}
        >
          {profile ? (
            <ProfileAvatar avatar={profile.avatar} />
          ) : (
            user?.name?.[0]?.toUpperCase() || "?"
          )}
        </button>
      </header>
      <>
        <section
          className="hero"
          style={{ backgroundImage: `url("${image(hero, true)}")` }}
        >
          <div className="hero-filter" />
          <div className="hero-copy">
            <div className="eyebrow">
              <span />À LA UNE · {hero?.type === "movie" ? "FILM" : "SÉRIE"}
            </div>
            <h1>{title(hero)}</h1>
            <p>
              {hero?.overview ||
                hero?.description ||
                "Une sélection choisie dans notre cinémathèque. Découvrez cette œuvre et laissez-vous emporter."}
            </p>
            <div className="meta">
              <b>★ {hero?.vote_average || hero?.rating || "Nouveau"}</b>
              <span>{hero?.year || hero?.release_year || ""}</span>
            </div>
            <div className="buttons">
              <button className="primary" onClick={() => openDetail(hero)}>
                <Play fill="currentColor" />
                Regarder
              </button>
              <button onClick={() => openDetail(hero)}>
                <Info />
                Plus d’infos
              </button>
            </div>
          </div>
          <div className="scroll-mark">
            DÉCOUVRIR
            <span />
          </div>
        </section>
        <main className="content">
          <div id="series">
            <Row
              heading="Séries incontournables"
              items={data.series}
              onSelect={openDetail}
            />
          </div>
          <div id="films">
            <Row
              heading="Films à ne pas manquer"
              items={data.movies}
              onSelect={openDetail}
            />
          </div>
          <Row
            heading="Nouveautés"
            items={[
              ...(data.featuredSeries || []),
              ...(data.featuredMovies || []),
            ]}
            onSelect={openDetail}
          />
        </main>
      </>
      {query && (
        <div
          className="search-modal"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setQuery("")
          }
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Résultats de recherche"
          >
            <div className="search-modal-head">
              <div>
                <small>RECHERCHE</small>
                <h2>
                  {query.trim().length < 2
                    ? "Continuez à saisir…"
                    : `Résultats pour « ${query.trim()} »`}
                </h2>
              </div>
              <button aria-label="Fermer" onClick={() => setQuery("")}>
                <X />
              </button>
            </div>
            {searchLoading ? (
              <div className="search-status">
                <Sparkles className="spin" /> Recherche en cours…
              </div>
            ) : searchError ? (
              <div className="search-status error">{searchError}</div>
            ) : query.trim().length < 2 ? (
              <div className="search-status">
                Saisissez au moins deux caractères.
              </div>
            ) : results.length ? (
              <div className="result-grid">
                {results.map((item, i) => (
                  <button
                    className="card"
                    key={`${item.type || "media"}-${item.id}-${i}`}
                    onClick={() => openDetail(item)}
                  >
                    <img src={image(item)} alt="" />
                    <div className="card-shade" />
                    <div className="card-info">
                      <small>{item.type === "movie" ? "FILM" : "SÉRIE"}</small>
                      <strong>{title(item)}</strong>
                      <span>{item.year || item.release_year || ""}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="search-status">Aucun résultat trouvé.</div>
            )}
          </section>
        </div>
      )}
      {authOpen && (
        <AuthModal
          onClose={() => setAuthOpen(false)}
          onAuthenticated={setUser}
        />
      )}
      {profileOpen && (
        <ProfileMenu
          user={user}
          profile={profile}
          onClose={() => setProfileOpen(false)}
          onSwitch={() => {
            setProfileOpen(false);
            setWatchOpen(true);
          }}
          onLogout={logout}
          onUpdate={updateProfile}
          onFriends={() => {
            setProfileOpen(false);
            setFriendsOpen(true);
          }}
          onAdmin={() => {
            setProfileOpen(false);
            setAdminOpen(true);
          }}
        />
      )}
      {watchOpen && (
        <WhoWatching
          profiles={profiles}
          onSelect={selectProfile}
          onAdd={addProfile}
          canClose={Boolean(profile)}
          onClose={() => setWatchOpen(false)}
        />
      )}
      {historyOpen && profile && (
        <HistoryModal
          profileId={profile.id}
          onClose={() => setHistoryOpen(false)}
          onSelect={(id) => {
            setHistoryOpen(false);
            openDetail({ id });
          }}
        />
      )}
      {friendsOpen && (
        <FriendsModal
          onClose={() => setFriendsOpen(false)}
          onSelect={(id) => {
            setFriendsOpen(false);
            openDetail({ id });
          }}
        />
      )}
      <footer>
        <span>Knockturn Alley</span>
        <small>Prototype React + FastAPI isolé de Laravel</small>
      </footer>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
