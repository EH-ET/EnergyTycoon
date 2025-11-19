// 엔트리 포인트: 탭 전환, 초기 데이터 로드, 진행도 하이드레이션
import { dom, updateUserUI } from "./js/ui.js";
import { renderGeneratorTab } from "./js/generatorTab.js";
import { renderTradeTab } from "./js/tradeTab.js";
import { renderUpgradeTab } from "./js/upgradeTab.js";
import { renderInfoTab } from "./js/infoTab.js";
import { loadGeneratorTypes, loadProgress } from "./js/apiClient.js";
import { clearPlacedGeneratorVisuals, renderSavedGenerators } from "./js/generatorHelpers.js";
import { initDropHandlers } from "./js/dropHandlers.js";
import { startEnergyTimer } from "./js/energy.js";
import {
  state,
  setContentMode,
  getStoredUser,
  syncUserState,
  getAuthToken,
  registerUserChangeHandler,
} from "./js/state.js";

function renderContent() {
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
      dom.contentArea.innerHTML = "";
  }
}

function loadUserData() {
  const stored = getStoredUser();
  if (!stored) return;
  syncUserState(stored);
  startEnergyTimer();
}

async function hydrateProgress() {
  if (!state.currentUser) return;
  const token = getAuthToken();
  if (!token) return;
  try {
    clearPlacedGeneratorVisuals();
    const res = await loadProgress(state.currentUser.user_id, token);
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

document.addEventListener("DOMContentLoaded", async () => {
  registerUserChangeHandler((user) => updateUserUI(user, state.placedGenerators.length));
  await loadGeneratorTypes(state);
  loadUserData();
  renderContent();
  initDropHandlers();
  wireModeButtons();
  await hydrateProgress();
});
