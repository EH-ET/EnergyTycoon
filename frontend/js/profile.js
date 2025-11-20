import { dom } from "./ui.js";
import { state } from "./state.js";
import { stopAutosaveTimer } from "./autosave.js";
import { updateRankFromServer } from "./rank.js";

const AUDIO_PREF_KEY = "audio_preferences";
const CLOSE_DELAY = 400;

function loadAudioPrefs() {
  try {
    const stored = localStorage.getItem(AUDIO_PREF_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        music: typeof parsed.music === "boolean" ? parsed.music : true,
        sfx: typeof parsed.sfx === "boolean" ? parsed.sfx : true,
      };
    }
  } catch (err) {
    console.warn("audio preference parse failed", err);
  }
  return { music: true, sfx: true };
}

function saveAudioPrefs(pref) {
  localStorage.setItem(AUDIO_PREF_KEY, JSON.stringify(pref));
  document.dispatchEvent(new CustomEvent("audio-preferences-changed", { detail: pref }));
}

function buildSettingsModal() {
  let overlay = document.querySelector(".settings-overlay");
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.className = "settings-overlay";
  const modal = document.createElement("div");
  modal.className = "settings-modal";
  const title = document.createElement("h3");
  title.textContent = "환경 설정";
  const desc = document.createElement("p");
  desc.textContent = "배경음과 효과음을 상황에 맞게 토글하세요.";
  desc.style.marginTop = "0";
  desc.style.marginBottom = "12px";

  const togglesWrap = document.createElement("div");
  togglesWrap.className = "settings-toggles";

  const musicToggle = createToggleRow("배경음", "music");
  const sfxToggle = createToggleRow("효과음", "sfx");
  togglesWrap.append(musicToggle.row, sfxToggle.row);

  const actions = document.createElement("div");
  actions.className = "settings-actions";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "닫기";
  actions.appendChild(closeBtn);

  modal.append(title, desc, togglesWrap, actions);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      hideSettingsModal(overlay);
    }
  });
  closeBtn.addEventListener("click", () => hideSettingsModal(overlay));

  const prefs = loadAudioPrefs();
  musicToggle.input.checked = prefs.music;
  sfxToggle.input.checked = prefs.sfx;

  musicToggle.input.addEventListener("change", () => {
    const next = { ...prefs, music: musicToggle.input.checked };
    saveAudioPrefs(next);
    Object.assign(prefs, next);
  });
  sfxToggle.input.addEventListener("change", () => {
    const next = { ...prefs, sfx: sfxToggle.input.checked };
    saveAudioPrefs(next);
    Object.assign(prefs, next);
  });

  return overlay;
}

function createToggleRow(labelText, key) {
  const row = document.createElement("div");
  row.className = "settings-toggle";
  const label = document.createElement("label");
  label.htmlFor = `settings-${key}`;
  label.textContent = labelText;
  const input = document.createElement("input");
  input.type = "checkbox";
  input.id = `settings-${key}`;
  row.append(label, input);
  return { row, input };
}

function showSettingsModal() {
  const overlay = buildSettingsModal();
  overlay.classList.add("active");
}

function hideSettingsModal(overlay = document.querySelector(".settings-overlay")) {
  if (!overlay) return;
  overlay.classList.remove("active");
}

function clearAuthState() {
  localStorage.removeItem("et_u");
  localStorage.removeItem("et_ss");
  sessionStorage.removeItem("et_tp");
  localStorage.removeItem("access_token"); // legacy cleanup
  sessionStorage.removeItem("access_token"); // legacy cleanup
  state.currentUser = null;
  state.placedGenerators = [];
  if (state.energyTimer) {
    clearInterval(state.energyTimer);
    state.energyTimer = null;
  }
  stopAutosaveTimer();
}

function handleLogout() {
  clearAuthState();
  window.location.href = "index.html";
}

function isProfileOpen() {
  return Boolean(dom.profileRoot && dom.profileRoot.classList.contains("profile-open"));
}

function openProfile() {
  if (!dom.profileRoot) return;
  dom.profileRoot.classList.add("profile-open");
  updateRankFromServer().catch((err) => console.warn("rank refresh failed (profile)", err));
}

function closeProfile() {
  if (!dom.profileRoot) return;
  dom.profileRoot.classList.remove("profile-open");
  dom.profileRoot.classList.add("profile-closing");
  setTimeout(() => dom.profileRoot && dom.profileRoot.classList.remove("profile-closing"), CLOSE_DELAY);
}

function toggleProfile(event) {
  if (!dom.profileRoot) return;
  if (isProfileOpen()) {
    closeProfile();
  } else {
    openProfile();
  }
  if (event) event.stopPropagation();
}

function setupProfileToggle() {
  if (!dom.profileRoot) return;
  const trigger = dom.profileTrigger || dom.profileRoot;
  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    toggleProfile(event);
  });
  document.addEventListener("click", (event) => {
    if (!isProfileOpen()) return;
    if (dom.profileRoot.contains(event.target)) return;
    closeProfile();
  });
}

function setupProfileButtons() {
  const settingsBtn = document.querySelector(".settings-open-btn");
  if (settingsBtn) {
    settingsBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      closeProfile();
      showSettingsModal();
    });
  }
  const logoutBtn = document.querySelector(".logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      closeProfile();
      handleLogout();
    });
  }
}

export function initProfileControls() {
  setupProfileToggle();
  setupProfileButtons();
}
