(function () {
  "use strict";

  const SECTION_LABELS = {
    vocabulary: "Vocabulary",
    grammar: "Grammar",
    reading: "Reading",
    listening: "Listening · 聴解"
  };
  const LISTENING_TYPE_LABELS = {
    task: "Task understanding",
    point: "Key points",
    utterance: "Verbal expressions",
    "quick-response": "Quick response"
  };

  let appElement = null;
  let navElement = null;
  let themeButton = null;
  let toastElement = null;
  let modalRoot = null;
  let toastTimer = null;
  let modalResolve = null;
  let modalKeyHandler = null;
  let modalPreviousFocus = null;
  let cloudSyncInProgress = false;
  let lastCloudSyncAt = 0;

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
    return getTests().find((test) => test.id === testId) || null;
  }

  function optionText(option) {
    return typeof option === "string" ? option : option.text;
  }

  function sectionSymbol(section) {
    return { vocabulary: "語", grammar: "文", reading: "読", listening: "聴" }[section] || "問";
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

  function navigate(path) {
    const nextHash = `#${path.startsWith("/") ? path : `/${path}`}`;
    if (window.location.hash === nextHash) {
      renderRoute();
    } else {
      window.location.hash = nextHash;
    }
  }

  function parseRoute() {
    const hash = window.location.hash.slice(1) || "/";
    const path = hash.split("?")[0];
    const normalized = path.startsWith("/") ? path : `/${path}`;

    return normalized
      .split("/")
      .filter(Boolean)
      .map((segment) => {
        try {
          return decodeURIComponent(segment);
        } catch (error) {
          return segment;
        }
      });
  }

  function currentPath() {
    const segments = parseRoute();
    return segments.length ? `/${segments.join("/")}` : "/";
  }

  function updateHeader() {
    const user = window.JLPTAuth.currentUser();
    const path = currentPath();

    if (user) {
      navElement.innerHTML = `
        <span class="nav-user" title="Signed in as ${escapeHTML(user.email)}">Hi, ${escapeHTML(user.name.split(/\s+/)[0])}</span>
        <span class="sync-status" data-sync-status data-state="local" title="Progress is saved in this browser"><i aria-hidden="true"></i><span>Local</span></span>
        <a class="nav-link${path === "/dashboard" ? " active" : ""}" href="#/dashboard" ${path === "/dashboard" ? 'aria-current="page"' : ""}>Dashboard</a>
        <button class="nav-link nav-button" type="button" data-logout>Log out</button>
      `;
    } else {
      navElement.innerHTML = `
        <a class="nav-link${path === "/" ? " active" : ""}" href="#/" ${path === "/" ? 'aria-current="page"' : ""}>Home</a>
        <a class="nav-link${path === "/login" ? " active" : ""}" href="#/login" ${path === "/login" ? 'aria-current="page"' : ""}>Log in</a>
        <a class="button button-primary button-small" href="#/register">Register</a>
      `;
    }
    updateSyncStatus({ state: window.JLPTApi.status() });
  }

  function updateSyncStatus(detail = {}) {
    const indicator = document.querySelector("[data-sync-status]");
    if (!indicator) return;
    const state = detail.state || "local";
    const labels = {
      online: "Synced",
      syncing: "Syncing",
      available: "Cloud ready",
      local: "Local"
    };
    indicator.dataset.state = state;
    indicator.querySelector("span").textContent = labels[state] || "Local";
    indicator.title = detail.message || (state === "online"
      ? "Progress is synchronized with the Python backend"
      : "Progress is saved safely in this browser");
  }

  function syncDashboardData(user) {
    if (!window.JLPTApi.hasSession() || cloudSyncInProgress || Date.now() - lastCloudSyncAt < 5000) return;
    cloudSyncInProgress = true;
    window.JLPTApi.syncUserData(user).then((synced) => {
      lastCloudSyncAt = Date.now();
      if (synced && currentPath() === "/dashboard") {
        renderDashboard();
        setupRevealAnimations();
      }
    }).finally(() => {
      cloudSyncInProgress = false;
    });
  }

  function updateThemeButton() {
    const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const nextTheme = theme === "dark" ? "light" : "dark";
    themeButton.innerHTML = `<span aria-hidden="true">${theme === "dark" ? "☀" : "☾"}</span>`;
    themeButton.setAttribute("aria-label", `Switch to ${nextTheme} mode`);
    themeButton.title = `Switch to ${nextTheme} mode`;

    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = theme === "dark" ? "#12161F" : "#FAF7F2";
  }

  function toggleTheme() {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    window.JLPTStorage.setTheme(nextTheme);
    updateThemeButton();
  }

  function toast(message, tone = "info") {
    if (!toastElement) return;
    window.clearTimeout(toastTimer);
    toastElement.textContent = message;
    toastElement.className = `toast show toast-${["error", "warning", "success"].includes(tone) ? tone : "info"}`;

    toastTimer = window.setTimeout(() => {
      toastElement.classList.remove("show");
    }, 4200);
  }

  function setupRevealAnimations() {
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const elements = appElement.querySelectorAll(
      ".feature-card, .roadmap-list li, .exam-component-grid article, .daily-plan article, .resource-cards > a, .achievement-card, .test-card"
    );
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12 });
    elements.forEach((element, index) => {
      element.classList.add("reveal-ready");
      element.style.setProperty("--reveal-delay", `${Math.min(index % 4, 3) * 55}ms`);
      observer.observe(element);
    });
  }

  function closeModal(value = false) {
    if (!modalRoot || !modalRoot.firstElementChild) return;

    document.removeEventListener("keydown", modalKeyHandler);
    document.body.classList.remove("modal-open");
    modalRoot.replaceChildren();

    const resolve = modalResolve;
    modalResolve = null;
    modalKeyHandler = null;

    if (modalPreviousFocus && document.contains(modalPreviousFocus)) {
      modalPreviousFocus.focus({ preventScroll: true });
    }
    modalPreviousFocus = null;

    if (resolve) resolve(value);
  }

  function confirm(options) {
    closeModal(false);
    const title = options.title || "Are you sure?";
    const message = options.message || "Please confirm this action.";
    const confirmLabel = options.confirmLabel || "Confirm";
    const toneClass = options.tone === "accent" ? "button-accent" : "button-primary";
    modalPreviousFocus = document.activeElement;

    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-modal-backdrop>
        <section class="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-message">
          <div class="modal-symbol" aria-hidden="true">確認</div>
          <h2 id="modal-title">${escapeHTML(title)}</h2>
          <p id="modal-message">${escapeHTML(message)}</p>
          <div class="modal-actions">
            <button class="button button-secondary" type="button" data-modal-cancel>Cancel</button>
            <button class="button ${toneClass}" type="button" data-modal-confirm>${escapeHTML(confirmLabel)}</button>
          </div>
        </section>
      </div>
    `;

    document.body.classList.add("modal-open");

    return new Promise((resolve) => {
      modalResolve = resolve;
      const cancelButton = modalRoot.querySelector("[data-modal-cancel]");
      const confirmButton = modalRoot.querySelector("[data-modal-confirm]");
      const backdrop = modalRoot.querySelector("[data-modal-backdrop]");

      cancelButton.addEventListener("click", () => closeModal(false));
      confirmButton.addEventListener("click", () => closeModal(true));
      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) closeModal(false);
      });

      modalKeyHandler = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeModal(false);
          return;
        }

        if (event.key !== "Tab") return;
        const focusable = Array.from(modalRoot.querySelectorAll("button:not(:disabled), a[href]"));
        if (!focusable.length) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      };

      document.addEventListener("keydown", modalKeyHandler);
      window.requestAnimationFrame(() => cancelButton.focus());
    });
  }

  function renderLanding() {
    const user = window.JLPTAuth.currentUser();
    const startHref = user ? "#/dashboard" : "#/register";

    appElement.innerHTML = `
      <section class="hero">
        <div class="container hero-grid">
          <div class="hero-copy">
            <span class="eyebrow eyebrow-accent">JLPT N5 mock practice</span>
            <h1>Small steps.<br><span>確かな progress.</span></h1>
            <p class="hero-lead">Build exam confidence with calm, timed N5 practice and clear explanations for every mistake.</p>
            <div class="hero-actions">
              <a class="button button-accent button-large" href="${startHref}">Start practice <span aria-hidden="true">→</span></a>
              <a class="text-link" href="#/" data-scroll-to="exam-info">See exam format</a>
            </div>
            <div class="hero-trust" aria-label="Practice highlights">
              <span><b>2</b> complete mocks</span>
              <span><b>${getTests().reduce((total, test) => total + test.questions.length, 0)}</b> N5 questions</span>
              <span><b>100%</b> offline-safe</span>
            </div>
          </div>

          <div class="hero-art" aria-hidden="true">
            <div class="enso enso-outer"></div>
            <div class="enso enso-inner"></div>
            <div class="hero-kanji">学</div>
            <span class="sakura-petal petal-one"></span>
            <span class="sakura-petal petal-two"></span>
            <span class="sakura-petal petal-three"></span>
            <div class="hero-stamp">日本語<br>N5</div>
          </div>
        </div>
      </section>

      <section class="section features-section" aria-labelledby="features-title">
        <div class="container">
          <div class="section-heading centered">
            <span class="eyebrow">Practice with purpose</span>
            <h2 id="features-title">Everything you need to improve</h2>
            <p>Focus on one test at a time. We will keep the rest organized for you.</p>
          </div>

          <div class="feature-grid">
            <article class="feature-card">
              <span class="feature-number">一</span>
              <div>
                <h3>Realistic timing</h3>
                <p>A persistent countdown and automatic submission help you practice under pressure.</p>
              </div>
            </article>
            <article class="feature-card">
              <span class="feature-number">二</span>
              <div>
                <h3>Clear review</h3>
                <p>See every missed answer, the correct choice, and a short explanation after each test.</p>
              </div>
            </article>
            <article class="feature-card">
              <span class="feature-number">三</span>
              <div>
                <h3>Visible progress</h3>
                <p>Your attempt history and score chart make steady improvement easy to see.</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section class="section roadmap-section" id="roadmap" aria-labelledby="roadmap-title">
        <div class="container">
          <div class="section-heading roadmap-heading">
            <div>
              <span class="eyebrow eyebrow-accent">学習の道 · Your path</span>
              <h2 id="roadmap-title">A calm roadmap to N5 readiness</h2>
            </div>
            <p>Move from recognition to confident exam practice in four focused stages.</p>
          </div>
          <ol class="roadmap-list">
            <li>
              <span class="roadmap-step">01</span>
              <div><small>Foundation</small><h3>Learn the essentials</h3><p>Build core kana, everyday vocabulary, and basic sentence patterns.</p><b>Weeks 1–3</b></div>
            </li>
            <li>
              <span class="roadmap-step">02</span>
              <div><small>Comprehension</small><h3>Read and listen daily</h3><p>Use short passages and natural dialogues to recognize meaning quickly.</p><b>Weeks 4–6</b></div>
            </li>
            <li>
              <span class="roadmap-step">03</span>
              <div><small>Application</small><h3>Practice weak points</h3><p>Review mistakes by question type and repeat difficult listening lines.</p><b>Weeks 7–8</b></div>
            </li>
            <li>
              <span class="roadmap-step">04</span>
              <div><small>Exam readiness</small><h3>Take timed mocks</h3><p>Build pacing, confidence, and a consistent passing score.</p><b>Weeks 9–10</b></div>
            </li>
          </ol>
        </div>
      </section>

      <section class="section exam-section" id="exam-info" aria-labelledby="exam-title">
        <div class="container exam-grid">
          <div class="exam-copy">
            <span class="eyebrow eyebrow-accent">Know the format</span>
            <h2 id="exam-title">A focused N5 practice experience</h2>
            <p>These mock tests cover core language knowledge, reading, and audio-based listening. Each test uses an easy-to-read 180-point score scale.</p>
            <p class="exam-note"><span aria-hidden="true">※</span> Official JLPT timing, weighting, and sectional score requirements differ from this practice app.</p>
          </div>

          <div class="exam-facts">
            <article class="exam-fact">
              <span class="fact-icon" aria-hidden="true">語</span>
              <div><strong>4 sections</strong><span>Vocabulary · Grammar · Reading · Listening</span></div>
            </article>
            <article class="exam-fact">
              <span class="fact-icon" aria-hidden="true">時</span>
              <div><strong>30–60 minutes</strong><span>Depending on the mock test</span></div>
            </article>
            <article class="exam-fact">
              <span class="fact-icon" aria-hidden="true">合</span>
              <div><strong>80 / 180</strong><span>Practice passing score</span></div>
            </article>
          </div>
        </div>
        <div class="container exam-component-grid" aria-label="Practice section guide">
          <article><span aria-hidden="true">文字</span><h3>Vocabulary</h3><p>Kanji readings, meanings, spelling, and words used in context.</p></article>
          <article><span aria-hidden="true">文法</span><h3>Grammar</h3><p>Particles, verb forms, sentence order, and everyday expressions.</p></article>
          <article><span aria-hidden="true">読解</span><h3>Reading</h3><p>Notices, messages, schedules, and short practical passages.</p></article>
          <article><span aria-hidden="true">聴解</span><h3>Listening</h3><p>Tasks, key points, utterances, and quick-response dialogues.</p></article>
        </div>
      </section>

      <section class="section daily-section" id="daily-practice" aria-labelledby="daily-title">
        <div class="container daily-layout">
          <div class="daily-intro">
            <span class="eyebrow eyebrow-accent">今日の練習 · Daily practice</span>
            <h2 id="daily-title">Twenty focused minutes are enough.</h2>
            <p>A small repeatable routine keeps every N5 skill active without making study feel heavy.</p>
            <a class="button button-primary" href="${startHref}">Open my practice space <span aria-hidden="true">→</span></a>
          </div>
          <div class="daily-plan">
            <article><time>05</time><div><span>minutes</span><h3>Vocabulary recall</h3><p>Review ten useful words and one kanji reading.</p></div><i aria-hidden="true">語</i></article>
            <article><time>05</time><div><span>minutes</span><h3>Grammar pattern</h3><p>Build three sentences with today's particle or verb form.</p></div><i aria-hidden="true">文</i></article>
            <article><time>10</time><div><span>minutes</span><h3>Listening + shadowing</h3><p>Replay one dialogue, then record yourself matching its rhythm.</p></div><i aria-hidden="true">聴</i></article>
          </div>
        </div>
      </section>

      <section class="section resources-section" id="resources" aria-labelledby="resources-title">
        <div class="container">
          <div class="section-heading centered">
            <span class="eyebrow">Study with clarity</span>
            <h2 id="resources-title">Resources and common questions</h2>
            <p>Use the app intentionally, understand your scores, and know what to practice next.</p>
          </div>
          <div class="resources-layout">
            <div class="resource-cards">
              <a href="#/" data-scroll-to="roadmap"><span aria-hidden="true">道</span><div><h3>N5 study roadmap</h3><p>Follow the four-stage learning path.</p></div><b aria-hidden="true">→</b></a>
              <a href="#/" data-scroll-to="exam-info"><span aria-hidden="true">試</span><div><h3>Mock test guide</h3><p>Understand sections, time, and scoring.</p></div><b aria-hidden="true">→</b></a>
              <a href="${startHref}"><span aria-hidden="true">進</span><div><h3>Progress dashboard</h3><p>See trends, weak points, and achievements.</p></div><b aria-hidden="true">→</b></a>
            </div>
            <div class="faq-list">
              <details><summary>Is this the official JLPT?</summary><p>No. It is an independent practice app inspired by N5 question styles. Official timing and score weighting may differ.</p></details>
              <details><summary>Where is my progress saved?</summary><p>Progress is saved immediately in your browser. When the Python backend is running and you sign into a cloud account, it also syncs to SQLite.</p></details>
              <details><summary>What happens when audio is missing?</summary><p>The player automatically uses a Japanese computer voice, so every listening question remains usable.</p></details>
              <details><summary>How should I use shadowing?</summary><p>Listen to one line, repeat it aloud, record yourself, then compare rhythm, pauses, and pitch.</p></details>
            </div>
          </div>
        </div>
      </section>

      <section class="cta-section">
        <div class="container cta-card">
          <div>
            <span class="eyebrow">Ready when you are</span>
            <h2>Take your first mock test today.</h2>
          </div>
          <a class="button button-accent button-large" href="${startHref}">Begin now <span aria-hidden="true">→</span></a>
        </div>
      </section>
    `;
  }

  function renderAuth(mode) {
    const isRegister = mode === "register";

    appElement.innerHTML = `
      <section class="auth-page page-section">
        <div class="container auth-layout">
          <div class="auth-message">
            <span class="eyebrow eyebrow-accent">${isRegister ? "Begin your journey" : "Welcome back"}</span>
            <h1>${isRegister ? "Your next step starts here." : "Continue where you left off."}</h1>
            <p>${isRegister ? "Create an account to save locally first and synchronize securely when the Python backend is online." : "Sign in to resume a test or synchronize your previous results."}</p>
            <blockquote>
              <span lang="ja">千里の道も一歩から</span>
              <small>Even a journey of a thousand miles begins with one step.</small>
            </blockquote>
          </div>

          <div class="auth-card">
            <div class="auth-tabs" role="tablist" aria-label="Account options">
              <a class="auth-tab${!isRegister ? " active" : ""}" href="#/login" role="tab" aria-selected="${!isRegister}">Log in</a>
              <a class="auth-tab${isRegister ? " active" : ""}" href="#/register" role="tab" aria-selected="${isRegister}">Register</a>
            </div>

            <div class="auth-card-body">
              <h2>${isRegister ? "Create an account" : "Log in to your account"}</h2>
              <p>${isRegister ? "It only takes a moment." : "Enter the details you registered with."}</p>

              <form data-auth-form="${mode}" novalidate>
                <div class="form-message" id="form-message" role="alert" hidden></div>

                ${isRegister ? `
                  <div class="form-group">
                    <label for="name">Name</label>
                    <input id="name" name="name" type="text" autocomplete="name" maxlength="60" placeholder="Your name" aria-describedby="name-error" required>
                    <span class="field-error" id="name-error"></span>
                  </div>
                ` : ""}

                <div class="form-group">
                  <label for="email">Email</label>
                  <input id="email" name="email" type="email" autocomplete="email" placeholder="you@example.com" aria-describedby="email-error" required>
                  <span class="field-error" id="email-error"></span>
                </div>

                <div class="form-group">
                  <label for="password">Password</label>
                  <input id="password" name="password" type="password" autocomplete="${isRegister ? "new-password" : "current-password"}" placeholder="At least 6 characters" aria-describedby="password-hint password-error" required>
                  <span class="field-hint" id="password-hint">${isRegister ? "Use 6 or more characters." : ""}</span>
                  <span class="field-error" id="password-error"></span>
                </div>

                <button class="button button-primary button-block button-large" type="submit">${isRegister ? "Create account" : "Log in"}</button>
              </form>

              <p class="auth-switch">${isRegister ? "Already have an account?" : "New to Nihongo N5?"} <a href="#/${isRegister ? "login" : "register"}">${isRegister ? "Log in" : "Create one"}</a></p>
              <p class="demo-notice"><span aria-hidden="true">ⓘ</span> Offline-safe — local progress syncs automatically when the backend is available.</p>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function formatDate(value, includeTime = false) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown date";

    const options = includeTime
      ? { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
      : { year: "numeric", month: "short", day: "numeric" };
    return new Intl.DateTimeFormat(undefined, options).format(date);
  }

  function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Number(totalSeconds) || 0);
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}m ${String(remainder).padStart(2, "0")}s`;
  }

  function buildListeningAnalytics(userId) {
    const types = Object.fromEntries(Object.keys(LISTENING_TYPE_LABELS).map((type) => [type, {
      correct: 0,
      total: 0,
      history: []
    }]));
    const mistakes = new Map();
    const attempts = window.JLPTStorage.getAttempts(userId).slice().reverse();
    let correct = 0;
    let total = 0;

    attempts.forEach((attempt) => {
      const test = findTest(attempt.testId);
      if (!test || !Array.isArray(attempt.answers)) return;
      const perAttempt = {};

      test.questions.forEach((question, index) => {
        if (question.section !== "listening") return;
        if (index >= attempt.answers.length) return;
        const type = question.type || "utterance";
        if (!types[type]) types[type] = { correct: 0, total: 0, history: [] };
        if (!perAttempt[type]) perAttempt[type] = { correct: 0, total: 0 };

        const isCorrect = attempt.answers[index] === question.answer;
        types[type].total += 1;
        perAttempt[type].total += 1;
        total += 1;

        const key = `${test.id}::${question.id}`;
        let record = mistakes.get(key);
        if (!record) {
          record = { question, testId: test.id, count: 0, latestWasCorrect: isCorrect };
          mistakes.set(key, record);
        }
        record.latestWasCorrect = isCorrect;

        if (isCorrect) {
          types[type].correct += 1;
          perAttempt[type].correct += 1;
          correct += 1;
        } else {
          record.count += 1;
        }
      });

      Object.entries(perAttempt).forEach(([type, score]) => {
        types[type].history.push(Math.round(score.correct / score.total * 100));
      });
    });

    const weakest = Object.entries(types)
      .filter(([, score]) => score.total > 0)
      .sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total))[0];

    return {
      correct,
      total,
      types,
      weakestType: weakest ? weakest[0] : null,
      mistakes: Array.from(mistakes.values())
        .filter((record) => record.count > 0)
        .sort((a, b) => b.count - a.count)
    };
  }

  function renderMiniTrend(values) {
    if (!values.length) return '<span class="trend-empty">No attempts yet</span>';
    const width = 130;
    const height = 38;
    const points = values.slice(-8).map((value, index, data) => {
      const x = data.length === 1 ? width / 2 : index * width / (data.length - 1);
      const y = height - (Math.max(0, Math.min(100, value)) / 100 * (height - 6)) - 3;
      return `${x},${y}`;
    }).join(" ");
    const latest = values.at(-1);
    const previous = values.length > 1 ? values.at(-2) : latest;
    const change = latest - previous;

    return `
      <svg class="listening-sparkline" viewBox="0 0 ${width} ${height}" role="img" aria-label="Recent scores: ${values.slice(-8).join(", ")} percent">
        ${values.length > 1 ? `<polyline points="${points}"></polyline>` : ""}
        <circle cx="${values.length === 1 ? width / 2 : width}" cy="${height - (latest / 100 * (height - 6)) - 3}" r="3"></circle>
      </svg>
      <span class="trend-change ${change > 0 ? "positive" : change < 0 ? "negative" : "neutral"}">${change > 0 ? "+" : ""}${change}% latest</span>
    `;
  }

  function renderListeningInsights(analytics) {
    if (!analytics.total) {
      return `
        <section class="dashboard-section" aria-labelledby="listening-insights-title">
          <div class="section-heading row-heading">
            <div><span class="eyebrow">Listening intelligence</span><h2 id="listening-insights-title">Listening weak points</h2></div>
          </div>
          <div class="listening-insights-empty">
            <span aria-hidden="true">聴</span>
            <div><h3>Complete a listening test to unlock insights</h3><p>Accuracy by question type, trends, and a personalized retry queue will appear here.</p></div>
          </div>
        </section>
      `;
    }

    const overall = Math.round(analytics.correct / analytics.total * 100);
    const weakestLabel = analytics.weakestType
      ? LISTENING_TYPE_LABELS[analytics.weakestType] || analytics.weakestType
      : "Not enough data";

    return `
      <section class="dashboard-section" aria-labelledby="listening-insights-title">
        <div class="section-heading row-heading">
          <div><span class="eyebrow">Listening intelligence</span><h2 id="listening-insights-title">Listening weak points</h2></div>
          <a class="button button-primary" href="#/listening-review">Retry missed questions <span aria-hidden="true">→</span></a>
        </div>

        <div class="listening-overview-card">
          <div class="listening-overall-score"><strong>${overall}%</strong><span>Overall listening accuracy</span></div>
          <div><span class="eyebrow">Focus next</span><h3>${escapeHTML(weakestLabel)}</h3><p>Based on ${analytics.total} saved listening answers.</p></div>
          <div class="recurring-mistakes">
            <span class="eyebrow">Most missed</span>
            ${analytics.mistakes.length ? analytics.mistakes.slice(0, 3).map((record) => `
              <div><span lang="ja">${escapeHTML(record.question.question)}</span><b>${record.count}×</b></div>
            `).join("") : "<p>No recurring mistakes yet.</p>"}
          </div>
        </div>

        <div class="listening-type-grid">
          ${Object.entries(LISTENING_TYPE_LABELS).map(([type, label]) => {
            const score = analytics.types[type];
            const accuracy = score.total ? Math.round(score.correct / score.total * 100) : 0;
            return `
              <article class="listening-type-card">
                <div><span>${escapeHTML(label)}</span><strong>${score.total ? `${accuracy}%` : "—"}</strong></div>
                <progress value="${score.correct}" max="${score.total || 1}" aria-label="${escapeHTML(label)}: ${score.correct} of ${score.total} correct">${score.correct}/${score.total}</progress>
                <small>${score.correct} of ${score.total} correct</small>
                <div class="listening-trend">${renderMiniTrend(score.history)}</div>
              </article>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  function renderScoreChart(attempts) {
    if (!attempts.length) {
      return `
        <div class="chart-empty">
          <span aria-hidden="true">伸</span>
          <p>Your score chart will appear after your first test.</p>
        </div>
      `;
    }

    const data = attempts.slice(0, 8).reverse();
    const width = 640;
    const height = 230;
    const left = 48;
    const right = 616;
    const top = 18;
    const bottom = 184;
    const plotHeight = bottom - top;
    const xFor = (index) => data.length === 1
      ? (left + right) / 2
      : left + (index * (right - left) / (data.length - 1));
    const yFor = (score) => bottom - (Math.max(0, Math.min(180, score)) / 180 * plotHeight);
    const points = data.map((attempt, index) => `${xFor(index)},${yFor(attempt.score)}`).join(" ");
    const summary = data.map((attempt, index) => `Attempt ${index + 1}: ${attempt.score} out of 180`).join("; ");

    const grid = [0, 90, 180].map((score) => {
      const y = yFor(score);
      return `
        <line class="chart-grid-line" x1="${left}" y1="${y}" x2="${right}" y2="${y}"></line>
        <text class="chart-axis-label" x="${left - 10}" y="${y + 4}" text-anchor="end">${score}</text>
      `;
    }).join("");

    const dots = data.map((attempt, index) => {
      const x = xFor(index);
      const y = yFor(attempt.score);
      return `
        <g class="chart-point">
          <circle cx="${x}" cy="${y}" r="5"><title>Attempt ${index + 1}: ${attempt.score}/180 on ${escapeHTML(formatDate(attempt.submittedAt))}</title></circle>
          <text class="chart-score-label" x="${x}" y="${y - 12}" text-anchor="middle">${attempt.score}</text>
          <text class="chart-x-label" x="${x}" y="${bottom + 28}" text-anchor="middle">${index + 1}</text>
        </g>
      `;
    }).join("");

    const passY = yFor(80);
    return `
      <svg class="score-chart" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="score-chart-title score-chart-desc">
        <title id="score-chart-title">Score progress chart</title>
        <desc id="score-chart-desc">${escapeHTML(summary)}</desc>
        ${grid}
        <line class="chart-pass-line" x1="${left}" y1="${passY}" x2="${right}" y2="${passY}"></line>
        <text class="chart-pass-label" x="${right}" y="${passY - 7}" text-anchor="end">Pass 80</text>
        ${data.length > 1 ? `<polyline class="chart-line" points="${points}"></polyline>` : ""}
        ${dots}
        <text class="chart-axis-title" x="${(left + right) / 2}" y="${height - 2}" text-anchor="middle">Attempts (oldest to newest)</text>
      </svg>
    `;
  }

  function testCard(test, user) {
    const progress = window.JLPTStorage.getProgress(user.id, test.id);
    const hasProgress = Boolean(progress && Array.isArray(progress.answers));
    const answered = hasProgress ? progress.answers.filter((answer) => answer !== null).length : 0;
    const sectionCounts = test.questions.reduce((counts, question) => {
      counts[question.section] = (counts[question.section] || 0) + 1;
      return counts;
    }, {});

    return `
      <article class="test-card">
        <div class="test-card-top">
          <span class="test-number" aria-hidden="true">${escapeHTML(test.id.split("-").at(-1))}</span>
          ${hasProgress ? `<span class="status-badge status-progress">${answered}/${test.questions.length} answered</span>` : '<span class="status-badge status-ready">Ready</span>'}
        </div>
        <h3>${escapeHTML(test.title)}</h3>
        <p>${escapeHTML(test.description || "A balanced JLPT N5 practice test.")}</p>
        <div class="test-meta">
          <span><b>${test.questions.length}</b> questions</span>
          <span><b>${test.duration}</b> minutes</span>
        </div>
        <div class="section-chips" aria-label="Question sections">
          ${Object.entries(sectionCounts).map(([section, count]) => `<span>${escapeHTML(SECTION_LABELS[section] || section)} ${count}</span>`).join("")}
        </div>
        <a class="button ${hasProgress ? "button-primary" : "button-secondary"} button-block" href="#/quiz/${encodeURIComponent(test.id)}">
          ${hasProgress ? "Resume test" : "Start test"} <span aria-hidden="true">→</span>
        </a>
      </article>
    `;
  }

  function studyStreak(attempts) {
    const days = new Set(attempts.map((attempt) => {
      const date = new Date(attempt.submittedAt);
      return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
    }).filter(Boolean));
    if (!days.size) return 0;

    let cursor = new Date();
    const today = cursor.toISOString().slice(0, 10);
    if (!days.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1);
    let streak = 0;
    while (days.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    return streak;
  }

  function renderAchievements(attempts, bestScore) {
    const passed = attempts.some((attempt) => attempt.passed);
    const perfectSection = attempts.some((attempt) => Object.values(attempt.sectionScores || {}).some((section) => (
      section.total > 0 && section.correct === section.total
    )));
    const listeningCompleted = attempts.some((attempt) => attempt.listeningTypeScores && Object.keys(attempt.listeningTypeScores).length);
    const streak = studyStreak(attempts);
    const achievements = [
      { icon: "始", title: "First step", detail: "Complete your first mock test", unlocked: attempts.length >= 1 },
      { icon: "続", title: "Consistent learner", detail: "Complete three mock tests", unlocked: attempts.length >= 3 },
      { icon: "合", title: "First pass", detail: "Reach the 80-point pass mark", unlocked: passed },
      { icon: "百", title: "Century score", detail: "Score at least 100 points", unlocked: bestScore >= 100 },
      { icon: "聴", title: "Active listener", detail: "Complete a listening section", unlocked: listeningCompleted },
      { icon: "満", title: "Section master", detail: "Perfect one complete section", unlocked: perfectSection },
      { icon: "火", title: "Study streak", detail: `Reach a 3-day streak · Current ${streak}`, unlocked: streak >= 3 },
      { icon: "雲", title: "Cloud ready", detail: "Connect secure backend sync", unlocked: window.JLPTApi.hasSession() }
    ];
    const unlockedCount = achievements.filter((achievement) => achievement.unlocked).length;

    return `
      <section class="dashboard-section achievements-section" aria-labelledby="achievements-title">
        <div class="section-heading row-heading">
          <div><span class="eyebrow">Milestones</span><h2 id="achievements-title">Achievements</h2></div>
          <p>${unlockedCount} of ${achievements.length} unlocked</p>
        </div>
        <div class="achievement-progress" aria-label="${unlockedCount} of ${achievements.length} achievements unlocked">
          <progress value="${unlockedCount}" max="${achievements.length}">${unlockedCount}/${achievements.length}</progress>
          <span>${Math.round(unlockedCount / achievements.length * 100)}%</span>
        </div>
        <div class="achievement-grid">
          ${achievements.map((achievement) => `
            <article class="achievement-card${achievement.unlocked ? " unlocked" : " locked"}">
              <span class="achievement-icon" aria-hidden="true">${achievement.icon}</span>
              <div><h3>${achievement.title}</h3><p>${achievement.detail}</p></div>
              <span class="achievement-state">${achievement.unlocked ? "Unlocked" : "Locked"}</span>
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderDashboard() {
    const user = window.JLPTAuth.currentUser();
    const attempts = window.JLPTStorage.getAttempts(user.id);
    const bestScore = attempts.length ? Math.max(...attempts.map((attempt) => attempt.score)) : 0;
    const passedCount = attempts.filter((attempt) => attempt.passed).length;
    const listeningAnalytics = buildListeningAnalytics(user.id);

    appElement.innerHTML = `
      <section class="dashboard-page page-section">
        <div class="container">
          <div class="dashboard-welcome">
            <div>
              <span class="eyebrow eyebrow-accent">Your practice space</span>
              <h1>こんにちは、${escapeHTML(user.name)}さん。</h1>
              <p>Choose a mock test or review how far you have come.</p>
            </div>
            <div class="welcome-mark" aria-hidden="true">進</div>
          </div>

          <div class="stats-grid" aria-label="Practice statistics">
            <article class="stat-card">
              <span>Attempts</span>
              <strong>${attempts.length}</strong>
              <small>Tests completed</small>
            </article>
            <article class="stat-card">
              <span>Best score</span>
              <strong>${bestScore}<em>/180</em></strong>
              <small>Your personal best</small>
            </article>
            <article class="stat-card">
              <span>Passes</span>
              <strong>${passedCount}</strong>
              <small>At or above 80 points</small>
            </article>
          </div>

          <section class="dashboard-section" aria-labelledby="tests-title">
            <div class="section-heading row-heading">
              <div>
                <span class="eyebrow">Practice tests</span>
                <h2 id="tests-title">Available mock tests</h2>
              </div>
              <p>${getTests().length} tests · ${getTests().reduce((total, test) => total + test.questions.length, 0)} questions</p>
            </div>
            <div class="test-grid">
              ${getTests().map((test) => testCard(test, user)).join("")}
            </div>
          </section>

          <section class="dashboard-section progress-section" aria-labelledby="progress-title">
            <div class="section-heading row-heading">
              <div>
                <span class="eyebrow">Growth over time</span>
                <h2 id="progress-title">Score progress</h2>
              </div>
              <p>Most recent 8 attempts</p>
            </div>
            <div class="chart-card">
              ${renderScoreChart(attempts)}
            </div>
          </section>

          ${renderListeningInsights(listeningAnalytics)}

          ${renderAchievements(attempts, bestScore)}

          <section class="dashboard-section" aria-labelledby="history-title">
            <div class="section-heading row-heading">
              <div>
                <span class="eyebrow">Past work</span>
                <h2 id="history-title">Attempt history</h2>
              </div>
              <p>${attempts.length ? `${attempts.length} saved result${attempts.length === 1 ? "" : "s"}` : "No attempts yet"}</p>
            </div>

            <div class="history-card">
              ${attempts.length ? `
                <div class="table-scroll">
                  <table class="history-table">
                    <thead>
                      <tr><th scope="col">Test</th><th scope="col">Date</th><th scope="col">Score</th><th scope="col">Result</th><th scope="col"><span class="visually-hidden">View</span></th></tr>
                    </thead>
                    <tbody>
                      ${attempts.map((attempt) => `
                        <tr>
                          <td data-label="Test"><strong>${escapeHTML(attempt.testTitle)}</strong></td>
                          <td data-label="Date">${escapeHTML(formatDate(attempt.submittedAt, true))}</td>
                          <td data-label="Score"><b>${attempt.score}</b> / ${attempt.maxScore || 180}</td>
                          <td data-label="Result"><span class="status-badge ${attempt.passed ? "status-pass" : "status-fail"}">${attempt.passed ? "Passed" : "Keep going"}</span></td>
                          <td data-label="Review"><a class="table-link" href="#/result/${encodeURIComponent(attempt.id)}">View result <span aria-hidden="true">→</span></a></td>
                        </tr>
                      `).join("")}
                    </tbody>
                  </table>
                </div>
              ` : `
                <div class="empty-state">
                  <span class="empty-mark" aria-hidden="true">始</span>
                  <h3>Your history starts here</h3>
                  <p>Complete a mock test and your detailed result will be saved here.</p>
                </div>
              `}
            </div>
          </section>
        </div>
      </section>
    `;
  }

  function fallbackSectionScores(test, attempt) {
    const pointsPerQuestion = 180 / test.questions.length;
    const scores = {};

    test.questions.forEach((question, index) => {
      if (index >= attempt.answers.length) return;
      if (!scores[question.section]) scores[question.section] = { score: 0, max: 0, correct: 0, total: 0 };
      const section = scores[question.section];
      section.max += pointsPerQuestion;
      section.total += 1;
      if (attempt.answers[index] === question.answer) {
        section.score += pointsPerQuestion;
        section.correct += 1;
      }
    });

    Object.values(scores).forEach((section) => {
      section.score = Math.round(section.score);
      section.max = Math.round(section.max);
    });
    return scores;
  }

  function fallbackListeningTypeScores(test, attempt) {
    const scores = {};
    test.questions.forEach((question, index) => {
      if (question.section !== "listening") return;
      if (index >= attempt.answers.length) return;
      const type = question.type || "utterance";
      if (!scores[type]) scores[type] = { correct: 0, total: 0 };
      scores[type].total += 1;
      if (attempt.answers[index] === question.answer) scores[type].correct += 1;
    });
    return scores;
  }

  function renderResult(attemptId) {
    const user = window.JLPTAuth.currentUser();
    const attempt = window.JLPTStorage.getAttempt(attemptId, user.id);

    if (!attempt) {
      renderNotFound("Result not found", "This result does not exist or belongs to another account.");
      return;
    }

    const test = findTest(attempt.testId);
    if (!test) {
      renderNotFound("Test data unavailable", "The questions for this saved result could not be found.");
      return;
    }

    const sectionScores = attempt.sectionScores || fallbackSectionScores(test, attempt);
    const listeningTypeScores = attempt.listeningTypeScores || fallbackListeningTypeScores(test, attempt);
    const wrongAnswers = test.questions
      .map((question, index) => ({ question, index, selected: attempt.answers[index] }))
      .filter((item) => item.index < attempt.answers.length)
      .filter((item) => item.selected !== item.question.answer);
    const percentage = Math.round(attempt.score / (attempt.maxScore || 180) * 100);
    const wrongListeningCount = wrongAnswers.filter((item) => item.question.section === "listening").length;

    appElement.innerHTML = `
      <section class="result-page page-section">
        <div class="container result-container">
          ${attempt.autoSubmitted ? '<div class="result-notice"><span aria-hidden="true">⏱</span> Time expired, so this attempt was submitted automatically.</div>' : ""}

          <div class="result-hero">
            <div class="result-score-block">
              <span class="eyebrow">Final score</span>
              <div class="result-score"><strong>${attempt.score}</strong><span>/ ${attempt.maxScore || 180}</span></div>
              <span class="result-percentage">${percentage}%</span>
            </div>
            <div class="result-summary">
              <span class="result-badge ${attempt.passed ? "passed" : "failed"}">${attempt.passed ? "合格 · Pass" : "もう一度 · Keep going"}</span>
              <h1>${attempt.passed ? "Well done — you passed!" : "A good step forward."}</h1>
              <p>${attempt.passed ? "Your fundamentals are taking shape. Review any missed answers and keep building consistency." : "Review the explanations below, then retake the test when you feel ready."}</p>
              <div class="result-meta">
                <span><b>${attempt.correctCount}/${attempt.totalQuestions}</b> correct</span>
                <span><b>${formatDuration(attempt.durationUsed)}</b> used</span>
                <span><b>${escapeHTML(formatDate(attempt.submittedAt))}</b> completed</span>
              </div>
            </div>
          </div>

          <section class="result-section" aria-labelledby="breakdown-title">
            <div class="section-heading row-heading">
              <div>
                <span class="eyebrow">Performance</span>
                <h2 id="breakdown-title">Score by section</h2>
              </div>
              <p>Practice pass mark: 80 / 180</p>
            </div>

            <div class="section-score-grid">
              ${["vocabulary", "grammar", "reading", "listening"].filter((section) => sectionScores[section]).map((section) => {
                const item = sectionScores[section];
                return `
                  <article class="section-score-card">
                    <div class="section-score-heading">
                      <div><span class="section-symbol" aria-hidden="true">${sectionSymbol(section)}</span><strong>${SECTION_LABELS[section]}</strong></div>
                      <b>${item.score}<span>/${item.max}</span></b>
                    </div>
                    <progress class="score-progress progress-${section}" value="${item.score}" max="${item.max}" aria-label="${SECTION_LABELS[section]} score: ${item.score} out of ${item.max}">${item.score} / ${item.max}</progress>
                    <small>${item.correct} of ${item.total} questions correct</small>
                  </article>
                `;
              }).join("")}
            </div>
          </section>

          ${Object.keys(listeningTypeScores).length ? `
            <section class="result-section" aria-labelledby="listening-types-title">
              <div class="section-heading row-heading">
                <div>
                  <span class="eyebrow">Listening detail</span>
                  <h2 id="listening-types-title">Accuracy by question type</h2>
                </div>
                ${wrongListeningCount ? '<a class="button button-primary" href="#/listening-review">Practice weak points</a>' : ""}
              </div>
              <div class="listening-type-grid result-listening-types">
                ${Object.entries(LISTENING_TYPE_LABELS).filter(([type]) => listeningTypeScores[type]).map(([type, label]) => {
                  const item = listeningTypeScores[type];
                  const accuracy = item.total ? Math.round(item.correct / item.total * 100) : 0;
                  return `
                    <article class="listening-type-card">
                      <div><span>${escapeHTML(label)}</span><strong>${accuracy}%</strong></div>
                      <progress value="${item.correct}" max="${item.total}" aria-label="${escapeHTML(label)}: ${item.correct} of ${item.total} correct">${item.correct}/${item.total}</progress>
                      <small>${item.correct} of ${item.total} correct</small>
                    </article>
                  `;
                }).join("")}
              </div>
            </section>
          ` : ""}

          <section class="result-section" aria-labelledby="review-title">
            <div class="section-heading row-heading">
              <div>
                <span class="eyebrow">Learn from mistakes</span>
                <h2 id="review-title">Answer review</h2>
              </div>
              <p>${wrongAnswers.length} question${wrongAnswers.length === 1 ? "" : "s"} to review</p>
            </div>

            ${wrongAnswers.length ? `
              <div class="answer-review-list">
                ${wrongAnswers.map(({ question, index, selected }) => `
                  <article class="answer-review-card">
                    <div class="review-question-heading">
                      <span>Question ${index + 1}</span>
                      <span class="section-badge section-${question.section}">${escapeHTML(SECTION_LABELS[question.section] || question.section)}</span>
                    </div>
                    <h3 lang="ja">${escapeHTML(question.question)}</h3>
                    ${question.section === "listening" ? `
                      <div class="listening-review-tools">
                        <button class="button button-secondary listening-replay-button" type="button" aria-pressed="false" data-listening-replay="${question.id}" data-test-id="${escapeHTML(test.id)}">
                          <span aria-hidden="true">▶</span> Replay audio
                        </button>
                        <button class="button button-link transcript-toggle" type="button" aria-expanded="false" aria-controls="transcript-${escapeHTML(attempt.id)}-${question.id}" data-transcript-toggle="transcript-${escapeHTML(attempt.id)}-${question.id}">
                          Show transcript
                        </button>
                        <span class="review-audio-notice" role="status"></span>
                      </div>
                      <div class="result-transcript" id="transcript-${escapeHTML(attempt.id)}-${question.id}" hidden>
                        <strong>Japanese transcript</strong>
                        ${dialogueTranscript(question)}
                        <strong>English translation</strong>
                        <p>${escapeHTML(question.scriptTranslation)}</p>
                      </div>
                    ` : ""}
                    <div class="review-answer wrong-answer">
                      <span>Your answer</span>
                      <strong lang="ja">${selected === null || selected === undefined ? "Unanswered" : escapeHTML(optionText(question.options[selected]))}</strong>
                    </div>
                    <div class="review-answer correct-answer">
                      <span>Correct answer</span>
                      <strong lang="ja">${escapeHTML(optionText(question.options[question.answer]))}</strong>
                    </div>
                    <div class="explanation">
                      <span aria-hidden="true">解</span>
                      <p>${escapeHTML(question.explanation)}</p>
                    </div>
                  </article>
                `).join("")}
              </div>
            ` : `
              <div class="perfect-state">
                <span aria-hidden="true">満点</span>
                <div><h3>Perfect — no answers to review.</h3><p>You answered every question correctly.</p></div>
              </div>
            `}
          </section>

          <div class="result-actions">
            <button class="button button-accent button-large" type="button" data-retake="${escapeHTML(test.id)}">Retake test</button>
            <a class="button button-secondary button-large" href="#/dashboard">Back to dashboard</a>
          </div>
        </div>
      </section>
    `;
  }

  function renderNotFound(title = "Page not found", message = "The page you requested does not exist.") {
    appElement.innerHTML = `
      <section class="not-found page-section">
        <div class="container not-found-card">
          <span aria-hidden="true">四〇四</span>
          <h1>${escapeHTML(title)}</h1>
          <p>${escapeHTML(message)}</p>
          <a class="button button-primary" href="#/">Return home</a>
        </div>
      </section>
    `;
  }

  function showFormErrors(form, result) {
    form.querySelectorAll(".field-error").forEach((element) => {
      element.textContent = "";
    });
    form.querySelectorAll("input").forEach((input) => input.removeAttribute("aria-invalid"));

    const formMessage = form.querySelector("#form-message");
    formMessage.hidden = true;
    formMessage.textContent = "";

    if (result.message) {
      formMessage.textContent = result.message;
      formMessage.hidden = false;
    }

    const errors = result.errors || {};
    Object.entries(errors).forEach(([field, message]) => {
      const input = form.elements[field];
      const error = form.querySelector(`#${field}-error`);
      if (input) input.setAttribute("aria-invalid", "true");
      if (error) error.textContent = message;
    });

    const firstInvalid = form.querySelector('[aria-invalid="true"]');
    if (firstInvalid) firstInvalid.focus();
  }

  async function handleAuthSubmit(event) {
    const form = event.target.closest("[data-auth-form]");
    if (!form) return;
    event.preventDefault();

    const values = Object.fromEntries(new FormData(form).entries());
    const mode = form.dataset.authForm;
    const submitButton = form.querySelector('[type="submit"]');
    const originalLabel = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = mode === "register" ? "Creating account…" : "Logging in…";
    const result = mode === "register"
      ? await window.JLPTAuth.register(values)
      : await window.JLPTAuth.login(values);
    submitButton.disabled = false;
    submitButton.textContent = originalLabel;

    if (!result.ok) {
      showFormErrors(form, result);
      return;
    }

    if (result.source === "cloud") await window.JLPTApi.syncUserData(result.user);
    toast(
      result.source === "cloud"
        ? (mode === "register" ? "Cloud account created. Welcome!" : "Welcome back — progress synced!")
        : "Backend unavailable. Continuing safely in local mode.",
      result.source === "cloud" ? "success" : "warning"
    );
    navigate("/dashboard");
  }

  function requireUser() {
    if (window.JLPTAuth.currentUser()) return true;
    toast("Log in to continue with your practice.", "warning");
    navigate("/login");
    return false;
  }

  function setPage(page, title) {
    document.body.dataset.page = page;
    document.title = `${title} | Nihongo N5`;
  }

  function renderRoute() {
    closeModal(false);
    window.JLPTQuiz.destroy();
    window.JLPTListeningReview.destroy();
    updateHeader();

    const segments = parseRoute();
    const route = segments[0] || "home";

    if (route === "home") {
      setPage("landing", "JLPT Mock Tests");
      renderLanding();
    } else if (route === "login" || route === "register") {
      if (window.JLPTAuth.currentUser()) {
        navigate("/dashboard");
        return;
      }
      setPage("auth", route === "login" ? "Log in" : "Register");
      renderAuth(route);
    } else if (route === "dashboard") {
      if (!requireUser()) return;
      setPage("dashboard", "Dashboard");
      renderDashboard();
      syncDashboardData(window.JLPTAuth.currentUser());
    } else if (route === "quiz" && segments[1]) {
      if (!requireUser()) return;
      const test = findTest(segments[1]);
      if (!test) {
        setPage("not-found", "Test not found");
        renderNotFound("Test not found", "That mock test could not be found.");
      } else {
        setPage("quiz", test.title);
        window.JLPTQuiz.init(test.id, appElement);
      }
    } else if (route === "listening-review") {
      if (!requireUser()) return;
      setPage("listening-review", "Listening retry");
      window.JLPTListeningReview.init(appElement);
    } else if (route === "result" && segments[1]) {
      if (!requireUser()) return;
      setPage("result", "Test result");
      renderResult(segments[1]);
    } else {
      setPage("not-found", "Page not found");
      renderNotFound();
    }

    updateHeader();
    window.scrollTo({ top: 0, behavior: "auto" });
    setupRevealAnimations();
    window.requestAnimationFrame(() => appElement.focus({ preventScroll: true }));
  }

  async function handleAppClick(event) {
    const scrollLink = event.target.closest("[data-scroll-to]");
    if (scrollLink) {
      event.preventDefault();
      document.getElementById(scrollLink.dataset.scrollTo)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const transcriptButton = event.target.closest("[data-transcript-toggle]");
    if (transcriptButton) {
      const transcript = document.getElementById(transcriptButton.dataset.transcriptToggle);
      if (!transcript) return;
      const willShow = transcript.hidden;
      transcript.hidden = !willShow;
      transcriptButton.setAttribute("aria-expanded", String(willShow));
      transcriptButton.textContent = willShow ? "Hide transcript" : "Show transcript";
      return;
    }

    const replayButton = event.target.closest("[data-listening-replay]");
    if (replayButton) {
      const test = findTest(replayButton.dataset.testId);
      const question = test && test.questions.find((item) => String(item.id) === replayButton.dataset.listeningReplay);
      const notice = replayButton.closest(".listening-review-tools")?.querySelector(".review-audio-notice");
      if (question) window.JLPTAudio.playReview(question, replayButton, notice);
      return;
    }

    const retakeButton = event.target.closest("[data-retake]");
    if (!retakeButton) return;

    const test = findTest(retakeButton.dataset.retake);
    const user = window.JLPTAuth.currentUser();
    if (!test || !user) return;

    const confirmed = await confirm({
      title: "Retake this test?",
      message: "A fresh timer and a blank set of answers will be started. Your saved result will remain in history.",
      confirmLabel: "Start retake",
      tone: "accent"
    });

    if (!confirmed) return;
    window.JLPTStorage.clearProgress(user.id, test.id);
    window.JLPTApi.clearProgress(test.id);
    navigate(`/quiz/${test.id}`);
  }

  function handleNavClick(event) {
    const logoutButton = event.target.closest("[data-logout]");
    if (!logoutButton) return;

    window.JLPTQuiz.destroy();
    window.JLPTAuth.logout();
    toast("You have been logged out.", "success");
    navigate("/");
  }

  function initialize() {
    appElement = document.getElementById("app");
    navElement = document.getElementById("primary-nav");
    themeButton = document.getElementById("theme-toggle");
    toastElement = document.getElementById("toast");
    modalRoot = document.getElementById("modal-root");

    document.getElementById("current-year").textContent = String(new Date().getFullYear());
    themeButton.addEventListener("click", toggleTheme);
    navElement.addEventListener("click", handleNavClick);
    appElement.addEventListener("submit", handleAuthSubmit);
    appElement.addEventListener("click", handleAppClick);
    appElement.addEventListener("input", (event) => {
      if (!event.target.matches("input")) return;
      event.target.removeAttribute("aria-invalid");
      const error = document.getElementById(`${event.target.name}-error`);
      if (error) error.textContent = "";
    });
    window.addEventListener("hashchange", renderRoute);
    window.addEventListener("jlpt:sync-status", (event) => updateSyncStatus(event.detail));

    updateThemeButton();
    window.JLPTApi.health();
    if (!window.location.hash) {
      window.location.hash = "#/";
    } else {
      renderRoute();
    }
  }

  window.JLPTApp = {
    navigate,
    toast,
    confirm,
    closeModal,
    escapeHTML
  };

  window.addEventListener("DOMContentLoaded", initialize);
}());
