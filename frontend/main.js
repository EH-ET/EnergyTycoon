// 엔트리 포인트: 탭 전환, 초기 데이터 로드, 진행도 하이드레이션
import { dom, updateUserUI /*, updateExchangeRateUI, updateEnergyRateUI */ } from "./js/ui.js";
import { renderGeneratorTab } from "./js/generatorTab.js";
import { renderTradeTab } from "./js/tradeTab.js";
import { renderUpgradeTab } from "./js/upgradeTab.js";
import { renderInfoTab, destroyInfoTab } from "./js/infoTab.js";
import { loadGeneratorTypes, loadProgress, fetchExchangeRate } from "./js/apiClient.js";
import { clearPlacedGeneratorVisuals, renderSavedGenerators } from "./js/generatorHelpers.js";
import { initDropHandlers } from "./js/dropHandlers.js";
import { startEnergyTimer } from "./js/energy.js";
import {
  state,
  setContentMode,
  getStoredUser,
  syncUserState,
  registerUserChangeHandler,
  ensureSessionStart,
  initTrapGuard,
  installTrapFetchGuard,
} from "./js/state.js";
import { updateRankFromServer } from "./js/rank.js";
import { startAutosaveTimer } from "./js/autosave.js";
import { initProfileControls } from "./js/profile.js";
import { initViewportControls } from "./js/viewport.js";

function renderContent() {
  destroyInfoTab();
  switch (state.contentMode) {
    case "generator":
      renderGeneratorTab();
      break;
    case "trade":
      renderTradeTab();
      break;
    case "upgrade":
      renderUpgradeTab();
      break;
    case "info":
      renderInfoTab();
      break;
    default:
      dom.contentArea.replaceChildren();
  }
}

function loadUserData() {
  const stored = getStoredUser();
  if (!stored) return;
  syncUserState(stored);
  ensureSessionStart();
  startEnergyTimer();
}

async function hydrateProgress() {
  if (!state.currentUser) return;
  try {
    clearPlacedGeneratorVisuals();
    const res = await loadProgress(state.currentUser.user_id, null);
    if (res.user) {
      syncUserState(res.user);
    }
    renderSavedGenerators(res.generators);
    updateUserUI(state.currentUser, state.placedGenerators.length);
    startEnergyTimer();
  } catch (e) {
    console.warn("progress load failed", e);
  }
}

function wireModeButtons() {
  dom.generatorBtn.addEventListener("click", () => { setContentMode("generator"); renderContent(); });
  dom.tradeBtn.addEventListener("click", () => { setContentMode("trade"); renderContent(); });
  dom.upgradeBtn.addEventListener("click", () => { setContentMode("upgrade"); renderContent(); });
  dom.infoBtn.addEventListener("click", () => { setContentMode("info"); renderContent(); });
}

let exchangeRateTimer = null;

function startExchangeRateWatcher() {
  if (exchangeRateTimer) {
    clearInterval(exchangeRateTimer);
    exchangeRateTimer = null;
  }
  const fetchRate = async () => {
    if (!state.currentUser) return;
    try {
      const data = await fetchExchangeRate(null);
      state.exchangeRate = data.rate;
      updateExchangeRateUI(state.exchangeRate);
    } catch (e) {
      console.warn("exchange rate update failed", e);
    }
  };
  fetchRate();
  exchangeRateTimer = window.setInterval(fetchRate, 60_000);
}

document.addEventListener("DOMContentLoaded", async () => {
  installTrapFetchGuard();
  initTrapGuard();
  registerUserChangeHandler((user) => updateUserUI(user, state.placedGenerators.length));
  await loadGeneratorTypes(state);
  loadUserData();
  renderContent();
  // updateExchangeRateUI(state.exchangeRate);
  // updateEnergyRateUI(0);
  initDropHandlers();
  wireModeButtons();
  initProfileControls();
  initViewportControls();
  await hydrateProgress();
  try {
    await updateRankFromServer();
  } catch (e) {
    console.warn("rank fetch failed", e);
  }
  startExchangeRateWatcher();
  startAutosaveTimer();
});
