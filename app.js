if (typeof document !== "undefined") {
  document.documentElement.classList.add("js");
}

export const TRACKS = Object.freeze([
  {
    slug: "curacao-radio-edit",
    title: "Curaçao (Radio Edit)",
    audio: "/soundcloud-growth-os/outreach-mp3/07%20Curacao/Curacao%20Radio%20Edit.mp3",
    cover: "assets/covers/curacao.png",
    coverType: "image/png",
    coverSize: "1400x1400",
    duration: 140.88
  },
  {
    slug: "carnival",
    title: "Carnival",
    audio: "/soundcloud-growth-os/outreach-mp3/06%20Carnival/Carnival.mp3",
    cover: "assets/covers/carnival.png",
    coverType: "image/png",
    coverSize: "1254x1254",
    duration: 212.24
  },
  {
    slug: "door-de-storm",
    title: "Door de Storm",
    audio: "/soundcloud-growth-os/outreach-mp3/01%20Door%20de%20Storm/Door%20de%20Storm.mp3",
    cover: "assets/covers/door-de-storm.png",
    coverType: "image/png",
    coverSize: "1254x1254",
    duration: 223
  },
  {
    slug: "strijd",
    title: "Strijd",
    audio: "/soundcloud-growth-os/outreach-mp3/02%20Strijd/Strijd.mp3",
    cover: "assets/covers/strijd.jpg",
    coverType: "image/jpeg",
    coverSize: "1400x1400",
    duration: 222.84
  },
  {
    slug: "geen-afscheid",
    title: "Geen Afscheid",
    audio: "/soundcloud-growth-os/outreach-mp3/03%20Geen%20Afscheid/Geen%20Afscheid.mp3",
    cover: "assets/covers/geen-afscheid.png",
    coverType: "image/png",
    coverSize: "1400x1400",
    duration: 227.12
  },
  {
    slug: "weekend-mode",
    title: "Weekend Mode",
    audio: "/soundcloud-growth-os/outreach-mp3/04%20Weekend%20Mode/Weekend%20Mode.mp3",
    cover: "assets/covers/weekend-mode.png",
    coverType: "image/png",
    coverSize: "1400x1400",
    duration: 173.08
  },
  {
    slug: "summer-time",
    title: "Summer Time",
    audio: "/soundcloud-growth-os/outreach-mp3/05%20Summer%20Time/Summer%20Time.mp3",
    cover: "assets/covers/summer-time.png",
    coverType: "image/png",
    coverSize: "1400x1400",
    duration: 141.16
  }
]);

const PLAY_COUNT_STORAGE_KEY = "marcsmusicCountedTracks";

export function formatTime(value) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const totalSeconds = Math.floor(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes + ":" + String(seconds).padStart(2, "0");
}

export function formatPlayCount(value) {
  const plays = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  return new Intl.NumberFormat("nl-NL").format(plays) + " keer beluisterd";
}

export function normalizeTrackIndex(index, trackCount = TRACKS.length) {
  if (!Number.isInteger(index) || trackCount < 1) return 0;
  return ((index % trackCount) + trackCount) % trackCount;
}

function setupReveals() {
  const revealItems = [...document.querySelectorAll("[data-reveal]")];
  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
  );

  revealItems.forEach((item) => observer.observe(item));
}

