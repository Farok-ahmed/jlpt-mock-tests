(function () {
  "use strict";

  const KEYS = {
    users: "nihongoN5.users.v1",
    currentUser: "nihongoN5.currentUser.v1",
    attempts: "nihongoN5.attempts.v1",
    progress: "nihongoN5.progress.v1",
    theme: "nihongoN5.theme.v1"
  };

  function readJSON(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch (error) {
      console.warn(`Could not read ${key} from localStorage.`, error);
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Could not save ${key} to localStorage.`, error);
      return false;
    }
  }

  function remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Could not remove ${key} from localStorage.`, error);
      return false;
    }
  }

  function createId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `${prefix}-${window.crypto.randomUUID()}`;
    }

    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function getUsers() {
    const users = readJSON(KEYS.users, []);
    return Array.isArray(users) ? users : [];
  }

  function saveUsers(users) {
    return writeJSON(KEYS.users, users);
  }

  function findUserByEmail(email) {
    const normalizedEmail = String(email).trim().toLowerCase();
    return getUsers().find((user) => user.email.toLowerCase() === normalizedEmail) || null;
  }

  function getCurrentUser() {
    let userId = null;

    try {
      userId = localStorage.getItem(KEYS.currentUser);
    } catch (error) {
      console.warn("Could not read the current user.", error);
    }

    if (!userId) return null;

    const user = getUsers().find((item) => item.id === userId) || null;
    if (!user) remove(KEYS.currentUser);
    return user;
  }

  function setCurrentUser(userId) {
    if (!userId) return remove(KEYS.currentUser);

    try {
      localStorage.setItem(KEYS.currentUser, userId);
      return true;
    } catch (error) {
      console.error("Could not save the current user.", error);
      return false;
    }
  }

  function getAllAttempts() {
    const attempts = readJSON(KEYS.attempts, []);
    return Array.isArray(attempts) ? attempts : [];
  }

  function getAttempts(userId) {
    return getAllAttempts()
      .filter((attempt) => attempt.userId === userId)
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  }

  function getAttempt(attemptId, userId) {
    return getAllAttempts().find((attempt) => (
      attempt.id === attemptId && (!userId || attempt.userId === userId)
    )) || null;
  }

  function saveAttempt(attempt) {
    const attempts = getAllAttempts();
    const existingIndex = attempts.findIndex((item) => item.id === attempt.id);

    if (existingIndex >= 0) {
      attempts[existingIndex] = attempt;
    } else {
      attempts.push(attempt);
    }

    return writeJSON(KEYS.attempts, attempts);
  }

  function progressKey(userId, testId) {
    return `${userId}::${testId}`;
  }

  function getProgress(userId, testId) {
    const allProgress = readJSON(KEYS.progress, {});
    if (!allProgress || typeof allProgress !== "object" || Array.isArray(allProgress)) return null;
    return allProgress[progressKey(userId, testId)] || null;
  }

  function saveProgress(userId, testId, state) {
    const allProgress = readJSON(KEYS.progress, {});
    const safeProgress = allProgress && typeof allProgress === "object" && !Array.isArray(allProgress)
      ? allProgress
      : {};

    safeProgress[progressKey(userId, testId)] = state;
    return writeJSON(KEYS.progress, safeProgress);
  }

  function clearProgress(userId, testId) {
    const allProgress = readJSON(KEYS.progress, {});
    if (!allProgress || typeof allProgress !== "object" || Array.isArray(allProgress)) return true;

    delete allProgress[progressKey(userId, testId)];
    return writeJSON(KEYS.progress, allProgress);
  }

  function migrateUserData(oldUserId, newUserId) {
    if (!oldUserId || !newUserId || oldUserId === newUserId) return true;

    const attempts = getAllAttempts().map((attempt) => (
      attempt.userId === oldUserId ? { ...attempt, userId: newUserId } : attempt
    ));
    const allProgress = readJSON(KEYS.progress, {});
    if (allProgress && typeof allProgress === "object" && !Array.isArray(allProgress)) {
      Object.keys(allProgress).forEach((key) => {
        if (!key.startsWith(`${oldUserId}::`)) return;
        const testId = key.slice(`${oldUserId}::`.length);
        allProgress[progressKey(newUserId, testId)] = {
          ...allProgress[key],
          userId: newUserId
        };
        delete allProgress[key];
      });
    }

    return writeJSON(KEYS.attempts, attempts) && writeJSON(KEYS.progress, allProgress);
  }

  function getTheme() {
    try {
      const savedTheme = localStorage.getItem(KEYS.theme);
      if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
    } catch (error) {
      console.warn("Could not read the saved theme.", error);
    }

    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function setTheme(theme) {
    const safeTheme = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = safeTheme;

    try {
      localStorage.setItem(KEYS.theme, safeTheme);
      return true;
    } catch (error) {
      console.warn("Could not save the theme preference.", error);
      return false;
    }
  }

  document.documentElement.dataset.theme = getTheme();

  window.JLPTStorage = {
    createId,
    getUsers,
    saveUsers,
    findUserByEmail,
    getCurrentUser,
    setCurrentUser,
    getAttempts,
    getAttempt,
    saveAttempt,
    getProgress,
    saveProgress,
    clearProgress,
    migrateUserData,
    getTheme,
    setTheme
  };
}());
