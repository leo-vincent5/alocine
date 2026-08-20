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
  Info,
  Maximize,
  Minimize,
  Play,
  Plus,
  Search,
  Settings,
  Sparkles,
  Star,
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

const API = import.meta.env.VITE_API_URL ?? "";
const PURSTREAM_API =
  import.meta.env.VITE_PURSTREAM_API || "https://api.purstream.store/api/v1";
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
    const lang = /\bVF\b/i.test(String(item.name || "")) ? "fr" : "vo";
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
    [fullscreen, setFullscreen] = useState(false);
  useEffect(
    () => setAudioLanguage(item?.playbackLanguage || "fr"),
    [item?.key],
  );
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
    const temporaryManifests = [];
    const resolvePlaybackUrl = async () => {
      if (!/\.m3u8(?:\?.*)?$/i.test(url)) return url;
      if (/\/master\.m3u8(?:\?.*)?$/i.test(url)) {
        const videoPlaylist = new URL("720p/playlist.m3u8", url).href;
        if (audioLanguage !== "vo") return videoPlaylist;
        const englishAudio = new URL("audio_en/playlist.m3u8", url).href;
        const synthetic = [
          "#EXTM3U",
          "#EXT-X-VERSION:3",
          `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="English",DEFAULT=YES,AUTOSELECT=YES,LANGUAGE="en",URI="${englishAudio}"`,
          '#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720,CODECS="avc1.640028,mp4a.40.2",AUDIO="audio"',
          videoPlaylist,
        ];
        const manifestUrl = URL.createObjectURL(
          new Blob([`${synthetic.join("\n")}\n`], {
            type: "application/vnd.apple.mpegurl",
          }),
        );
        temporaryManifests.push(manifestUrl);
        setManifestLanguages(["fr", "vo"]);
        return manifestUrl;
      }
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          referrerPolicy: "no-referrer",
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
        if (reason?.name !== "AbortError")
          setError(
            `Impossible d'analyser le manifeste maître (${reason?.message || "erreur inconnue"}). Tentative directe…`,
          );
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
        if (controller.signal.aborted) return;
        video.src = playbackUrl;
        video.load();
        tryPlay();
      });
    } else if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        backBufferLength: 60,
        manifestLoadingMaxRetry: 2,
        levelLoadingMaxRetry: 2,
        fragLoadingMaxRetry: 2,
        fragLoadingRetryDelay: 3000,
        fragLoadingMaxRetryTimeout: 15000,
      });
      hlsRef.current = hls;
      hls.on(Hls.Events.MEDIA_ATTACHED, async () => {
        const playbackUrl = await resolvePlaybackUrl();
        if (!controller.signal.aborted && hlsRef.current === hls)
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
          const limited = Number(status) === 429;
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

function Detail({ id, onBack, profile, onProfile, query, onQuery, onHistory }) {
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
            <button className="circle">
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
  const [adding, setAdding] = useState(false),
    [name, setName] = useState(""),
    [avatar, setAvatar] = useState(0);
  const create = async (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    await onAdd({ name: name.trim(), avatar });
    setAdding(false);
    setName("");
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
              <button type="button" onClick={() => setAdding(false)}>
                Annuler
              </button>
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

function ProfileMenu({ user, profile, onClose, onSwitch, onLogout, onUpdate }) {
  const [editing, setEditing] = useState(false),
    [admin, setAdmin] = useState(false),
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
  if (admin) return <AdminPanel onClose={() => setAdmin(false)} />;
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
            {user?.is_superadmin && (
              <button
                className="profile-action admin-action"
                onClick={() => setAdmin(true)}
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
  const [mode, setMode] = useState("request"),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      if (mode === "request") {
        const response = await fetch(`${API}/api/access/request`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: form.get("email"),
              message: form.get("message"),
              referral_code: form.get("referral_code"),
            }),
          }),
          value = await response.json();
        if (!response.ok) throw Error(value.detail || "Demande impossible");
        setNotice(
          "Votre hibou est parti. Vous recevrez bientôt votre code d’invitation.",
        );
        event.currentTarget.reset();
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
              : "Utiliser votre invitation"}
        </h1>
        <p>
          {mode === "request"
            ? "Présentez-vous au ministere. Une invitation vous sera envoyée après validation."
            : mode === "login"
              ? "Connectez-vous pour rejoindre votre profil."
              : "Votre code ouvre les portes de la cinémathèque."}
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
            <input name="email" type="email" required />
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
              <label>
                Formule magique pour forcer la porte ? <em>facultatif</em>
                <input
                  name="referral_code"
                  placeholder="La formule magique apprise par une personne peu recommandable ? "
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
                  Code d’invitation
                  <input
                    name="invite_code"
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
                  : "Créer mon compte"}
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
              ? "J’ai un code d’invitation"
              : "J’ai déjà un compte"}
          </button>
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
    }),
    [tab, setTab] = useState("requests"),
    [error, setError] = useState(""),
    [created, setCreated] = useState("");
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
    const response = await fetch(`${API}${url}`, {
        ...options,
        headers: { ...headers, ...options.headers },
      }),
      value = await response.json();
    if (!response.ok) {
      setError(value.detail || "Action impossible");
      return;
    }
    if (value.invitation) setCreated(value.invitation.code);
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
            <b>{data[id]?.length || 0}</b>
          </button>
        ))}
      </nav>
      {error && <div className="admin-error">{error}</div>}
      {created && (
        <div className="created-code">
          Code créé : <strong>{created}</strong>
          <button onClick={() => navigator.clipboard.writeText(created)}>
            Copier
          </button>
        </div>
      )}
      <main>
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
    if (response.ok) setProfiles((items) => [...items, value.profile]);
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
      <footer>
        <span>Knockturn Alley</span>
        <small>Prototype React + FastAPI isolé de Laravel</small>
      </footer>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
