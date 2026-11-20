(function () {
  "use strict";

  /* Change these values to adjust listening behavior for every test. */
  const CONFIG = {
    MAX_PLAYS: 2,
    DEFAULT_MODE: "exam",
    TIMER_MODE: "main", // "main" or "section"
    LISTENING_DURATION_MINUTES: 30
  };

  let activeSession = null;
  let sessionToken = 0;
  let preloadedAudios = [];
  let reviewSession = null;
  let audioContext = null;

  function formatTime(seconds) {
    const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = Math.floor(safeSeconds % 60);
    return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }

  function getSegments(question) {
    if (Array.isArray(question.audioSegments) && question.audioSegments.length) {
      return question.audioSegments.map((segment, index) => ({
        speaker: segment.speaker || `speaker-${index + 1}`,
        label: segment.label || `Speaker ${index + 1}`,
        audio: segment.audio || "",
        text: segment.text || "",
        pauseAfter: Math.max(0, Number(segment.pauseAfter) || 0)
      }));
    }

    return [{
      speaker: "narrator",
      label: "Audio",
      audio: question.audio || "",
      text: question.script || question.question || "",
      pauseAfter: 0
    }];
  }

  function estimatedDuration(segment, speed = 1) {
    return Math.max(2, Array.from(segment.text || "").length * 0.13 / speed);
  }

  function japaneseVoices() {
    if (!("speechSynthesis" in window)) return [];
    return window.speechSynthesis.getVoices().filter((voice) => (
      voice.lang && voice.lang.toLowerCase().startsWith("ja")
    ));
  }

  function voiceForSpeaker(speaker) {
    const voices = japaneseVoices();
    if (!voices.length) return null;

    const preferredIndex = {
      narrator: 0,
      woman: 1,
      man: 2,
      clerk: 3,
      boy: 4,
      girl: 5
    }[speaker] || 0;
    return voices[preferredIndex % voices.length];
  }

  function pitchForSpeaker(speaker) {
    return {
      narrator: 0.95,
      woman: 1.12,
      man: 0.86,
      clerk: 1.02,
      boy: 1.2,
      girl: 1.25
    }[speaker] || 1;
  }

  function canStartPlay(session) {
    return session.mode === "practice" || session.playCount < session.maxPlays;
  }

  function playsLabel(session) {
    if (session.mode === "practice") {
      return `Unlimited plays · ${session.playCount} used`;
    }
    return `Plays left: ${Math.max(0, session.maxPlays - session.playCount)}`;
  }

  function totalDuration(session) {
    return session.durations.reduce((total, duration) => total + (Number(duration) || 0), 0);
  }

  function elapsedBefore(session, index) {
    return session.durations.slice(0, index).reduce((total, duration) => total + (Number(duration) || 0), 0);
  }

  function setNotice(session, message, tone = "info") {
    if (!session.refs.notice) return;
    session.refs.notice.textContent = message;
    session.refs.notice.className = `audio-notice audio-notice-${tone}`;
    session.refs.notice.hidden = !message;
  }

  function setSpeaker(session, index) {
    const segment = session.segments[index];
    if (session.refs.shadowing && window.JLPTShadowing) {
      window.JLPTShadowing.updateTarget(segment, session.durations[index]);
    }
    if (!segment || session.segments.length < 2) {
      session.refs.speaker.hidden = true;
      return;
    }

    session.refs.speaker.hidden = false;
    session.refs.speakerName.textContent = segment.label;
  }

  function updateProgress(session, localCurrent = 0) {
    if (!activeSession || activeSession.token !== session.token) return;
    const duration = totalDuration(session);
    const current = Math.min(duration, elapsedBefore(session, session.segmentIndex) + Math.max(0, localCurrent));
    session.currentPosition = current;
    session.refs.seek.max = duration || 1;
    if (!session.userSeeking) session.refs.seek.value = duration ? current : 0;
    session.refs.currentTime.textContent = formatTime(current);
    session.refs.duration.textContent = duration ? formatTime(duration) : "--:--";
  }

  function syncControls(session) {
    if (!activeSession || activeSession.token !== session.token) return;

    const cannotStart = !session.activePlay && !canStartPlay(session);
    session.refs.play.disabled = session.pending || cannotStart || session.shadowRecording;
    session.refs.replay.disabled = session.pending || !canStartPlay(session) || session.shadowRecording;
    session.refs.plays.textContent = playsLabel(session);
    session.refs.seek.disabled = session.mode !== "practice" || session.pending || !session.activePlay || session.shadowRecording;
    session.refs.mute.setAttribute("aria-pressed", String(session.muted));
    session.refs.mute.setAttribute("aria-label", session.muted ? "Unmute audio" : "Mute audio");
    session.refs.mute.textContent = session.muted ? "🔇" : "🔊";

    if (session.refs.previousLine) {
      const advancedDisabled = session.pending || !session.activePlay || session.shadowRecording;
      session.refs.previousLine.disabled = advancedDisabled || session.segmentIndex === 0;
      session.refs.nextLine.disabled = advancedDisabled || session.segmentIndex === session.segments.length - 1;
      session.refs.back.disabled = advancedDisabled;
      session.refs.forward.disabled = advancedDisabled;
      session.refs.repeatLine.disabled = advancedDisabled;
    }

    if (session.playing) {
      session.refs.playIcon.textContent = "❚❚";
      session.refs.playLabel.textContent = "Pause";
      session.refs.play.setAttribute("aria-label", "Pause listening dialogue");
    } else if (session.activePlay) {
      session.refs.playIcon.textContent = "▶";
      session.refs.playLabel.textContent = "Resume";
      session.refs.play.setAttribute("aria-label", "Resume listening dialogue");
    } else {
      session.refs.playIcon.textContent = "▶";
      session.refs.playLabel.textContent = cannotStart ? "Play limit reached" : "Play audio";
      session.refs.play.setAttribute("aria-label", cannotStart ? "Audio play limit reached" : "Play listening dialogue");
    }
  }

  function clearSpeechTimer(session) {
    if (session.speechTimer) window.clearInterval(session.speechTimer);
    session.speechTimer = null;
  }

  function clearAdvanceTimer(session) {
    if (session.advanceTimer) window.clearTimeout(session.advanceTimer);
    session.advanceTimer = null;
  }

  function stopSessionMedia(session) {
    clearSpeechTimer(session);
    clearAdvanceTimer(session);
    if (session.audio) session.audio.pause();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    session.speechPaused = false;
    session.speechForIndex = -1;
  }

  function finishPlay(session) {
    if (!activeSession || activeSession.token !== session.token) return;
    clearSpeechTimer(session);
    clearAdvanceTimer(session);
    session.pending = false;
    session.playing = false;
    session.activePlay = false;
    session.segmentIndex = session.segments.length - 1;
    updateProgress(session, session.durations[session.segmentIndex]);
    syncControls(session);
  }

  function updateSpeechProgress(session) {
    if (!session.playing || session.speechForIndex !== session.segmentIndex) return;
    const elapsed = session.speechElapsed + ((performance.now() - session.speechStartedAt) / 1000);
    updateProgress(session, Math.min(elapsed, session.durations[session.segmentIndex]));
  }

  function advanceSegment(session) {
    if (!activeSession || activeSession.token !== session.token || !session.activePlay) return;
    clearSpeechTimer(session);
    const currentSegment = session.segments[session.segmentIndex];
    updateProgress(session, session.durations[session.segmentIndex]);

    if (session.segmentIndex >= session.segments.length - 1) {
      finishPlay(session);
      return;
    }

    session.playing = false;
    session.pending = true;
    syncControls(session);
    session.advanceTimer = window.setTimeout(() => {
      session.advanceTimer = null;
      playSegment(session, session.segmentIndex + 1);
    }, currentSegment.pauseAfter);
  }

  function startSpeechSegment(session, index, restart = false) {
    if (!activeSession || activeSession.token !== session.token || session.segmentIndex !== index) return;
    const segment = session.segments[index];

    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      session.pending = false;
      session.playing = false;
      setNotice(session, "This clip and computer voice are unavailable.", "error");
      advanceSegment(session);
      return;
    }

    if (!restart && session.speechPaused && session.speechForIndex === index && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      session.speechPaused = false;
      session.speechStartedAt = performance.now();
      session.playing = true;
      session.pending = false;
      session.speechTimer = window.setInterval(() => updateSpeechProgress(session), 250);
      syncControls(session);
      return;
    }

    window.speechSynthesis.cancel();
    clearSpeechTimer(session);
    const utterance = new SpeechSynthesisUtterance(segment.text);
    utterance.lang = "ja-JP";
    utterance.rate = session.speed;
    utterance.pitch = pitchForSpeaker(segment.speaker);
    utterance.volume = session.muted ? 0 : session.volume;
    const voice = voiceForSpeaker(segment.speaker);
    if (voice) utterance.voice = voice;

    session.speechForIndex = index;
    session.speechElapsed = 0;
    session.speechStartedAt = performance.now();
    session.speechPaused = false;
    session.durations[index] = estimatedDuration(segment, session.speed);
    if (session.refs.shadowing && window.JLPTShadowing) {
      window.JLPTShadowing.updateTarget(segment, session.durations[index]);
    }
    session.playing = true;
    session.pending = false;
    session.utterance = utterance;
    updateProgress(session, 0);
    syncControls(session);

    utterance.onend = () => {
      if (!activeSession || activeSession.token !== session.token || session.speechForIndex !== index) return;
      advanceSegment(session);
    };
    utterance.onerror = (event) => {
      if (!activeSession || activeSession.token !== session.token || event.error === "canceled") return;
      setNotice(session, "A computer-voice line could not play.", "error");
      advanceSegment(session);
    };

    window.speechSynthesis.speak(utterance);
    session.speechTimer = window.setInterval(() => updateSpeechProgress(session), 250);
  }

  function useFallback(session, index, startImmediately) {
    if (!activeSession || activeSession.token !== session.token) return;
    session.fallbackSegments.add(index);
    setNotice(session, "Using computer voice for missing clips", "info");

    if (startImmediately && session.activePlay && session.segmentIndex === index && session.speechForIndex !== index) {
      session.audio.pause();
      startSpeechSegment(session, index, true);
    } else if (!session.activePlay) {
      session.pending = false;
      syncControls(session);
    }
  }

  async function playSegment(session, index, startAt = 0) {
    if (!activeSession || activeSession.token !== session.token || !session.activePlay) return;
    if (index >= session.segments.length) {
      finishPlay(session);
      return;
    }

    const segment = session.segments[index];
    session.segmentIndex = index;
    session.speechForIndex = -1;
    session.speechPaused = false;
    session.pending = true;
    session.playing = false;
    setSpeaker(session, index);
    updateProgress(session, 0);
    syncControls(session);

    if (!segment.audio || session.fallbackSegments.has(index)) {
      useFallback(session, index, true);
      return;
    }

    session.audioSegmentIndex = index;
    session.requestedStartTime = Math.max(0, startAt);
    session.audio.src = segment.audio;
    session.audio.currentTime = 0;
    session.audio.playbackRate = session.speed;
    session.audio.volume = session.volume;
    session.audio.muted = session.muted;

    try {
      await session.audio.play();
      if (!activeSession || activeSession.token !== session.token || session.segmentIndex !== index) return;
      session.pending = false;
      session.playing = true;
      syncControls(session);
    } catch (error) {
      useFallback(session, index, true);
    }
  }

  function registerPlay(session) {
    const requestedCount = session.playCount + 1;
    const savedCount = typeof session.onPlayStart === "function"
      ? session.onPlayStart(requestedCount)
      : requestedCount;
    session.playCount = Number.isInteger(savedCount) ? savedCount : requestedCount;
  }

  function startNewPlay(session) {
    if (session.pending || !canStartPlay(session)) {
      if (!canStartPlay(session)) setNotice(session, "No plays left in exam mode.", "warning");
      return;
    }

    stopSessionMedia(session);
    session.pending = true;
    session.activePlay = true;
    session.playing = false;
    session.segmentIndex = 0;
    registerPlay(session);
    syncControls(session);
    playSegment(session, 0);
  }

  function pause(session) {
    if (session.speechForIndex === session.segmentIndex) {
      if (!("speechSynthesis" in window)) return;
      session.speechElapsed += (performance.now() - session.speechStartedAt) / 1000;
      session.speechPaused = true;
      session.playing = false;
      clearSpeechTimer(session);
      window.speechSynthesis.pause();
    } else {
      session.audio.pause();
      session.playing = false;
    }
    syncControls(session);
  }

  function resume(session) {
    if (session.speechForIndex === session.segmentIndex || session.fallbackSegments.has(session.segmentIndex)) {
      startSpeechSegment(session, session.segmentIndex, false);
      return;
    }

    session.pending = true;
    syncControls(session);
    session.audio.play().then(() => {
      if (!activeSession || activeSession.token !== session.token) return;
      session.pending = false;
      session.playing = true;
      syncControls(session);
    }).catch(() => useFallback(session, session.segmentIndex, true));
  }

  function togglePlayback() {
    const session = activeSession;
    if (!session || session.pending) return;
    const now = Date.now();
    if (now - session.lastToggleAt < 400) return;
    session.lastToggleAt = now;

    if (session.playing) {
      pause(session);
    } else if (session.activePlay) {
      resume(session);
    } else {
      startNewPlay(session);
    }
  }

  function replay() {
    const session = activeSession;
    if (!session || session.pending || !canStartPlay(session)) {
      if (session && !canStartPlay(session)) setNotice(session, "No plays left in exam mode.", "warning");
      return;
    }
    session.activePlay = false;
    session.playing = false;
    stopSessionMedia(session);
    startNewPlay(session);
  }

  function segmentAtTime(session, requestedTime) {
    const target = Math.max(0, Math.min(totalDuration(session), requestedTime));
    let elapsed = 0;

    for (let index = 0; index < session.durations.length; index += 1) {
      const duration = session.durations[index];
      if (target <= elapsed + duration || index === session.durations.length - 1) {
        return { index, localTime: Math.max(0, target - elapsed) };
      }
      elapsed += duration;
    }
    return { index: 0, localTime: 0 };
  }

  function seekTo(session, requestedTime) {
    if (!session || session.mode !== "practice" || !session.activePlay || session.pending) return;
    const target = segmentAtTime(session, requestedTime);

    if (
      target.index === session.segmentIndex
      && session.speechForIndex !== session.segmentIndex
      && !session.fallbackSegments.has(session.segmentIndex)
      && session.audioSegmentIndex === session.segmentIndex
    ) {
      try {
        session.audio.currentTime = Math.min(target.localTime, Math.max(0, session.audio.duration - 0.05));
        updateProgress(session, session.audio.currentTime);
        return;
      } catch (error) {
        // Reload the target segment below when the media is not seekable yet.
      }
    }

    stopSessionMedia(session);
    session.activePlay = true;
    session.playing = false;
    session.pending = false;
    if (session.fallbackSegments.has(target.index) && target.localTime > 0) {
      setNotice(session, "Computer voice restarts from the beginning of this line.", "info");
    }
    playSegment(session, target.index, target.localTime);
  }

  function skipBy(seconds) {
    const session = activeSession;
    if (!session) return;
    seekTo(session, session.currentPosition + seconds);
  }

  function goToLine(direction) {
    const session = activeSession;
    if (!session || session.mode !== "practice" || !session.activePlay || session.pending) return;
    const targetIndex = Math.max(0, Math.min(session.segments.length - 1, session.segmentIndex + direction));
    if (targetIndex === session.segmentIndex) return;
    stopSessionMedia(session);
    session.activePlay = true;
    session.playing = false;
    session.pending = false;
    playSegment(session, targetIndex, 0);
  }

  function repeatCurrentLine() {
    const session = activeSession;
    if (!session || session.mode !== "practice" || !session.activePlay || session.pending) return;
    stopSessionMedia(session);
    session.activePlay = true;
    session.playing = false;
    session.pending = false;
    playSegment(session, session.segmentIndex, 0);
  }

  function toggleMute() {
    const session = activeSession;
    if (!session) return;
    session.muted = !session.muted;
    session.audio.muted = session.muted;
    if (session.utterance) session.utterance.volume = session.muted ? 0 : session.volume;
    if (session.speechForIndex === session.segmentIndex && session.activePlay) {
      startSpeechSegment(session, session.segmentIndex, true);
    }
    syncControls(session);
  }

  function clearPreloads() {
    preloadedAudios.forEach((audio) => audio.pause());
    preloadedAudios = [];
  }

  function preload(questionOrUrl) {
    clearPreloads();
    const paths = typeof questionOrUrl === "string"
      ? [questionOrUrl]
      : questionOrUrl ? getSegments(questionOrUrl).map((segment) => segment.audio).filter(Boolean) : [];

    preloadedAudios = paths.map((path) => {
      const audio = new Audio();
      audio.preload = "auto";
      audio.src = path;
      audio.load();
      return audio;
    });
  }

  function mountPlayer(container, options) {
    stop();
    if (!container || !options.question) return;

    const mode = options.mode === "practice" ? "practice" : "exam";
    const segments = getSegments(options.question);
    const token = ++sessionToken;
    container.innerHTML = `
      <div class="audio-player" aria-label="Listening audio player">
        <div class="audio-player-main">
          <button class="audio-play-button" type="button" data-audio-play aria-label="Play listening dialogue">
            <span class="audio-play-icon" aria-hidden="true">▶</span>
            <span data-audio-play-label>Play audio</span>
          </button>
          <button class="audio-replay-button" type="button" data-audio-replay aria-label="Replay listening dialogue">
            <span aria-hidden="true">↻</span> Replay
          </button>
          <span class="audio-plays" data-audio-plays></span>
          <span class="audio-speaker" data-audio-speaker hidden>Now playing: <strong data-audio-speaker-name></strong></span>
        </div>

        <div class="audio-timeline">
          <input class="audio-seek" data-audio-seek type="range" min="0" max="1" step="0.1" value="0" aria-label="Seek through dialogue">
          <div class="audio-time" aria-label="Audio time">
            <span data-audio-current>00:00</span>
            <span aria-hidden="true">/</span>
            <span data-audio-duration>--:--</span>
          </div>
        </div>

        ${mode === "practice" ? `
          <div class="audio-transport" aria-label="Advanced dialogue controls">
            <button type="button" data-audio-previous-line aria-label="Previous dialogue line" title="Previous line ([)">|◀</button>
            <button type="button" data-audio-back aria-label="Go back 5 seconds" title="Back 5 seconds (J)">−5</button>
            <button type="button" data-audio-repeat-line aria-label="Repeat current dialogue line" title="Repeat current line (C)">↺</button>
            <button type="button" data-audio-forward aria-label="Go forward 5 seconds" title="Forward 5 seconds (L)">+5</button>
            <button type="button" data-audio-next-line aria-label="Next dialogue line" title="Next line (])">▶|</button>
          </div>
        ` : ""}

        <div class="audio-player-controls">
          <button class="audio-mute-button" type="button" data-audio-mute aria-label="Mute audio" aria-pressed="false" title="Mute (M)">🔊</button>
          <label class="audio-volume-label">
            <span class="visually-hidden">Volume</span>
            <input class="audio-volume" data-audio-volume type="range" min="0" max="1" step="0.05" value="0.85" aria-label="Audio volume">
          </label>
          ${mode === "practice" ? `
            <label class="audio-speed-label">Speed
              <select data-audio-speed aria-label="Playback speed">
                <option value="0.75">0.75x</option>
                <option value="1" selected>1x</option>
                <option value="1.25">1.25x</option>
              </select>
            </label>
          ` : ""}
          <span class="audio-shortcuts">Space play/pause · R replay · M mute${mode === "practice" ? " · J/L ±5s · [/] line · C repeat line · S record" : ""}</span>
        </div>
        <p class="audio-notice" data-audio-notice role="status" hidden></p>
        ${mode === "practice" ? '<div class="shadowing-mount" data-shadowing-mount></div>' : ""}
      </div>
    `;

    const session = {
      token,
      question: options.question,
      segments,
      durations: segments.map((segment) => estimatedDuration(segment)),
      mode,
      maxPlays: Number(options.maxPlays) || CONFIG.MAX_PLAYS,
      playCount: Math.max(0, Number(options.playCount) || 0),
      onPlayStart: options.onPlayStart,
      audio: new Audio(),
      audioSegmentIndex: -1,
      fallbackSegments: new Set(),
      segmentIndex: 0,
      pending: false,
      activePlay: false,
      playing: false,
      speed: 1,
      volume: 0.85,
      muted: false,
      shadowRecording: false,
      currentPosition: 0,
      userSeeking: false,
      requestedStartTime: 0,
      speechForIndex: -1,
      speechElapsed: 0,
      speechStartedAt: 0,
      speechPaused: false,
      speechTimer: null,
      advanceTimer: null,
      utterance: null,
      lastToggleAt: 0,
      refs: {
        play: container.querySelector("[data-audio-play]"),
        playIcon: container.querySelector(".audio-play-icon"),
        playLabel: container.querySelector("[data-audio-play-label]"),
        replay: container.querySelector("[data-audio-replay]"),
        plays: container.querySelector("[data-audio-plays]"),
        speaker: container.querySelector("[data-audio-speaker]"),
        speakerName: container.querySelector("[data-audio-speaker-name]"),
        seek: container.querySelector("[data-audio-seek]"),
        currentTime: container.querySelector("[data-audio-current]"),
        duration: container.querySelector("[data-audio-duration]"),
        mute: container.querySelector("[data-audio-mute]"),
        volume: container.querySelector("[data-audio-volume]"),
        speed: container.querySelector("[data-audio-speed]"),
        previousLine: container.querySelector("[data-audio-previous-line]"),
        nextLine: container.querySelector("[data-audio-next-line]"),
        back: container.querySelector("[data-audio-back]"),
        forward: container.querySelector("[data-audio-forward]"),
        repeatLine: container.querySelector("[data-audio-repeat-line]"),
        shadowing: container.querySelector("[data-shadowing-mount]"),
        notice: container.querySelector("[data-audio-notice]")
      }
    };

    activeSession = session;
    session.audio.preload = "metadata";
    session.audio.volume = session.volume;
    session.audio.muted = session.muted;
    session.audio.addEventListener("loadedmetadata", () => {
      const index = session.audioSegmentIndex;
      if (!activeSession || activeSession.token !== token || index < 0) return;
      if (Number.isFinite(session.audio.duration)) session.durations[index] = session.audio.duration;
      if (index === session.segmentIndex && session.refs.shadowing && window.JLPTShadowing) {
        window.JLPTShadowing.updateTarget(session.segments[index], session.durations[index]);
      }
      if (index === session.segmentIndex && session.requestedStartTime > 0 && Number.isFinite(session.audio.duration)) {
        session.audio.currentTime = Math.min(session.requestedStartTime, Math.max(0, session.audio.duration - 0.05));
        session.requestedStartTime = 0;
      }
      updateProgress(session, index === session.segmentIndex ? session.audio.currentTime : 0);
    });
    session.audio.addEventListener("timeupdate", () => {
      if (session.audioSegmentIndex === session.segmentIndex) updateProgress(session, session.audio.currentTime);
    });
    session.audio.addEventListener("ended", () => {
      if (session.audioSegmentIndex === session.segmentIndex) advanceSegment(session);
    });
    session.audio.addEventListener("error", () => {
      const index = session.audioSegmentIndex;
      if (index >= 0) useFallback(session, index, session.activePlay && session.segmentIndex === index);
    });

    session.refs.play.addEventListener("click", togglePlayback);
    session.refs.replay.addEventListener("click", replay);
    session.refs.mute.addEventListener("click", toggleMute);
    session.refs.seek.addEventListener("input", (event) => {
      session.userSeeking = true;
      session.currentPosition = Number(event.target.value);
      session.refs.currentTime.textContent = formatTime(session.currentPosition);
    });
    session.refs.seek.addEventListener("change", (event) => {
      const requestedTime = Number(event.target.value);
      session.userSeeking = false;
      seekTo(session, requestedTime);
    });
    session.refs.volume.addEventListener("input", (event) => {
      session.volume = Number(event.target.value);
      session.audio.volume = session.volume;
      if (session.utterance) session.utterance.volume = session.muted ? 0 : session.volume;
    });
    if (session.refs.speed) {
      session.refs.speed.addEventListener("change", (event) => {
        session.speed = Number(event.target.value) || 1;
        session.audio.playbackRate = session.speed;
        if (session.speechForIndex === session.segmentIndex && session.activePlay) {
          startSpeechSegment(session, session.segmentIndex, true);
        }
      });
    }
    if (session.refs.previousLine) {
      session.refs.previousLine.addEventListener("click", () => goToLine(-1));
      session.refs.nextLine.addEventListener("click", () => goToLine(1));
      session.refs.back.addEventListener("click", () => skipBy(-5));
      session.refs.forward.addEventListener("click", () => skipBy(5));
      session.refs.repeatLine.addEventListener("click", repeatCurrentLine);
    }

    if (session.refs.shadowing && window.JLPTShadowing) {
      window.JLPTShadowing.mount(session.refs.shadowing, {
        target: segments[0],
        targetDuration: session.durations[0],
        onRecordingChange(isRecording) {
          session.shadowRecording = isRecording;
          if (isRecording && session.playing) pause(session);
          syncControls(session);
        },
        onPlaybackStart() {
          if (session.playing) pause(session);
        }
      });
    }

    setSpeaker(session, 0);
    updateProgress(session, 0);
    syncControls(session);

    const firstSegment = segments[0];
    if (firstSegment.audio) {
      session.audioSegmentIndex = 0;
      session.audio.src = firstSegment.audio;
      session.audio.load();
    } else {
      useFallback(session, 0, false);
    }
    preload(options.nextQuestion || options.nextAudio);
  }

  function stopPlayer() {
    const session = activeSession;
    if (!session) return;
    activeSession = null;
    sessionToken += 1;
    stopSessionMedia(session);
  }

  function resetReviewButton(session) {
    if (!session || !session.button) return;
    session.button.disabled = false;
    session.button.setAttribute("aria-pressed", "false");
    session.button.innerHTML = '<span aria-hidden="true">▶</span> Replay audio';
  }

  function stopReview() {
    if (!reviewSession) return;
    const session = reviewSession;
    reviewSession = null;
    if (session.audio) session.audio.pause();
    if (session.advanceTimer) window.clearTimeout(session.advanceTimer);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    resetReviewButton(session);
  }

  function finishReview(session) {
    if (!reviewSession || reviewSession.token !== session.token) return;
    reviewSession = null;
    resetReviewButton(session);
  }

  function playReviewSegment(session, index) {
    if (!reviewSession || reviewSession.token !== session.token) return;
    if (index >= session.segments.length) {
      finishReview(session);
      return;
    }

    const segment = session.segments[index];
    session.index = index;
    let completed = false;
    let fallbackStarted = false;
    const next = () => {
      if (completed || !reviewSession || reviewSession.token !== session.token) return;
      completed = true;
      session.advanceTimer = window.setTimeout(() => playReviewSegment(session, index + 1), segment.pauseAfter);
    };
    const speak = () => {
      if (fallbackStarted || !reviewSession || reviewSession.token !== session.token) return;
      fallbackStarted = true;
      if (session.audio) session.audio.pause();
      if (session.notice) session.notice.textContent = `Using computer voice · ${segment.label}`;

      if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
        next();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(segment.text);
      utterance.lang = "ja-JP";
      utterance.pitch = pitchForSpeaker(segment.speaker);
      const voice = voiceForSpeaker(segment.speaker);
      if (voice) utterance.voice = voice;
      utterance.onend = next;
      utterance.onerror = next;
      window.speechSynthesis.speak(utterance);
    };

    if (session.notice) session.notice.textContent = `Playing: ${segment.label}`;
    if (!segment.audio) {
      speak();
      return;
    }

    const audio = new Audio(segment.audio);
    session.audio = audio;
    audio.addEventListener("ended", next, { once: true });
    audio.addEventListener("error", speak, { once: true });
    audio.play().catch(speak);
  }

  function playReview(question, button, notice) {
    if (reviewSession && reviewSession.button === button) {
      stopReview();
      return;
    }

    stopReview();
    const session = {
      token: ++sessionToken,
      segments: getSegments(question),
      index: 0,
      button,
      notice,
      audio: null,
      advanceTimer: null
    };
    reviewSession = session;
    button.setAttribute("aria-pressed", "true");
    button.innerHTML = '<span aria-hidden="true">■</span> Stop dialogue';
    if (notice) notice.textContent = "";
    playReviewSegment(session, 0);
  }

  function stop() {
    stopPlayer();
    stopReview();
    clearPreloads();
    if (window.JLPTShadowing) window.JLPTShadowing.stop();
  }

  function playBeep() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;
    if (!audioContext) audioContext = new AudioContextClass();

    const playTone = () => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 660;
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.65);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.68);
    };

    if (audioContext.state === "suspended") {
      audioContext.resume().then(playTone);
    } else {
      playTone();
    }
    return true;
  }

  function handleShortcut(event) {
    if (!activeSession || event.altKey || event.ctrlKey || event.metaKey) return;
    if (document.getElementById("modal-root")?.childElementCount) return;
    const target = event.target;
    const tagName = target && target.tagName ? target.tagName : "";
    if (["INPUT", "SELECT", "TEXTAREA", "BUTTON", "A"].includes(tagName) || target?.isContentEditable) return;

    if (event.code === "Space") {
      event.preventDefault();
      togglePlayback();
      return;
    }

    const key = event.key.toLowerCase();
    if (key === "r") {
      event.preventDefault();
      replay();
    } else if (key === "m") {
      event.preventDefault();
      toggleMute();
    } else if (key === "j") {
      event.preventDefault();
      skipBy(-5);
    } else if (key === "l") {
      event.preventDefault();
      skipBy(5);
    } else if (key === "[") {
      event.preventDefault();
      goToLine(-1);
    } else if (key === "]") {
      event.preventDefault();
      goToLine(1);
    } else if (key === "c") {
      event.preventDefault();
      repeatCurrentLine();
    }
  }

  document.addEventListener("keydown", handleShortcut);

  window.JLPTListeningConfig = CONFIG;
  window.JLPTAudio = {
    mountPlayer,
    playReview,
    playBeep,
    stop,
    preload,
    config: CONFIG
  };
}());
