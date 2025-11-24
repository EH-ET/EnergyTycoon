// 드롭 이벤트를 처리해 발전기를 설치
import { generators } from "./data.js";
import {
  placeGeneratorVisual,
  makeImageSrcByIndex,
  findGeneratorIndexByName,
  placeholderDataUrl,
  syncEntryBuildState,
  computeSkipCost,
  formatPlainValue,
  cleanupGeneratorEntry,
} from "./generatorHelpers.js";
import { saveProgress, demolishGenerator, skipGeneratorBuild, updateGeneratorState } from "./apiClient.js";
import { dom } from "./ui.js";
import {
  state,
  getAuthContext,
  syncUserState,
  beginTrapGuardGracePeriod,
  touchTrapMarker,
  compareMoneyWith,
} from "./state.js";
import { startEnergyTimer } from "./energy.js";

const BASE_MAX_GENERATORS = 10;
const GENERATOR_STEP = 5;
const DEMOLISH_COST_RATE = 0.5;
const DEFAULT_TOLERANCE = 100;

let generatorModal = null;

function ensureModal() {
  if (generatorModal) return generatorModal;
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.right = "0";
  overlay.style.bottom = "0";
  overlay.style.background = "rgba(0,0,0,0.5)";
  overlay.style.display = "none";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "10000";

  const box = document.createElement("div");
  box.style.background = "#111";
  box.style.color = "#fff";
  box.style.padding = "20px";
  box.style.borderRadius = "8px";
  box.style.minWidth = "260px";
  box.style.boxShadow = "0 6px 20px rgba(0,0,0,0.5)";
  overlay.appendChild(box);

  const title = document.createElement("h3");
  title.style.marginTop = "0";
  box.appendChild(title);

  const desc = document.createElement("p");
  desc.style.fontSize = "14px";
  box.appendChild(desc);

  const actions = document.createElement("div");
  actions.className = "modal-actions";
  actions.style.display = "flex";
  actions.style.gap = "8px";
  actions.style.marginTop = "12px";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.textContent = "닫기";
  cancelBtn.style.flex = "1";
  cancelBtn.onclick = () => hideModal();

  const demolishBtn = document.createElement("button");
  demolishBtn.type = "button";
  demolishBtn.textContent = "철거";
  demolishBtn.style.flex = "1";
  demolishBtn.style.background = "#c0392b";
  demolishBtn.style.color = "#fff";
  demolishBtn.dataset.generatorId = "";

  actions.appendChild(cancelBtn);
  actions.appendChild(demolishBtn);
  box.appendChild(actions);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) hideModal();
  });

  document.body.appendChild(overlay);
  generatorModal = { overlay, title, desc, demolishBtn };
  return generatorModal;
}

function hideModal() {
  if (generatorModal) {
    generatorModal.overlay.style.display = "none";
    generatorModal.demolishBtn.onclick = null;
  }
}

function showGeneratorModal(entry, element) {
  const auth = getAuthContext();
  if (!auth) {
    alert("로그인이 필요합니다.");
    return;
  }
  const modal = ensureModal();
  const typeInfo = entry.generator_type_id
    ? state.generatorTypesById[entry.generator_type_id]
    : null;
  const baseCost = typeInfo ? typeInfo.cost : 0;
  const demolishCost = Math.max(1, Math.round(baseCost * DEMOLISH_COST_RATE));
  modal.title.textContent = entry.name || "발전기";
  modal.desc.textContent = `철거 비용: ${demolishCost} 돈`;
  modal.overlay.querySelectorAll(".heat-info").forEach((node) => node.remove());
  const tolerance = entry.tolerance || DEFAULT_TOLERANCE;
  const heatLine = document.createElement("p");
  heatLine.className = "heat-info";
  heatLine.style.margin = "4px 0";
  const updateHeatLine = () => {
    heatLine.textContent = `발열: ${Math.round(entry.heat || 0)} / ${tolerance}`;
  };
  updateHeatLine();
  const prevInfo = modal.overlay.querySelector(".build-info");
  if (prevInfo) prevInfo.remove();
  const actions = modal.overlay.querySelector(".modal-actions");
  const prevSkip = actions.querySelector(".skip-button");
  if (prevSkip) prevSkip.remove();
  const prevToggle = actions.querySelector(".run-toggle");
  if (prevToggle) prevToggle.remove();
  modal.demolishBtn.textContent = `철거 (비용 ${demolishCost})`;
  if (entry.isDeveloping) {
    const remainingSeconds = Math.max(
      0,
      Math.ceil(((entry.buildCompleteTs || Date.now()) - Date.now()) / 1000),
    );
    const info = document.createElement("p");
    info.style.margin = "6px 0";
     info.className = "build-info";
    info.textContent = `건설 중 (${remainingSeconds}초 남음)`;
    modal.desc.insertAdjacentElement("afterend", info);
    const skipCost = computeSkipCost(entry);
    const skipBtn = document.createElement("button");
    skipBtn.type = "button";
    skipBtn.textContent = `즉시 완성 (${formatPlainValue(skipCost)})`;
    skipBtn.style.flex = "1";
    skipBtn.className = "skip-button";
    skipBtn.onclick = async () => {
      try {
        beginTrapGuardGracePeriod();
        const res = await skipGeneratorBuild(entry.generator_id);
        touchTrapMarker();
        if (res.user) {
          syncUserState(res.user);
        }
        if (res.generator) {
          syncEntryBuildState(entry, res.generator);
        }
        hideModal();
      } catch (err) {
        alert(err.message || "건설 스킵 실패");
      }
    };
    actions.appendChild(skipBtn);
  }
  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "run-toggle";
  toggleBtn.textContent = entry.running === false ? "운영 재개" : "운영 중단";
  toggleBtn.style.flex = "1";
  toggleBtn.style.background = entry.running === false ? "#27ae60" : "#f39c12";
  toggleBtn.style.color = "#fff";
  toggleBtn.onclick = async () => {
    try {
      beginTrapGuardGracePeriod();
      const res = await updateGeneratorState(entry.generator_id, {
        running: entry.running === false,
        heat: entry.heat,
      });
      if (res.generator) {
        syncEntryBuildState(entry, res.generator);
        entry.running = res.generator.running !== false;
        entry.heat = typeof res.generator.heat === "number" ? res.generator.heat : entry.heat;
        updateHeatLine();
      }
      if (res.user) syncUserState(res.user);
      touchTrapMarker();
      hideModal();
    } catch (err) {
      alert(err.message || "상태 변경 실패");
    }
  };
  actions.appendChild(toggleBtn);

  modal.desc.insertAdjacentElement("afterend", heatLine);
  modal.demolishBtn.onclick = async () => {
    try {
      beginTrapGuardGracePeriod();
      const token = auth.token;
      const res = await demolishGenerator(entry.generator_id, token);
      state.placedGenerators = state.placedGenerators.filter(
        (g) => g.generator_id !== entry.generator_id,
      );
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
      if (res.user) {
        syncUserState(res.user);
        touchTrapMarker();
      }
    } catch (err) {
      alert(err.message || "철거 실패");
    } finally {
      hideModal();
    }
  };
  modal.overlay.style.display = "flex";
}

