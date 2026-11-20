(function () {
  "use strict";

  let root = null;
  let target = null;
  let targetDuration = 0;
  let callbacks = {};
  let mediaRecorder = null;
  let mediaStream = null;
  let chunks = [];
  let recordingStartedAt = 0;
  let recordingTimer = null;
  let recordingBlob = null;
  let recordingUrl = "";
  let recordingAudio = null;
  let analyserContext = null;
  let analyser = null;
  let analyserFrame = null;
  let mountToken = 0;

  function escapeHTML(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatTime(seconds) {
    const safeSeconds = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = Math.floor(safeSeconds % 60);
    return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }

  function supportedMimeType() {
    if (typeof MediaRecorder === "undefined") return "";
    const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
    return types.find((type) => MediaRecorder.isTypeSupported?.(type)) || "";
  }

  function fileExtension(blobType) {
    if (blobType.includes("mp4")) return "m4a";
    if (blobType.includes("ogg")) return "ogg";
    return "webm";
  }

  function setStatus(message, tone = "info") {
    if (!root) return;
    const status = root.querySelector("[data-shadow-status]");
    if (!status) return;
    status.textContent = message;
    status.className = `shadow-status shadow-status-${tone}`;
  }

  function updateRecordButton(recording) {
    if (!root) return;
    const button = root.querySelector("[data-shadow-record]");
    if (!button) return;
    button.classList.toggle("is-recording", recording);
    button.setAttribute("aria-pressed", String(recording));
    button.innerHTML = recording
      ? '<span aria-hidden="true">■</span> Stop recording'
      : '<span aria-hidden="true">●</span> Record my voice';
  }

  function updateRecordingTime() {
    if (!root || !recordingStartedAt) return;
    const output = root.querySelector("[data-shadow-time]");
    if (output) output.textContent = formatTime((performance.now() - recordingStartedAt) / 1000);
  }

  function stopMeter() {
    if (analyserFrame) window.cancelAnimationFrame(analyserFrame);
    analyserFrame = null;
    if (analyserContext) analyserContext.close().catch(() => {});
    analyserContext = null;
    analyser = null;
    if (root) {
      const meter = root.querySelector("[data-shadow-meter]");
      if (meter) meter.value = 0;
    }
  }

  function startMeter(stream) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass || !root) return;

    try {
      analyserContext = new AudioContextClass();
      const source = analyserContext.createMediaStreamSource(stream);
      analyser = analyserContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
    } catch (error) {
      stopMeter();
      return;
    }
    const samples = new Uint8Array(analyser.fftSize);

    const draw = () => {
      if (!analyser || !root) return;
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      samples.forEach((sample) => {
        const normalized = (sample - 128) / 128;
        sum += normalized * normalized;
      });
      const level = Math.min(1, Math.sqrt(sum / samples.length) * 3.2);
      const meter = root.querySelector("[data-shadow-meter]");
      if (meter) meter.value = level;
      analyserFrame = window.requestAnimationFrame(draw);
    };
    draw();
  }

  function releaseStream() {
    if (mediaStream) mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
    stopMeter();
  }

  function clearRecording() {
    if (recordingAudio) recordingAudio.pause();
    recordingAudio = null;
    recordingBlob = null;
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    recordingUrl = "";

    if (!root) return;
    const play = root.querySelector("[data-shadow-play]");
    const remove = root.querySelector("[data-shadow-delete]");
    const download = root.querySelector("[data-shadow-download]");
    const feedback = root.querySelector("[data-shadow-feedback]");
    if (play) {
      play.disabled = true;
      play.setAttribute("aria-pressed", "false");
      play.innerHTML = '<span aria-hidden="true">▶</span> Play my voice';
    }
    if (remove) remove.disabled = true;
    if (download) {
      download.hidden = true;
      download.removeAttribute("href");
    }
    if (feedback) feedback.textContent = "";
  }

  function pacingFeedback(recordedDuration) {
    if (!Number.isFinite(targetDuration) || !Number.isFinite(recordedDuration) || targetDuration <= 0 || recordedDuration <= 0) {
      return "Listen again and compare your rhythm with the original line.";
    }
    const ratio = recordedDuration / targetDuration;
    if (ratio < 0.75) return "Your recording is much shorter. Try slowing down and matching every phrase.";
    if (ratio > 1.35) return "Your recording is longer. Try following the speaker's rhythm more closely.";
    return "Good pacing range. Replay both versions and compare pitch and pauses.";
  }

  function prepareRecording(blob, token) {
    if (!root || token !== mountToken) return;
    recordingBlob = blob;
    recordingUrl = URL.createObjectURL(blob);
    recordingAudio = new Audio(recordingUrl);
    const play = root.querySelector("[data-shadow-play]");
    const remove = root.querySelector("[data-shadow-delete]");
    const download = root.querySelector("[data-shadow-download]");

    play.disabled = false;
    remove.disabled = false;
    download.hidden = false;
    download.href = recordingUrl;
    download.download = `shadow-${target?.speaker || "voice"}.${fileExtension(blob.type)}`;

    recordingAudio.addEventListener("loadedmetadata", () => {
      if (!root || token !== mountToken) return;
      const feedback = root.querySelector("[data-shadow-feedback]");
      if (feedback) feedback.textContent = pacingFeedback(recordingAudio.duration);
    });
    recordingAudio.addEventListener("ended", () => {
      if (!root || token !== mountToken) return;
      play.setAttribute("aria-pressed", "false");
      play.innerHTML = '<span aria-hidden="true">▶</span> Play my voice';
    });
    setStatus("Recording ready. Compare it with the original line.", "success");
  }

  function finishRecorder() {
    if (recordingTimer) window.clearInterval(recordingTimer);
    recordingTimer = null;
    recordingStartedAt = 0;
    updateRecordButton(false);
    releaseStream();
    callbacks.onRecordingChange?.(false);
  }

  function stopRecording() {
    if (!mediaRecorder || mediaRecorder.state === "inactive") return;
    mediaRecorder.stop();
  }

  async function startRecording() {
    if (!root) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setStatus("Voice recording is not supported in this browser.", "error");
      return;
    }

    clearRecording();
    setStatus("Requesting microphone permission…");
    callbacks.onRecordingChange?.(true);
    const token = mountToken;

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      if (!root || token !== mountToken) {
        releaseStream();
        return;
      }

      const mimeType = supportedMimeType();
      const recorder = mimeType ? new MediaRecorder(mediaStream, { mimeType }) : new MediaRecorder(mediaStream);
      mediaRecorder = recorder;
      chunks = [];
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data && event.data.size) chunks.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        if (token !== mountToken) {
          releaseStream();
          return;
        }
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
        finishRecorder();
        if (blob.size) prepareRecording(blob, token);
        else setStatus("No voice was captured. Please try again.", "error");
      }, { once: true });
      recorder.addEventListener("error", () => {
        if (token !== mountToken) return;
        finishRecorder();
        setStatus("Recording failed. Please try again.", "error");
      }, { once: true });

      recorder.start(200);
      recordingStartedAt = performance.now();
      recordingTimer = window.setInterval(updateRecordingTime, 200);
      updateRecordButton(true);
      startMeter(mediaStream);
      setStatus("Recording… Speak after listening to the target line.", "recording");
    } catch (error) {
      finishRecorder();
      const denied = error && (error.name === "NotAllowedError" || error.name === "PermissionDeniedError");
      setStatus(denied
        ? "Microphone permission was denied. Allow it in browser settings and try again."
        : "The microphone could not be opened. Check that it is not in use elsewhere.", "error");
    }
  }

  function toggleRecording() {
    if (mediaRecorder && mediaRecorder.state === "recording") stopRecording();
    else startRecording();
  }

  function toggleRecordingPlayback() {
    if (!recordingAudio) return;
    callbacks.onPlaybackStart?.();
    const button = root.querySelector("[data-shadow-play]");

    if (!recordingAudio.paused) {
      recordingAudio.pause();
      button.setAttribute("aria-pressed", "false");
      button.innerHTML = '<span aria-hidden="true">▶</span> Play my voice';
      return;
    }

    recordingAudio.play().then(() => {
      button.setAttribute("aria-pressed", "true");
      button.innerHTML = '<span aria-hidden="true">❚❚</span> Pause my voice';
    }).catch(() => setStatus("Your recording could not be played.", "error"));
  }

  function renderTarget() {
    if (!root || !target) return;
    const speaker = root.querySelector("[data-shadow-speaker]");
    const text = root.querySelector("[data-shadow-text]");
    if (speaker) speaker.textContent = target.label || target.speaker || "Speaker";
    if (text) text.textContent = target.text || "Listen to the current line, then imitate it.";
  }

  function handleClick(event) {
    const toggle = event.target.closest("[data-shadow-toggle]");
    if (toggle) {
      const panel = root.querySelector("[data-shadow-panel]");
      const expanded = panel.hidden;
      panel.hidden = !expanded;
      toggle.setAttribute("aria-expanded", String(expanded));
      toggle.querySelector("span:last-child").textContent = expanded ? "Close shadowing" : "Shadow this line";
      if (expanded) root.querySelector("[data-shadow-record]").focus();
      return;
    }
    if (event.target.closest("[data-shadow-record]")) toggleRecording();
    else if (event.target.closest("[data-shadow-play]")) toggleRecordingPlayback();
    else if (event.target.closest("[data-shadow-delete]")) {
      clearRecording();
      setStatus("Recording deleted.");
    }
  }

  function mount(container, options) {
    stop();
    if (!container) return;
    root = container;
    target = options.target || null;
    targetDuration = Number(options.targetDuration) || 0;
    callbacks = options;
    mountToken += 1;

    root.innerHTML = `
      <section class="shadowing-tool" aria-label="Shadowing and voice recording">
        <button class="shadow-toggle" type="button" data-shadow-toggle aria-expanded="false">
          <span aria-hidden="true">🎙</span><span>Shadow this line</span>
        </button>
        <div class="shadow-panel" data-shadow-panel hidden>
          <div class="shadow-target">
            <span data-shadow-speaker></span>
            <p data-shadow-text lang="ja"></p>
          </div>
          <div class="shadow-meter-row">
            <meter data-shadow-meter min="0" max="1" value="0" aria-label="Microphone input level"></meter>
            <output data-shadow-time aria-label="Recording duration">00:00</output>
          </div>
          <div class="shadow-actions">
            <button class="button button-accent" type="button" data-shadow-record aria-pressed="false"><span aria-hidden="true">●</span> Record my voice</button>
            <button class="button button-secondary" type="button" data-shadow-play aria-pressed="false" disabled><span aria-hidden="true">▶</span> Play my voice</button>
            <button class="button button-quiet" type="button" data-shadow-delete disabled>Delete</button>
            <a class="button button-link" data-shadow-download hidden>Download</a>
          </div>
          <p class="shadow-status" data-shadow-status role="status">Listen to the original line, then record yourself saying it.</p>
          <p class="shadow-feedback" data-shadow-feedback></p>
          <p class="shadow-privacy"><span aria-hidden="true">🔒</span> Recording stays in this browser tab and is discarded when you leave the question. Shortcut: S.</p>
        </div>
      </section>
    `;

    root.addEventListener("click", handleClick);
    renderTarget();
  }

  function updateTarget(nextTarget, duration = 0) {
    if (!root || !nextTarget) return;
    const currentKey = `${target?.speaker || ""}:${target?.audio || ""}:${target?.text || ""}`;
    const nextKey = `${nextTarget.speaker || ""}:${nextTarget.audio || ""}:${nextTarget.text || ""}`;
    targetDuration = Number(duration) || targetDuration;
    if (currentKey === nextKey) return;

    if (mediaRecorder && mediaRecorder.state === "recording") {
      mountToken += 1;
      try { mediaRecorder.stop(); } catch (error) { /* Recorder already stopped. */ }
      mediaRecorder = null;
      if (recordingTimer) window.clearInterval(recordingTimer);
      recordingTimer = null;
      recordingStartedAt = 0;
      releaseStream();
      updateRecordButton(false);
      callbacks.onRecordingChange?.(false);
    }
    clearRecording();
    target = nextTarget;
    targetDuration = Number(duration) || 0;
    renderTarget();
    setStatus("New target line ready. Listen, then record your version.");
  }

  function handleShortcut(event) {
    if (!root || event.altKey || event.ctrlKey || event.metaKey || event.key.toLowerCase() !== "s") return;
    if (root.querySelector("[data-shadow-panel]").hidden) return;
    const tagName = event.target?.tagName || "";
    if (["INPUT", "SELECT", "TEXTAREA", "BUTTON", "A"].includes(tagName) || event.target?.isContentEditable) return;
    event.preventDefault();
    toggleRecording();
  }

  function stop() {
    mountToken += 1;
    if (recordingTimer) window.clearInterval(recordingTimer);
    recordingTimer = null;
    recordingStartedAt = 0;
    if (mediaRecorder && mediaRecorder.state === "recording") {
      try { mediaRecorder.stop(); } catch (error) { /* Recorder already stopped. */ }
    }
    mediaRecorder = null;
    releaseStream();
    clearRecording();
    if (root) root.removeEventListener("click", handleClick);
    root = null;
    target = null;
    targetDuration = 0;
    callbacks = {};
    chunks = [];
  }

  document.addEventListener("keydown", handleShortcut);

  window.JLPTShadowing = {
    mount,
    updateTarget,
    stop
  };
}());
