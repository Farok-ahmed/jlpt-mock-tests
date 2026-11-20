(function () {
  "use strict";

  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validateEmail(email) {
    const value = String(email || "").trim().toLowerCase();
    if (!value) return "Email is required.";
    if (!EMAIL_PATTERN.test(value)) return "Enter a valid email address.";
    return "";
  }

  function validatePassword(password) {
    const value = String(password || "");
    if (!value) return "Password is required.";
    if (value.length < 6) return "Use at least 6 characters.";
    if (value.length > 128) return "Use no more than 128 characters.";
    return "";
  }

  function saveCloudUser(cloudUser) {
    const users = window.JLPTStorage.getUsers();
    const existingIndex = users.findIndex((user) => (
      user.id === cloudUser.id || user.email.toLowerCase() === cloudUser.email.toLowerCase()
    ));
    if (existingIndex >= 0 && users[existingIndex].id !== cloudUser.id) {
      window.JLPTStorage.migrateUserData(users[existingIndex].id, cloudUser.id);
    }
    const user = { ...cloudUser, cloud: true };
    if (existingIndex >= 0) users[existingIndex] = user;
    else users.push(user);
    window.JLPTStorage.saveUsers(users);
    window.JLPTStorage.setCurrentUser(user.id);
    return user;
  }

  async function register(values) {
    const name = String(values.name || "").trim();
    const email = String(values.email || "").trim().toLowerCase();
    const password = String(values.password || "");
    const errors = {};

    if (name.length < 2) errors.name = "Enter at least 2 characters.";
    if (name.length > 60) errors.name = "Use no more than 60 characters.";

    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    if (emailError) errors.email = emailError;
    if (passwordError) errors.password = passwordError;

    if (Object.keys(errors).length) return { ok: false, errors };

    try {
      const cloudUser = await window.JLPTApi.register({ name, email, password });
      return { ok: true, user: saveCloudUser(cloudUser), source: "cloud" };
    } catch (error) {
      if (!error.network) {
        const field = error.status === 409 || error.status === 422 ? "email" : null;
        return field
          ? { ok: false, errors: { [field]: error.message } }
          : { ok: false, message: error.message };
      }
    }

    if (window.JLPTStorage.findUserByEmail(email)) {
      return { ok: false, errors: { email: "An account with this email already exists." } };
    }

    /*
     * Demo only: passwords are stored as plain text in localStorage.
     * Real applications need a secure backend, password hashing, HTTPS,
     * server-side validation, and authenticated sessions.
     */
    const user = {
      id: window.JLPTStorage.createId("user"),
      name,
      email,
      password,
      createdAt: new Date().toISOString()
    };

    const users = window.JLPTStorage.getUsers();
    users.push(user);

    if (!window.JLPTStorage.saveUsers(users)) {
      return { ok: false, message: "Your account could not be saved. Check browser storage permissions." };
    }

    window.JLPTStorage.setCurrentUser(user.id);
    return { ok: true, user, source: "local" };
  }

  async function login(values) {
    const email = String(values.email || "").trim().toLowerCase();
    const password = String(values.password || "");
    const errors = {};

    const emailError = validateEmail(email);
    if (emailError) errors.email = emailError;
    if (!password) errors.password = "Password is required.";
    if (Object.keys(errors).length) return { ok: false, errors };

    try {
      const cloudUser = await window.JLPTApi.login({ email, password });
      return { ok: true, user: saveCloudUser(cloudUser), source: "cloud" };
    } catch (error) {
      if (!error.network && error.status !== 404) {
        const field = error.status === 401 ? "password" : "email";
        return { ok: false, errors: { [field]: error.message } };
      }
    }

    const user = window.JLPTStorage.findUserByEmail(email);
    if (!user) {
      return { ok: false, errors: { email: "No account was found for this email." } };
    }

    if (user.password !== password) {
      return { ok: false, errors: { password: "Incorrect password. Please try again." } };
    }

    if (!window.JLPTStorage.setCurrentUser(user.id)) {
      return { ok: false, message: "Login could not be saved. Check browser storage permissions." };
    }

    return { ok: true, user, source: "local" };
  }

  function logout() {
    window.JLPTApi.logout();
    window.JLPTStorage.setCurrentUser(null);
  }

  function currentUser() {
    return window.JLPTStorage.getCurrentUser();
  }

  window.JLPTAuth = {
    register,
    login,
    logout,
    currentUser
  };
}());
