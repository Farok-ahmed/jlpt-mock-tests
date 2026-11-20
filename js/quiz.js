(function () {
  "use strict";

  const PASS_MARK = 80;
  const MAX_SCORE = 180;
  const SECTION_LABELS = {
    vocabulary: "Vocabulary",
    grammar: "Grammar",
    reading: "Reading",
    listening: "Listening · 聴解"
  };

  let test = null;
  let user = null;
  let state = null;
  let mount = null;
  let timerId = null;
  let submitting = false;
  let storageWarningShown = false;
  let selectedStartMode = "exam";
  let renderedQuestionIndex = -1;

  function escapeHTML(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getTests() {
    return window.JLPT_DATA && Array.isArray(window.JLPT_DATA.tests)
      ? window.JLPT_DATA.tests
      : [];
  }

  function findTest(testId) {
    return getTests().find((item) => item.id === testId) || null;
  }

  function listeningConfig() {
    return window.JLPTListeningConfig || {
      MAX_PLAYS: 2,
      DEFAULT_MODE: "exam",
      TIMER_MODE: "main",
      LISTENING_DURATION_MINUTES: 30
    };
  }

  function firstListeningIndex() {
    return test.questions.findIndex((question) => question.section === "listening");
  }

  function hasListeningSection() {
    return firstListeningIndex() >= 0;
  }

  function mainTimerMinutes() {
    if (listeningConfig().TIMER_MODE !== "section" || !hasListeningSection()) return test.duration;
    return Math.max(1, test.duration - listeningConfig().LISTENING_DURATION_MINUTES);
  }

  function optionText(option) {
    return typeof option === "string" ? option : option.text;
  }

  function optionImage(option) {
    return typeof option === "object" && option ? option.image : "";
  }

  function dialogueTranscript(question) {
    if (!Array.isArray(question.audioSegments) || !question.audioSegments.length) {
      return `<p lang="ja">${escapeHTML(question.script)}</p>`;
    }

    return question.audioSegments.map((segment) => `
      <div class="dialogue-line">
        <strong>${escapeHTML(segment.label || segment.speaker)}</strong>
        <p lang="ja">${escapeHTML(segment.text)}</p>
      </div>
    `).join("");
  }

  function createState(mode = selectedStartMode) {
    const now = Date.now();
    return {
      testId: test.id,
      userId: user.id,
      answers: Array(test.questions.length).fill(null),
      marked: Array(test.questions.length).fill(false),
      playCounts: Array(test.questions.length).fill(0),
      mode: mode === "practice" ? "practice" : "exam",
      soundCheckPassed: !hasListeningSection(),
      listeningStartedAt: null,
      listeningEndsAt: null,
      mainTimeRemaining: null,
      currentIndex: 0,
      startedAt: now,
      endsAt: now + (mainTimerMinutes() * 60 * 1000),
      updatedAt: now
    };
  }

  function normalizeState(savedState) {
    if (!savedState || savedState.testId !== test.id || savedState.userId !== user.id) {
      return createState();
    }

    const answers = test.questions.map((question, index) => {
      const savedAnswer = savedState.answers && savedState.answers[index];
      return Number.isInteger(savedAnswer) && savedAnswer >= 0 && savedAnswer < question.options.length
        ? savedAnswer
        : null;
    });

    const marked = test.questions.map((_, index) => Boolean(
      savedState.marked && savedState.marked[index]
    ));

    const playCounts = test.questions.map((_, index) => {
      const count = savedState.playCounts && Number(savedState.playCounts[index]);
      return Number.isInteger(count) && count >= 0 ? count : 0;
    });

    const startedAt = Number(savedState.startedAt) || Date.now();
    const legacyDuration = !savedState.mode;
    const endsAt = legacyDuration
      ? startedAt + mainTimerMinutes() * 60 * 1000
      : Number(savedState.endsAt) || (startedAt + mainTimerMinutes() * 60 * 1000);
    const currentIndex = Math.min(
      test.questions.length - 1,
      Math.max(0, Number(savedState.currentIndex) || 0)
    );

    return {
      testId: test.id,
      userId: user.id,
      answers,
      marked,
      playCounts,
      mode: savedState.mode === "practice" ? "practice" : "exam",
      soundCheckPassed: hasListeningSection() ? Boolean(savedState.soundCheckPassed) : true,
      listeningStartedAt: Number(savedState.listeningStartedAt) || null,
      listeningEndsAt: Number(savedState.listeningEndsAt) || null,
      mainTimeRemaining: Number(savedState.mainTimeRemaining) || null,
      currentIndex,
      startedAt,
      endsAt,
      updatedAt: Number(savedState.updatedAt) || Date.now()
    };
  }

  function persist() {
    if (!state || !test || !user) return false;
    state.updatedAt = Date.now();
    const saved = window.JLPTStorage.saveProgress(user.id, test.id, state);
    if (saved && window.JLPTApi) window.JLPTApi.queueProgress(test.id, state);

    if (!saved && !storageWarningShown && window.JLPTApp) {
      storageWarningShown = true;
      window.JLPTApp.toast("Progress could not be saved. Check browser storage permissions.", "error");
    }

    return saved;
  }

  function renderStartScreen() {
    const listeningCount = test.questions.filter((question) => question.section === "listening").length;
    selectedStartMode = listeningConfig().DEFAULT_MODE === "practice" ? "practice" : "exam";
    mount.innerHTML = `
      <section class="quiz-start-page page-section" aria-labelledby="quiz-start-title">
        <div class="container quiz-start-container">
          <div class="quiz-start-card">
            <span class="quiz-start-mark" aria-hidden="true">始</span>
            <span class="eyebrow eyebrow-accent">Before you begin</span>
            <h1 id="quiz-start-title">${escapeHTML(test.title)}</h1>
            <p>Choose how you want to take this test. The timer starts only after you select <strong>Begin test</strong>.</p>

            <div class="quiz-start-facts" aria-label="Test details">
              <span><b>${test.questions.length}</b> questions</span>
              <span><b>${test.duration}</b> minutes</span>
              ${listeningCount ? `<span><b>${listeningCount}</b> listening</span>` : ""}
            </div>

            <fieldset class="mode-fieldset">
              <legend>Choose a test mode</legend>
              <div class="mode-options" role="radiogroup" aria-label="Test mode">
                <button class="mode-card${selectedStartMode === "exam" ? " selected" : ""}" type="button" role="radio" aria-checked="${selectedStartMode === "exam"}" data-test-mode="exam">
                  <span class="mode-card-icon" aria-hidden="true">試</span>
                  <span><strong>Exam mode</strong><small>Two plays per listening question. No transcript during the test.</small></span>
                </button>
                <button class="mode-card${selectedStartMode === "practice" ? " selected" : ""}" type="button" role="radio" aria-checked="${selectedStartMode === "practice"}" data-test-mode="practice">
                  <span class="mode-card-icon" aria-hidden="true">練</span>
                  <span><strong>Practice mode</strong><small>Unlimited replay plus 0.75x, 1x, and 1.25x speed controls.</small></span>
                </button>
              </div>
            </fieldset>

            <div class="quiz-start-actions">
              <a class="button button-secondary" href="#/dashboard">Back to dashboard</a>
              <button class="button button-accent button-large" type="button" data-action="start-test">Begin test <span aria-hidden="true">→</span></button>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function renderShell() {
    const initialMinutes = mainTimerMinutes();
    renderedQuestionIndex = -1;
    mount.innerHTML = `
      <section class="quiz-page" aria-labelledby="quiz-title">
        <div class="quiz-topbar">
          <div class="container quiz-topbar-inner">
            <div class="quiz-heading">
              <span class="eyebrow">Timed practice</span>
              <h1 id="quiz-title">${escapeHTML(test.title)}</h1>
            </div>

            <div class="timer-wrap">
              <span class="timer-label" id="timer-label">Time remaining</span>
              <time class="quiz-timer" id="quiz-timer" datetime="PT${initialMinutes}M" aria-label="${initialMinutes} minutes remaining">${String(initialMinutes).padStart(2, "0")}:00</time>
            </div>

            <div class="quiz-progress-wrap">
              <div class="quiz-progress-copy">
                <span id="question-position">Question 1 of ${test.questions.length}</span>
                <span id="answered-summary">0 answered</span>
              </div>
              <progress class="quiz-progress" id="quiz-progress" value="1" max="${test.questions.length}" aria-label="Test progress">1 of ${test.questions.length}</progress>
            </div>
          </div>
        </div>

        <div class="container quiz-layout">
          <section class="question-card" aria-labelledby="question-text">
            <div class="question-meta">
              <div class="question-labels">
                <span class="section-badge" id="question-section">Vocabulary</span>
                <span class="listening-type" id="question-type" hidden></span>
              </div>
              <span class="keyboard-hint" aria-label="Keyboard shortcut information">Press 1–4 to answer</span>
            </div>

            <div id="audio-player-mount" hidden></div>
            <div id="practice-transcript"></div>
            <p class="question-text" id="question-text" lang="ja" tabindex="-1"></p>
            <div class="option-list" id="option-list" role="radiogroup" aria-labelledby="question-text"></div>

            <div class="question-actions">
              <button class="button button-secondary" id="previous-question" type="button" data-action="previous">
                <span aria-hidden="true">←</span> Previous
              </button>
              <button class="button button-quiet mark-button" id="mark-question" type="button" data-action="mark" aria-pressed="false">
                <span aria-hidden="true">☆</span> Mark for review
              </button>
              <button class="button button-primary" id="next-question" type="button" data-action="next">
                Next <span aria-hidden="true">→</span>
              </button>
            </div>
          </section>

          <aside class="review-panel" aria-labelledby="palette-title">
            <div class="review-panel-heading">
              <div>
                <span class="eyebrow">Overview</span>
                <h2 id="palette-title">Question palette</h2>
              </div>
              <span class="palette-total" id="palette-total">0/${test.questions.length}</span>
            </div>

            <div class="question-palette" id="question-palette"></div>
            <div class="palette-legend" aria-label="Question status legend">
              <span><i class="legend-dot legend-current" aria-hidden="true"></i> Current</span>
              <span><i class="legend-dot legend-answered" aria-hidden="true"></i> Answered</span>
              <span><i class="legend-dot legend-marked" aria-hidden="true"></i> Marked</span>
              <span><i class="legend-dot legend-empty" aria-hidden="true"></i> Unanswered</span>
            </div>

            <div class="review-actions">
              <button class="button button-accent button-block" type="button" data-action="submit">Submit test</button>
              <a class="button button-link button-block" href="#/dashboard" data-action="save-exit">Save &amp; exit</a>
            </div>
          </aside>
        </div>
      </section>
    `;
  }

  function updateTopProgress() {
    const answeredCount = state.answers.filter((answer) => answer !== null).length;
    const position = document.getElementById("question-position");
    const answeredSummary = document.getElementById("answered-summary");
    const progress = document.getElementById("quiz-progress");

    if (position) position.textContent = `Question ${state.currentIndex + 1} of ${test.questions.length}`;
    if (answeredSummary) answeredSummary.textContent = `${answeredCount} answered`;
    if (progress) {
      progress.value = state.currentIndex + 1;
      progress.textContent = `${state.currentIndex + 1} of ${test.questions.length}`;
    }
    return answeredCount;
  }

  function renderSoundCheck() {
    window.JLPTAudio.stop();
    updateTopProgress();

    const card = mount.querySelector(".question-card");
    const reviewPanel = mount.querySelector(".review-panel");
    if (!card) return;

    card.className = "question-card sound-check-card";
    card.setAttribute("aria-labelledby", "sound-check-title");
    if (reviewPanel) reviewPanel.hidden = true;
    card.innerHTML = `
      <div class="sound-check-icon" aria-hidden="true">🎧</div>
      <span class="eyebrow eyebrow-accent">Listening · 聴解</span>
      <h2 id="sound-check-title" tabindex="-1">Sound check</h2>
      <p>Check your device volume before the listening section begins. Use headphones and choose a comfortable volume.</p>

      <div class="sound-check-panel">
        <button class="button button-secondary button-large" type="button" data-action="play-test-sound">
          <span aria-hidden="true">▶</span> Play test sound
        </button>
        <span id="sound-check-status" role="status">Select the button to hear a short tone.</span>
      </div>

      <ul class="sound-tips">
        <li>Turn off silent mode and check your browser volume.</li>
        <li>Use headphones in a quiet place if possible.</li>
        <li>${state.mode === "exam" ? `Each question can be played ${listeningConfig().MAX_PLAYS} times.` : "Practice mode allows unlimited replay and speed control."}</li>
      </ul>

      <button class="button button-accent button-large" type="button" data-action="start-listening">
        I can hear it, start <span aria-hidden="true">→</span>
      </button>
    `;
    renderedQuestionIndex = state.currentIndex;
    window.requestAnimationFrame(() => document.getElementById("sound-check-title")?.focus());
  }

  function paletteLabel(index) {
    const labels = [`Question ${index + 1}`];
    labels.push(state.answers[index] === null ? "unanswered" : "answered");
    if (state.marked[index]) labels.push("marked for review");
    if (state.currentIndex === index) labels.push("current question");
    return labels.join(", ");
  }

  function renderQuestion(options = {}) {
    if (!state || !test) return;

    const question = test.questions[state.currentIndex];
    if (question.section === "listening" && !state.soundCheckPassed) {
      renderSoundCheck();
      return;
    }

    const questionChanged = renderedQuestionIndex !== state.currentIndex;
    if (questionChanged) window.JLPTAudio.stop();

    const selectedAnswer = state.answers[state.currentIndex];
    const answeredCount = updateTopProgress();
    const sectionName = SECTION_LABELS[question.section] || question.section;

    const section = document.getElementById("question-section");
    const questionType = document.getElementById("question-type");
    const keyboardHint = mount.querySelector(".keyboard-hint");
    const audioMount = document.getElementById("audio-player-mount");
    const practiceTranscript = document.getElementById("practice-transcript");
    const questionText = document.getElementById("question-text");
    const optionList = document.getElementById("option-list");
    const previousButton = document.getElementById("previous-question");
    const nextButton = document.getElementById("next-question");
    const markButton = document.getElementById("mark-question");
    const palette = document.getElementById("question-palette");
    const paletteTotal = document.getElementById("palette-total");

    section.textContent = sectionName;
    section.className = `section-badge section-${question.section}`;
    questionType.hidden = question.section !== "listening";
    questionType.textContent = question.section === "listening"
      ? String(question.type || "listening").replaceAll("-", " ")
      : "";
    keyboardHint.textContent = question.section === "listening"
      ? "1–4: answer · Space: audio · R: replay"
      : "Press 1–4 to answer";
    questionText.textContent = question.question;

    audioMount.hidden = question.section !== "listening";
    if (practiceTranscript) {
      practiceTranscript.innerHTML = question.section === "listening" && state.mode === "practice"
        ? `
          <details class="practice-transcript">
            <summary>Show practice transcript</summary>
            ${dialogueTranscript(question)}
            <p>${escapeHTML(question.scriptTranslation)}</p>
          </details>
        `
        : "";
    }

    optionList.innerHTML = question.options.map((option, index) => `
      <button
        class="option-card${selectedAnswer === index ? " selected" : ""}"
        type="button"
        role="radio"
        aria-checked="${selectedAnswer === index}"
        data-option="${index}"
      >
        <span class="option-number" aria-hidden="true">${index + 1}</span>
        <span class="option-content">
          ${optionImage(option) ? `<span class="option-image" aria-hidden="true">${escapeHTML(optionImage(option))}</span>` : ""}
          <span class="option-text" lang="ja">${escapeHTML(optionText(option))}</span>
        </span>
        <span class="option-check" aria-hidden="true">✓</span>
      </button>
    `).join("");

    previousButton.disabled = state.currentIndex === 0;
    nextButton.disabled = state.currentIndex === test.questions.length - 1;

    const isMarked = state.marked[state.currentIndex];
    markButton.classList.toggle("is-marked", isMarked);
    markButton.setAttribute("aria-pressed", String(isMarked));
    markButton.innerHTML = `<span aria-hidden="true">${isMarked ? "★" : "☆"}</span> ${isMarked ? "Marked for review" : "Mark for review"}`;

    palette.innerHTML = test.questions.map((_, index) => {
      const classes = ["palette-button"];
      classes.push(state.answers[index] === null ? "unanswered" : "answered");
      if (state.marked[index]) classes.push("marked");
      if (index === state.currentIndex) classes.push("current");

      return `
        <button
          class="${classes.join(" ")}"
          type="button"
          data-question="${index}"
          aria-label="${paletteLabel(index)}"
          ${index === state.currentIndex ? 'aria-current="step"' : ""}
        >${index + 1}</button>
      `;
    }).join("");

    paletteTotal.textContent = `${answeredCount}/${test.questions.length}`;
    renderedQuestionIndex = state.currentIndex;

    if (question.section === "listening" && questionChanged) {
      const nextQuestion = test.questions[state.currentIndex + 1];
      window.JLPTAudio.mountPlayer(audioMount, {
        question,
        mode: state.mode,
        maxPlays: listeningConfig().MAX_PLAYS,
        playCount: state.playCounts[state.currentIndex],
        nextQuestion,
        onPlayStart(count) {
          if (!state) return count;
          state.playCounts[state.currentIndex] = count;
          persist();
          return count;
        }
      });
    }

    if (Number.isInteger(options.focusOption)) {
      window.requestAnimationFrame(() => {
        const selected = optionList.querySelector(`[data-option="${options.focusOption}"]`);
        if (selected) selected.focus({ preventScroll: true });
      });
    } else if (options.focusQuestion) {
      window.requestAnimationFrame(() => questionText.focus({ preventScroll: false }));
    } else if (options.focusMark) {
      window.requestAnimationFrame(() => markButton.focus({ preventScroll: true }));
    }
  }

  function chooseAnswer(optionIndex) {
    if (!state || !test) return;
    const question = test.questions[state.currentIndex];
    if (optionIndex < 0 || optionIndex >= question.options.length) return;

    state.answers[state.currentIndex] = optionIndex;
    persist();
    renderQuestion({ focusOption: optionIndex });
  }

  function chooseStartMode(mode) {
    selectedStartMode = mode === "practice" ? "practice" : "exam";
    mount.querySelectorAll("[data-test-mode]").forEach((button) => {
      const selected = button.dataset.testMode === selectedStartMode;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-checked", String(selected));
    });
  }

  function beginTest() {
    if (state) return;
    state = createState(selectedStartMode);
    persist();
    renderShell();
    renderQuestion({ focusQuestion: true });
    updateTimer();
    timerId = window.setInterval(updateTimer, 1000);
  }

  function playTestSound() {
    const status = document.getElementById("sound-check-status");
    const played = window.JLPTAudio.playBeep();
    if (status) {
      status.textContent = played
        ? "Test sound played. Adjust your device volume if needed."
        : "Your browser could not play the test tone. Check its audio permissions.";
    }
  }

  function completeSoundCheck() {
    if (!state) return;
    const now = Date.now();
    state.soundCheckPassed = true;

    if (listeningConfig().TIMER_MODE === "section" && !state.listeningStartedAt) {
      state.mainTimeRemaining = Math.max(0, state.endsAt - now);
      state.listeningStartedAt = now;
      state.listeningEndsAt = now + (listeningConfig().LISTENING_DURATION_MINUTES * 60 * 1000);
    }

    persist();
    renderShell();
    renderQuestion({ focusQuestion: true });
    updateTimer();
  }

  function goToQuestion(index) {
    if (!state || index < 0 || index >= test.questions.length) return;
    if (index !== state.currentIndex) window.JLPTAudio.stop();
    state.currentIndex = index;
    renderedQuestionIndex = -1;
    persist();
    renderQuestion({ focusQuestion: true });
  }

  function toggleMarked() {
    state.marked[state.currentIndex] = !state.marked[state.currentIndex];
    persist();
    renderQuestion({ focusMark: true });
  }

  function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function stopTimer() {
    if (timerId) window.clearInterval(timerId);
    timerId = null;
  }

  function activeDeadline() {
    if (listeningConfig().TIMER_MODE === "section" && state.listeningEndsAt) {
      return state.listeningEndsAt;
    }
    return state.endsAt;
  }

  function updateTimer() {
    if (!state || submitting) return;
    const timer = document.getElementById("quiz-timer");
    const timerLabel = document.getElementById("timer-label");
    const secondsLeft = Math.max(0, Math.ceil((activeDeadline() - Date.now()) / 1000));
    const formatted = formatTime(secondsLeft);
    if (timer) {
      timer.textContent = formatted;
      timer.setAttribute("datetime", `PT${secondsLeft}S`);
      timer.setAttribute("aria-label", `${Math.floor(secondsLeft / 60)} minutes and ${secondsLeft % 60} seconds remaining`);
      timer.classList.toggle("timer-warning", secondsLeft <= 300);
    }
    if (timerLabel) {
      timerLabel.textContent = listeningConfig().TIMER_MODE === "section" && state.listeningEndsAt
        ? "Listening time"
        : "Time remaining";
    }
    document.title = `${formatted} · ${test.title}`;

    if (secondsLeft <= 0) {
      if (listeningConfig().TIMER_MODE === "section" && hasListeningSection() && !state.listeningStartedAt) {
        const listeningIndex = firstListeningIndex();
        if (state.currentIndex !== listeningIndex || state.soundCheckPassed) {
          window.JLPTAudio.stop();
          state.currentIndex = listeningIndex;
          state.soundCheckPassed = false;
          renderedQuestionIndex = -1;
          persist();
          renderShell();
          renderQuestion();
        }
        return;
      }
      stopTimer();
      submitTest(true);
    }
  }

  function calculateResult() {
    const pointsPerQuestion = MAX_SCORE / test.questions.length;
    let correctCount = 0;
    const sectionScores = {};
    const listeningTypeScores = {};

    test.questions.forEach((question, index) => {
      if (!sectionScores[question.section]) {
        sectionScores[question.section] = { score: 0, max: 0, correct: 0, total: 0 };
      }

      const section = sectionScores[question.section];
      const isCorrect = state.answers[index] === question.answer;
      section.max += pointsPerQuestion;
      section.total += 1;

      if (question.section === "listening") {
        const type = question.type || "other";
        if (!listeningTypeScores[type]) {
          listeningTypeScores[type] = { correct: 0, total: 0 };
        }
        listeningTypeScores[type].total += 1;
        if (isCorrect) listeningTypeScores[type].correct += 1;
      }

      if (isCorrect) {
        correctCount += 1;
        section.score += pointsPerQuestion;
        section.correct += 1;
      }
    });

    Object.values(sectionScores).forEach((section) => {
      section.score = Math.round(section.score);
      section.max = Math.round(section.max);
    });

    return {
      correctCount,
      score: Math.round(correctCount * pointsPerQuestion),
      sectionScores,
      listeningTypeScores
    };
  }

  async function requestSubmit() {
    if (submitting || !state) return;
    const unanswered = state.answers.filter((answer) => answer === null).length;
    const marked = state.marked.filter(Boolean).length;
    const details = [];

    if (unanswered) details.push(`${unanswered} unanswered`);
    if (marked) details.push(`${marked} marked for review`);

    const message = details.length
      ? `You still have ${details.join(" and ")}. You cannot change answers after submitting.`
      : "All questions are answered. You cannot change answers after submitting.";

    const confirmed = await window.JLPTApp.confirm({
      title: "Submit this test?",
      message,
      confirmLabel: "Submit test",
      tone: "accent"
    });

    if (confirmed) submitTest(false);
  }

  function submitTest(autoSubmitted) {
    if (submitting || !state || !test || !user) return;
    submitting = true;
    stopTimer();
    window.JLPTAudio.stop();

    if (autoSubmitted && window.JLPTApp) {
      window.JLPTApp.closeModal(false);
    }

    const now = Date.now();
    const result = calculateResult();
    const attempt = {
      id: window.JLPTStorage.createId("attempt"),
      userId: user.id,
      testId: test.id,
      testTitle: test.title,
      startedAt: new Date(state.startedAt).toISOString(),
      submittedAt: new Date(now).toISOString(),
      durationUsed: Math.max(0, Math.round((now - state.startedAt) / 1000)),
      answers: state.answers.slice(),
      marked: state.marked.slice(),
      playCounts: state.playCounts.slice(),
      mode: state.mode,
      correctCount: result.correctCount,
      totalQuestions: test.questions.length,
      score: result.score,
      maxScore: MAX_SCORE,
      passMark: PASS_MARK,
      passed: result.score >= PASS_MARK,
      sectionScores: result.sectionScores,
      listeningTypeScores: result.listeningTypeScores,
      autoSubmitted: Boolean(autoSubmitted)
    };

    if (!window.JLPTStorage.saveAttempt(attempt)) {
      submitting = false;
      window.JLPTApp.toast("Your result could not be saved. Please check browser storage and try again.", "error");
      return;
    }

    window.JLPTStorage.clearProgress(user.id, test.id);
    window.JLPTApi.clearProgress(test.id);
    window.JLPTApi.saveAttempt(attempt);
    state = null;

    if (autoSubmitted) {
      window.JLPTApp.toast("Time is up. Your test was submitted automatically.", "warning");
    }

    window.JLPTApp.navigate(`/result/${attempt.id}`);
  }

  function handleClick(event) {
    const modeButton = event.target.closest("[data-test-mode]");
    if (modeButton && mount.contains(modeButton)) {
      chooseStartMode(modeButton.dataset.testMode);
      return;
    }

    const option = event.target.closest("[data-option]");
    if (option && mount.contains(option)) {
      chooseAnswer(Number(option.dataset.option));
      return;
    }

    const paletteButton = event.target.closest("[data-question]");
    if (paletteButton && mount.contains(paletteButton)) {
      goToQuestion(Number(paletteButton.dataset.question));
      return;
    }

    const actionButton = event.target.closest("[data-action]");
    if (!actionButton || !mount.contains(actionButton)) return;

    switch (actionButton.dataset.action) {
      case "start-test":
        beginTest();
        break;
      case "play-test-sound":
        playTestSound();
        break;
      case "start-listening":
        completeSoundCheck();
        break;
      case "previous":
        if (state) goToQuestion(state.currentIndex - 1);
        break;
      case "next":
        if (state) goToQuestion(state.currentIndex + 1);
        break;
      case "mark":
        toggleMarked();
        break;
      case "submit":
        requestSubmit();
        break;
      case "save-exit":
        persist();
        break;
      default:
        break;
    }
  }

  function handleKeydown(event) {
    if (!state || submitting || event.altKey || event.ctrlKey || event.metaKey) return;
    if (document.getElementById("modal-root").childElementCount) return;

    const tagName = document.activeElement ? document.activeElement.tagName : "";
    if (["INPUT", "TEXTAREA", "SELECT"].includes(tagName)) return;
    const question = test.questions[state.currentIndex];
    if (question.section === "listening" && !state.soundCheckPassed) return;

    if (/^[1-4]$/.test(event.key)) {
      event.preventDefault();
      chooseAnswer(Number(event.key) - 1);
    }
  }

  function handleVisibilityChange() {
    if (!document.hidden) updateTimer();
  }

  function init(testId, target) {
    destroy();
    test = findTest(testId);
    user = window.JLPTAuth.currentUser();
    mount = target;
    submitting = false;
    storageWarningShown = false;

    if (!test || !user || !mount) return false;

    const savedState = window.JLPTStorage.getProgress(user.id, test.id);
    mount.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeydown);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const canResume = Boolean(
      savedState
      && savedState.testId === test.id
      && savedState.userId === user.id
      && Array.isArray(savedState.answers)
    );

    if (canResume) {
      state = normalizeState(savedState);
      persist();
      renderShell();
      renderQuestion();
      updateTimer();
      if (state && !submitting) timerId = window.setInterval(updateTimer, 1000);
    } else {
      state = null;
      selectedStartMode = listeningConfig().DEFAULT_MODE === "practice" ? "practice" : "exam";
      renderStartScreen();
    }
    return true;
  }

  function destroy() {
    stopTimer();
    window.JLPTAudio.stop();
    document.removeEventListener("keydown", handleKeydown);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    if (mount) mount.removeEventListener("click", handleClick);

    if (state && !submitting) persist();

    test = null;
    user = null;
    state = null;
    mount = null;
    submitting = false;
    renderedQuestionIndex = -1;
    document.title = "Nihongo N5 | JLPT Mock Tests";
  }

  window.JLPTQuiz = {
    init,
    destroy
  };
}());
