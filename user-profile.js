(function () {
  const CURRENT_KEY = "messier-trainer-current-user-v1";
  const USERS_KEY = "messier-trainer-users-v1";

  function clean(value) {
    return String(value || "").trim().replace(/\s+/g, " ").slice(0, 30);
  }

  function users() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
    catch (error) { return []; }
  }

  function saveUser(name) {
    const list = users();
    const existing = list.find(item => item.toLowerCase() === name.toLowerCase());
    const finalName = existing || name;
    if (!existing) {
      list.push(finalName);
      localStorage.setItem(USERS_KEY, JSON.stringify(list));
    }
    localStorage.setItem(CURRENT_KEY, finalName);
    return finalName;
  }

  function ask(message) {
    let name = "";
    while (!name) {
      const value = window.prompt(message, "");
      if (value === null) return saveUser("Guest");
      name = clean(value);
    }
    return saveUser(name);
  }

  function getCurrent() {
    const saved = clean(localStorage.getItem(CURRENT_KEY));
    return saved ? saveUser(saved) : ask("Choose a username for your Messier training profile:");
  }

  function switchUser() {
    const name = ask("Enter a username. Use an existing name to return to that profile:");
    saveUser(name);
    location.reload();
  }

  function storageKey(baseKey, username) {
    const name = username || getCurrent();
    const key = `${baseKey}:user:${name.toLowerCase()}`;
    if (localStorage.getItem(key) === null && users().length === 1) {
      const legacy = localStorage.getItem(baseKey);
      if (legacy !== null) localStorage.setItem(key, legacy);
    }
    return key;
  }

  function mount(username) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `User: ${username} · Change`;
    button.title = "Change Messier Trainer user";
    button.style.cssText = "position:fixed;right:14px;bottom:14px;z-index:99999;background:#4b74ff;color:white;border:0;border-radius:20px;padding:9px 14px;font:700 13px Arial;cursor:pointer;box-shadow:0 5px 20px #0008";
    button.addEventListener("click", switchUser);
    document.body.appendChild(button);
  }

  window.MessierUser = { getCurrent, switchUser, storageKey, users, mount };
})();
