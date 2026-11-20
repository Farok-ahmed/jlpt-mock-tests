(function () {
  "use strict";

  const TYPE_LABELS = {
    task: "Task understanding",
    point: "Key points",
    utterance: "Verbal expressions",
    "quick-response": "Quick response"
  };

  let mount = null;
  let user = null;
  let queue = [];
  let currentIndex = 0;
  let sessionAnswers = [];
  let answered = false;

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

  function buildQueue() {
    const records = new Map();
    const attempts = window.JLPTStorage.getAttempts(user.id);

    attempts.forEach((attempt) => {
      const test = getTests().find((item) => item.id === attempt.testId);
      if (!test || !Array.isArray(attempt.answers)) return;

      test.questions.forEach((question, questionIndex) => {
        if (question.section !== "listening") return;
        if (questionIndex >= attempt.answers.length) return;
        const key = `${test.id}::${question.id}`;
        const isCorrect = attempt.answers[questionIndex] === question.answer;
        let record = records.get(key);

        if (!record) {
          record = {
            key,
            testId: test.id,
            testTitle: test.title,
            question,
            mistakes: 0,
            latestWasCorrect: isCorrect,
            lastMissedAt: ""
          };
          records.set(key, record);
        }

        if (!isCorrect) {
          record.mistakes += 1;
          if (!record.lastMissedAt || new Date(attempt.submittedAt) > new Date(record.lastMissedAt)) {
            record.lastMissedAt = attempt.submittedAt;
          }
        }
      });
    });

    return Array.from(records.values())
      .filter((record) => record.mistakes > 0)
      .sort((a, b) => {
        if (a.latestWasCorrect !== b.latestWasCorrect) return a.latestWasCorrect ? 1 : -1;
        if (b.mistakes !== a.mistakes) return b.mistakes - a.mistakes;
        return new Date(b.lastMissedAt) - new Date(a.lastMissedAt);
      });
  }

  function renderEmpty() {
    mount.innerHTML = `
      <section class="listening-retry-page page-section">
        <div class="container retry-empty-state">
          <span aria-hidden="true">聴</span>
          <h1>No listening mistakes to retry</h1>
          <p>Complete a listening test first, or celebrate that your saved listening answers are all correct.</p>
          <a class="button button-primary" href="#/dashboard">Back to dashboard</a>
        </div>
      </section>
    `;
  }

  function renderQuestion() {
    window.JLPTAudio.stop();
    const item = queue[currentIndex];
    const question = item.question;
    const nextItem = queue[currentIndex + 1];
    answered = false;

    mount.innerHTML = `
      <section class="listening-retry-page" aria-labelledby="retry-title">
        <div class="retry-topbar">
          <div class="container retry-topbar-inner">
            <div>
              <span class="eyebrow">Weak-point practice</span>
              <h1 id="retry-title">Listening retry</h1>
            </div>
            <div class="retry-progress-copy">
              <strong>${currentIndex + 1} / ${queue.length}</strong>
              <span>${sessionAnswers.filter((answer) => answer !== undefined).length} reviewed</span>
            </div>
            <progress value="${currentIndex + 1}" max="${queue.length}" aria-label="Retry session progress">${currentIndex + 1} of ${queue.length}</progress>
          </div>
        </div>

        <div class="container retry-session-layout">
          <article class="question-card retry-question-card">
            <div class="question-meta">
              <div class="question-labels">
                <span class="section-badge section-listening">Listening · 聴解</span>
                <span class="listening-type">${escapeHTML(TYPE_LABELS[question.type] || question.type)}</span>
              </div>
              <span class="retry-mistake-count">Missed ${item.mistakes} time${item.mistakes === 1 ? "" : "s"}</span>
            </div>

            <div id="retry-audio-player"></div>
            <p class="question-text" id="retry-question-text" lang="ja">${escapeHTML(question.question)}</p>
            <div class="option-list" role="radiogroup" aria-labelledby="retry-question-text">
              ${question.options.map((option, index) => `
                <button class="option-card" type="button" role="radio" aria-checked="false" data-retry-option="${index}">
                  <span class="option-number" aria-hidden="true">${index + 1}</span>
                  <span class="option-content">
                    ${optionImage(option) ? `<span class="option-image" aria-hidden="true">${escapeHTML(optionImage(option))}</span>` : ""}
                    <span class="option-text" lang="ja">${escapeHTML(optionText(option))}</span>
                  </span>
                  <span class="option-check" aria-hidden="true">✓</span>
                </button>
              `).join("")}
            </div>

            <div class="retry-feedback" id="retry-feedback" tabindex="-1" hidden></div>

            <div class="retry-question-actions">
              <a class="button button-link" href="#/dashboard">Save &amp; exit</a>
              <button class="button button-secondary" type="button" data-retry-skip>Skip</button>
              <button class="button button-primary" type="button" data-retry-next disabled>${currentIndex === queue.length - 1 ? "See summary" : "Next question"} <span aria-hidden="true">→</span></button>
            </div>
          </article>
        </div>
      </section>
    `;

    window.JLPTAudio.mountPlayer(document.getElementById("retry-audio-player"), {
      question,
      mode: "practice",
      playCount: 0,
      nextQuestion: nextItem && nextItem.question,
      onPlayStart(count) {
        return count;
      }
    });
  }

  function revealAnswer(selectedIndex) {
    if (answered) return;
    answered = true;
    const item = queue[currentIndex];
    const question = item.question;
    const isCorrect = selectedIndex === question.answer;
    sessionAnswers[currentIndex] = { selectedIndex, isCorrect };

    mount.querySelectorAll("[data-retry-option]").forEach((button) => {
      const optionIndex = Number(button.dataset.retryOption);
      button.disabled = true;
      button.setAttribute("aria-checked", String(optionIndex === selectedIndex));
      if (optionIndex === question.answer) button.classList.add("retry-option-correct");
      if (optionIndex === selectedIndex && !isCorrect) button.classList.add("retry-option-wrong");
    });

    const feedback = document.getElementById("retry-feedback");
    feedback.hidden = false;
    feedback.classList.toggle("is-correct", isCorrect);
    feedback.classList.toggle("is-wrong", !isCorrect);
    feedback.innerHTML = `
      <div class="retry-feedback-heading">
        <strong>${isCorrect ? "Correct" : selectedIndex === null ? "Skipped" : "Not quite"}</strong>
        <span>Correct answer: <b lang="ja">${escapeHTML(optionText(question.options[question.answer]))}</b></span>
      </div>
      <p>${escapeHTML(question.explanation)}</p>
      <details class="retry-transcript">
        <summary>Review transcript</summary>
        ${dialogueTranscript(question)}
        <p>${escapeHTML(question.scriptTranslation)}</p>
      </details>
    `;

    const nextButton = mount.querySelector("[data-retry-next]");
    nextButton.disabled = false;
    window.requestAnimationFrame(() => feedback.focus());
  }

  function renderSummary() {
    window.JLPTAudio.stop();
    const correct = sessionAnswers.filter((answer) => answer && answer.isCorrect).length;
    const percentage = queue.length ? Math.round(correct / queue.length * 100) : 0;

    mount.innerHTML = `
      <section class="listening-retry-page page-section">
        <div class="container retry-summary-card">
          <span class="retry-summary-mark" aria-hidden="true">復習</span>
          <span class="eyebrow eyebrow-accent">Session complete</span>
          <h1>${correct} of ${queue.length} correct</h1>
          <p>You scored ${percentage}% on questions you previously missed. Repeat the session or return to a full mock test when ready.</p>
          <div class="retry-summary-actions">
            <button class="button button-accent" type="button" data-retry-restart>Retry again</button>
            <a class="button button-secondary" href="#/dashboard">Back to dashboard</a>
          </div>
        </div>
      </section>
    `;
  }

  function nextQuestion() {
    if (!answered) return;
    if (currentIndex >= queue.length - 1) {
      renderSummary();
      return;
    }
    currentIndex += 1;
    renderQuestion();
  }

  function handleClick(event) {
    const option = event.target.closest("[data-retry-option]");
    if (option && mount.contains(option)) {
      revealAnswer(Number(option.dataset.retryOption));
      return;
    }

    if (event.target.closest("[data-retry-skip]")) {
      revealAnswer(null);
      return;
    }
    if (event.target.closest("[data-retry-next]")) {
      nextQuestion();
      return;
    }
    if (event.target.closest("[data-retry-restart]")) {
      currentIndex = 0;
      sessionAnswers = [];
      renderQuestion();
    }
  }

  function handleKeydown(event) {
    if (!mount || answered || event.altKey || event.ctrlKey || event.metaKey) return;
    const tagName = document.activeElement ? document.activeElement.tagName : "";
    if (["INPUT", "SELECT", "TEXTAREA"].includes(tagName)) return;
    if (/^[1-4]$/.test(event.key)) {
      event.preventDefault();
      revealAnswer(Number(event.key) - 1);
    }
  }

  function init(target) {
    destroy();
    mount = target;
    user = window.JLPTAuth.currentUser();
    if (!mount || !user) return false;

    queue = buildQueue();
    currentIndex = 0;
    sessionAnswers = [];
    mount.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeydown);

    if (queue.length) renderQuestion();
    else renderEmpty();
    return true;
  }

  function destroy() {
    window.JLPTAudio.stop();
    if (mount) mount.removeEventListener("click", handleClick);
    document.removeEventListener("keydown", handleKeydown);
    mount = null;
    user = null;
    queue = [];
    currentIndex = 0;
    sessionAnswers = [];
    answered = false;
  }

  window.JLPTListeningReview = {
    init,
    destroy
  };
}());