function computeMaxGenerators(user) {
  if (!user) return BASE_MAX_GENERATORS;
  return BASE_MAX_GENERATORS + (Number(user.max_generators_bonus) || 0) * GENERATOR_STEP;
}

export function initDropHandlers() {
  if (!dom.mainArea) return;
  if (getComputedStyle(dom.mainArea).position === "static") {
    dom.mainArea.style.position = "relative";
  }
  dom.mainArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    dom.mainArea.classList.add("drag-over");
  });
  dom.mainArea.addEventListener("dragleave", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dom.mainArea.classList.remove("drag-over");
  });
  dom.mainArea.addEventListener("drop", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dom.mainArea.classList.remove("drag-over");
    const idx = e.dataTransfer.getData("text/plain");
    if (idx === "") return;
    const rect = dom.mainArea.getBoundingClientRect();
    const screenX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const worldX = Math.max(0, Math.round(screenX - (Number(state.userOffsetX) || 0)));
    const gen = generators[Number(idx)];
    if (!gen) return;

    const auth = getAuthContext();
    if (!auth) {
      alert("설치하려면 로그인 필요합니다.");
      return;
    }
    const { token, user } = auth;
    const genInfo = state.generatorTypeInfoMap[gen.이름];
    const genTypeId = genInfo ? genInfo.id : state.generatorTypeMap[gen.이름];
    const cost = genInfo && typeof genInfo.cost === "number" ? genInfo.cost : gen.설치비용;
    if (!genTypeId) {
      alert("서버에서 발전기 정보를 불러오지 못했습니다.");
      return;
    }
    if (compareMoneyWith(cost) < 0) {
      alert("돈이 부족합니다.");
      return;
    }
    const maxAllowed = computeMaxGenerators(state.currentUser);
    if (state.placedGenerators.length >= maxAllowed) {
      alert(`최대 발전기 수(${maxAllowed})를 초과했습니다.`);
      return;
    }
    try {
      beginTrapGuardGracePeriod();
      const res = await saveProgress(
        user.user_id,
        genTypeId,
        worldX,
        0,
        token,
        state.currentUser.energy,
      );
      if (res.user) {
        syncUserState(res.user);
      } else {
        user.money = Math.max(0, user.money - cost);
        syncUserState(user);
      }
      const genName = res.generator && res.generator.type ? res.generator.type : gen.이름;
      const idxByName = findGeneratorIndexByName(genName);
      const imgSrc = idxByName >= 0 ? makeImageSrcByIndex(idxByName) : placeholderDataUrl();
      const tolerance = Number(gen.내열한계) || DEFAULT_TOLERANCE;
      const heatRate = Number(gen.발열) || 0;
      const level = res.generator.level || 1;
      const entry = {
        x: worldX,
        name: genName,
        genIndex: idxByName,
        generator_id: res.generator.generator_id,
        generator_type_id: res.generator.generator_type_id,
        level,
        baseCost: cost,
        isDeveloping: Boolean(res.generator.isdeveloping),
        buildCompleteTs: res.generator.build_complete_ts ? res.generator.build_complete_ts * 1000 : null,
        buildDurationMs: Math.max(1000, 2 ** level * 1000),
        buildTimer: null,
        running: res.generator.running !== false,
        heat: typeof res.generator.heat === "number" ? res.generator.heat : 0,
        tolerance,
        heatRate,
      };
      entry.element = placeGeneratorVisual(worldX, imgSrc, genName, res.generator.generator_id);
      state.placedGenerators.push(entry);
      syncEntryBuildState(entry, res.generator);
      syncUserState(state.currentUser);
      touchTrapMarker();
      startEnergyTimer();
    } catch (err) {
      alert("설치 실패: " + (err.message || err));
    }
  });

  if (!dom.mainArea.dataset.generatorClickBound) {
    dom.mainArea.addEventListener("click", (event) => {
      const target = event.target.closest(".placed-generator");
      if (!target) return;
      const id = target.dataset.generatorId;
      if (!id) return;
      const entry = state.placedGenerators.find((g) => g.generator_id === id);
      if (!entry) return;
      showGeneratorModal(entry, target);
    });
    dom.mainArea.dataset.generatorClickBound = "1";
  }
}