function setupPlayer() {
  const player = document.querySelector("[data-player]");
  const audio = document.querySelector("[data-audio]");
  const cover = document.querySelector("[data-cover]");
  const title = document.querySelector("[data-track-title]");
  const meta = document.querySelector("[data-track-meta]");
  const playButton = document.querySelector("[data-play]");
  const previousButton = document.querySelector("[data-previous]");
  const nextButton = document.querySelector("[data-next]");
  const progress = document.querySelector("[data-progress]");
  const currentTimeOutput = document.querySelector("[data-current-time]");
  const durationOutput = document.querySelector("[data-duration]");
  const volume = document.querySelector("[data-volume]");
  const status = document.querySelector("[data-status]");
  const trackButtons = [...document.querySelectorAll("[data-track-index]")];

  if (
    !player ||
    !audio ||
    !cover ||
    !title ||
    !meta ||
    !playButton ||
    !previousButton ||
    !nextButton ||
    !progress ||
    !currentTimeOutput ||
    !durationOutput ||
    !volume ||
    !status ||
    trackButtons.length !== TRACKS.length
  ) {
    return;
  }

  let currentIndex = 0;
  let coverChangeToken = 0;
  let playCounts = Object.fromEntries(TRACKS.map((track) => [track.slug, 0]));
  const countedTrackIds = new Set(loadCountedTrackIds());

  function setStatus(message) {
    status.textContent = message;
  }

  function setRangeFill(input, value, maximum) {
    const percentage = maximum > 0 ? Math.min(100, Math.max(0, (value / maximum) * 100)) : 0;
    input.style.setProperty("--range-fill", percentage + "%");
  }

  function loadCountedTrackIds() {
    try {
      const storedIds = JSON.parse(window.sessionStorage.getItem(PLAY_COUNT_STORAGE_KEY) || "[]");
      if (!Array.isArray(storedIds)) return [];
      const validTrackIds = new Set(TRACKS.map((track) => track.slug));
      return storedIds.filter((trackId) => validTrackIds.has(trackId));
    } catch {
      return [];
    }
  }

  function updatePlayCount(trackId, value) {
    const plays = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
    playCounts[trackId] = plays;
    const countNode = document.querySelector(`[data-row-plays="${trackId}"]`);
    if (countNode) countNode.textContent = formatPlayCount(plays);
  }

  function mergePlayCounts(nextCounts) {
    if (!nextCounts || typeof nextCounts !== "object") return;
    TRACKS.forEach((track) => {
      const value = nextCounts[track.slug];
      if (Number.isFinite(value) && value >= 0) playCounts[track.slug] = Math.floor(value);
    });
  }

  function syncPlayCounts() {
    TRACKS.forEach((track) => updatePlayCount(track.slug, playCounts[track.slug]));
  }

  async function loadPlayCounts() {
    try {
      const response = await fetch("/api/tracks/plays", {
        headers: { accept: "application/json" },
        cache: "no-store"
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Tellers laden mislukt");
      mergePlayCounts(payload.plays);
    } catch {
      // The player remains usable with zero counters when the live endpoint is unavailable.
    }
    syncPlayCounts();
  }

  function rememberCountedTrack(trackId) {
    countedTrackIds.add(trackId);
    try {
      window.sessionStorage.setItem(PLAY_COUNT_STORAGE_KEY, JSON.stringify([...countedTrackIds]));
    } catch {
      // Session de-duplication is best-effort when storage is unavailable.
    }
  }

  async function recordCurrentTrackPlay() {
    const track = TRACKS[currentIndex];
    if (!track || countedTrackIds.has(track.slug)) return;

    const previousCount = playCounts[track.slug] || 0;
    rememberCountedTrack(track.slug);
    updatePlayCount(track.slug, previousCount + 1);

    try {
      const response = await fetch("/api/tracks/plays", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trackId: track.slug })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Teller bijwerken mislukt");
      mergePlayCounts(payload.allPlays);
      syncPlayCounts();
    } catch {
      countedTrackIds.delete(track.slug);
      try {
        window.sessionStorage.setItem(PLAY_COUNT_STORAGE_KEY, JSON.stringify([...countedTrackIds]));
      } catch {
        // Ignore storage failures and keep playback available.
      }
      updatePlayCount(track.slug, previousCount);
    }
  }

  function updatePlayState(isPlaying) {
    const track = TRACKS[currentIndex];
    player.classList.toggle("is-playing", isPlaying);
    playButton.setAttribute(
      "aria-label",
      track.title + (isPlaying ? " pauzeren" : " afspelen")
    );
  }

  function updateMediaSession(track) {
    if (!("mediaSession" in navigator) || !("MediaMetadata" in window)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: "MarcsMusic",
      album: "MarcsMusic",
      artwork: [
        {
          src: new URL(track.cover, window.location.href).href,
          sizes: track.coverSize,
          type: track.coverType
        }
      ]
    });
  }

  async function swapCover(track, token) {
    cover.classList.add("is-changing");
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    if (token !== coverChangeToken) return;
    cover.src = track.cover;

    try {
      await cover.decode();
    } catch {
      // The image remains usable even when decode() is unavailable or interrupted.
    }

    if (token === coverChangeToken) cover.classList.remove("is-changing");
  }

  function renderTrack(track, index) {
    title.textContent = track.title;
    meta.textContent = "MarcsMusic · track " + (index + 1) + " van " + TRACKS.length;
    progress.max = String(track.duration);
    progress.value = "0";
    currentTimeOutput.textContent = "0:00";
    durationOutput.textContent = formatTime(track.duration);
    setRangeFill(progress, 0, track.duration);
    document.title = track.title + " — MarcsMusic";

    trackButtons.forEach((button, buttonIndex) => {
      if (buttonIndex === index) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });

    updatePlayState(false);
    updateMediaSession(track);
    coverChangeToken += 1;
    void swapCover(track, coverChangeToken);
  }

  async function playCurrent() {
    try {
      await audio.play();
      setStatus(TRACKS[currentIndex].title + " wordt afgespeeld.");
    } catch {
      updatePlayState(false);
      setStatus("Afspelen is geblokkeerd. Druk nogmaals op de afspeelknop.");
    }
  }

  function selectTrack(index, shouldPlay = false) {
    currentIndex = normalizeTrackIndex(index);
    const track = TRACKS[currentIndex];

    audio.pause();
    audio.src = track.audio;
    audio.load();
    renderTrack(track, currentIndex);

    if (shouldPlay) void playCurrent();
    else setStatus(track.title + " is geselecteerd.");
  }

  function togglePlayback() {
    if (audio.paused) void playCurrent();
    else audio.pause();
  }

  playButton.addEventListener("click", togglePlayback);
  previousButton.addEventListener("click", () => selectTrack(currentIndex - 1, true));
  nextButton.addEventListener("click", () => selectTrack(currentIndex + 1, true));

  trackButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number.parseInt(button.dataset.trackIndex || "", 10);
      if (Number.isInteger(index)) selectTrack(index, true);
    });
  });

  audio.addEventListener("playing", () => {
    updatePlayState(true);
    void recordCurrentTrackPlay();
  });
  audio.addEventListener("pause", () => updatePlayState(false));
  audio.addEventListener("waiting", () => setStatus("De track wordt geladen."));
  audio.addEventListener("ended", () => selectTrack(currentIndex + 1, true));
  audio.addEventListener("error", () => {
    updatePlayState(false);
    setStatus("Deze track kon niet worden geladen. Probeer een ander nummer.");
  });

  audio.addEventListener("loadedmetadata", () => {
    const duration = Number.isFinite(audio.duration) ? audio.duration : TRACKS[currentIndex].duration;
    progress.max = String(duration);
    durationOutput.textContent = formatTime(duration);
    setRangeFill(progress, audio.currentTime, duration);
  });

  audio.addEventListener("timeupdate", () => {
    const duration = Number.parseFloat(progress.max) || TRACKS[currentIndex].duration;
    progress.value = String(audio.currentTime);
    currentTimeOutput.textContent = formatTime(audio.currentTime);
    setRangeFill(progress, audio.currentTime, duration);
  });

  progress.addEventListener("input", () => {
    const nextTime = Number.parseFloat(progress.value);
    if (!Number.isFinite(nextTime)) return;
    audio.currentTime = nextTime;
    currentTimeOutput.textContent = formatTime(nextTime);
    setRangeFill(progress, nextTime, Number.parseFloat(progress.max));
  });

  volume.addEventListener("input", () => {
    const nextVolume = Number.parseFloat(volume.value);
    if (!Number.isFinite(nextVolume)) return;
    audio.volume = nextVolume;
    setRangeFill(volume, nextVolume, 1);
    try {
      window.localStorage.setItem("marcsmusic-volume", String(nextVolume));
    } catch {
      // Local storage is optional; playback remains functional without it.
    }
  });

  try {
    const savedVolume = Number.parseFloat(window.localStorage.getItem("marcsmusic-volume") || "");
    if (Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 1) {
      volume.value = String(savedVolume);
    }
  } catch {
    // Ignore storage restrictions in private or hardened browsing modes.
  }

  audio.volume = Number.parseFloat(volume.value);
  setRangeFill(volume, audio.volume, 1);

  if ("mediaSession" in navigator) {
    const handlers = {
      play: () => void playCurrent(),
      pause: () => audio.pause(),
      previoustrack: () => selectTrack(currentIndex - 1, true),
      nexttrack: () => selectTrack(currentIndex + 1, true),
      seekbackward: () => {
        audio.currentTime = Math.max(0, audio.currentTime - 10);
      },
      seekforward: () => {
        audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + 10);
      },
      seekto: (details) => {
        if (Number.isFinite(details.seekTime)) audio.currentTime = details.seekTime;
      }
    };

    Object.entries(handlers).forEach(([action, handler]) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Some browsers expose Media Session but not every action.
      }
    });
  }

  void loadPlayCounts();

  const requestedTrack = new URLSearchParams(window.location.search).get("track");
  const requestedIndex = TRACKS.findIndex((track) => track.slug === requestedTrack);
  selectTrack(requestedIndex >= 0 ? requestedIndex : 0, false);
  audio.controls = false;
  audio.setAttribute("aria-hidden", "true");
  document.documentElement.classList.add("player-ready");
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  setupReveals();
  setupPlayer();
}
