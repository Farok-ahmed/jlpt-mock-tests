(function () {
  "use strict";

  const TOKEN_KEY = "nihongoN5.apiToken.v1";
  const FILE_API = "http://127.0.0.1:8000/api";
  const API_BASE = window.location.protocol === "file:" ? FILE_API : "/api";
  const progressTimers = new Map();
  let currentStatus = "local";
  let healthChecked = false;

  class ApiError extends Error {
    constructor(message, status = 0, network = false) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.network = network;
    }
  }

  function token() {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch (error) {
      return "";
    }
  }

  function setToken(value) {
    try {
      if (value) localStorage.setItem(TOKEN_KEY, value);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (error) {
      console.warn("Could not save the cloud session.", error);
    }
  }

  function setStatus(state, message) {
    currentStatus = state;
    window.dispatchEvent(new CustomEvent("jlpt:sync-status", {
      detail: { state, message }
    }));
  }

  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), options.timeout || 6000);
    const headers = { Accept: "application/json", ...(options.headers || {}) };
    const accessToken = token();
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    if (options.body !== undefined) headers["Content-Type"] = "application/json";

    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method: options.method || "GET",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal
      });
      const data = response.status === 204 ? {} : await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401 && !path.startsWith("/auth/")) setToken("");
        throw new ApiError(data.detail || "The server could not complete this request.", response.status);
      }
      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("The cloud service is unavailable. Using local mode.", 0, true);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function register(values) {
    if (healthChecked && currentStatus === "local") {
      throw new ApiError("The cloud service is unavailable. Using local mode.", 0, true);
    }
    setStatus("syncing", "Creating cloud account…");
    try {
      const result = await request("/auth/register", { method: "POST", body: values });
      setToken(result.token);
      setStatus("online", "Cloud sync active");
      return result.user;
    } catch (error) {
      setStatus("local", error.network ? "Backend offline · local mode" : "Cloud account error");
      throw error;
    }
  }

  async function login(values) {
    if (healthChecked && currentStatus === "local") {
      throw new ApiError("The cloud service is unavailable. Using local mode.", 0, true);
    }
    setStatus("syncing", "Signing in…");
    try {
      const result = await request("/auth/login", { method: "POST", body: values });
      setToken(result.token);
      setStatus("online", "Cloud sync active");
      return result.user;
    } catch (error) {
      setStatus("local", error.network ? "Backend offline · local mode" : "Cloud login error");
      throw error;
    }
  }

  function logout() {
    setToken("");
    progressTimers.forEach((timer) => window.clearTimeout(timer));
    progressTimers.clear();
    setStatus("local", "Local mode");
  }

  function mergeAttempt(attempt) {
    if (!attempt || !attempt.id) return;
    window.JLPTStorage.saveAttempt(attempt);
  }

  async function syncUserData(user) {
    if (!user || !token()) {
      setStatus("local", "Local mode");
      return false;
    }

    setStatus("syncing", "Syncing progress…");
    try {
      const cloud = await request("/attempts");
      const localAttempts = window.JLPTStorage.getAttempts(user.id);
      const cloudIds = new Set(cloud.attempts.map((attempt) => attempt.id));
      cloud.attempts.forEach(mergeAttempt);

      await Promise.all(localAttempts
        .filter((attempt) => !cloudIds.has(attempt.id))
        .map((attempt) => request("/attempts", { method: "POST", body: attempt })));

      const tests = window.JLPT_DATA?.tests || [];
      await Promise.all(tests.map(async (test) => {
        const response = await request(`/progress/${encodeURIComponent(test.id)}`);
        const cloudState = response.state;
        const localState = window.JLPTStorage.getProgress(user.id, test.id);

        if (cloudState && (!localState || Number(cloudState.updatedAt) > Number(localState.updatedAt))) {
          window.JLPTStorage.saveProgress(user.id, test.id, cloudState);
        } else if (localState && (!cloudState || Number(localState.updatedAt) >= Number(cloudState.updatedAt))) {
          await request(`/progress/${encodeURIComponent(test.id)}`, {
            method: "PUT",
            body: localState
          });
        }
      }));

      setStatus("online", "Synced");
      return true;
    } catch (error) {
      setStatus("local", error.network ? "Backend offline · saved locally" : "Sync paused · saved locally");
      return false;
    }
  }

  async function saveAttempt(attempt) {
    if (!token()) return false;
    try {
      await request("/attempts", { method: "POST", body: attempt });
      setStatus("online", "Result synced");
      return true;
    } catch (error) {
      setStatus("local", "Result saved locally · sync pending");
      return false;
    }
  }

  function queueProgress(testId, state) {
    if (!token()) return;
    const existing = progressTimers.get(testId);
    if (existing) window.clearTimeout(existing);
    progressTimers.set(testId, window.setTimeout(async () => {
      progressTimers.delete(testId);
      try {
        await request(`/progress/${encodeURIComponent(testId)}`, {
          method: "PUT",
          body: state,
          timeout: 4000
        });
        setStatus("online", "Progress synced");
      } catch (error) {
        setStatus("local", "Progress saved locally · sync pending");
      }
    }, 650));
  }

  async function clearProgress(testId) {
    const pending = progressTimers.get(testId);
    if (pending) window.clearTimeout(pending);
    progressTimers.delete(testId);
    if (!token()) return false;
    try {
      await request(`/progress/${encodeURIComponent(testId)}`, { method: "DELETE" });
      return true;
    } catch (error) {
      setStatus("local", "Progress cleared locally · cloud retry pending");
      return false;
    }
  }

  async function health() {
    try {
      await request("/health", { timeout: 2500 });
      healthChecked = true;
      setStatus(token() ? "online" : "available", token() ? "Cloud sync active" : "Backend available");
      return true;
    } catch (error) {
      healthChecked = true;
      setStatus("local", "Local mode");
      return false;
    }
  }

  window.JLPTApi = {
    ApiError,
    register,
    login,
    logout,
    syncUserData,
    saveAttempt,
    queueProgress,
    clearProgress,
    health,
    hasSession: () => Boolean(token()),
    status: () => currentStatus
  };
}());
