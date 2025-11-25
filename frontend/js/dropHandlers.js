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
  getBuildDurationMs,
} from "./generatorHelpers.js";
import { saveProgress, demolishGenerator, skipGeneratorBuild, updateGeneratorState, upgradeGenerator } from "./apiClient.js";
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
import { valueFromServer, formatResourceValue, fromPlainValue, toPlainValue } from "./bigValue.js";

const BASE_MAX_GENERATORS = 10;
const GENERATOR_STEP = 5;
const DEMOLISH_COST_RATE = 0.5;
const DEFAULT_TOLERANCE = 100;
const UPGRADE_CONFIG = {
  production: { label: "생산량 증가", desc: "에너지 생산 +10%/레벨, 발열 +0.5/레벨", baseMultiplier: 0.5, growth: 1.25 },
  heat_reduction: { label: "발열 감소", desc: "발열 10% 감소/레벨", baseMultiplier: 0.4, growth: 1.2 },
  tolerance: { label: "내열 증가", desc: "내열 +10/레벨", baseMultiplier: 0.45, growth: 1.2 },
};

let generatorModal = null;
let upgradeModal = null;

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

function ensureUpgradeModal() {
  if (upgradeModal) return upgradeModal;
  const overlay = document.createElement("div");
  overlay.className = "upgrade-overlay";
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    background: "rgba(0,0,0,0.6)",
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "11000",
  });
  const box = document.createElement("div");
  Object.assign(box.style, {
    background: "#0f0f0f",
    color: "#f6f6f6",
    padding: "18px",
    borderRadius: "10px",
    minWidth: "320px",
    maxWidth: "420px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
  });
  const title = document.createElement("h3");
  title.textContent = "발전기 업그레이드";
  title.style.marginTop = "0";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "닫기";
  closeBtn.style.marginTop = "12px";
  closeBtn.style.width = "100%";
  closeBtn.onclick = () => (overlay.style.display = "none");
  const list = document.createElement("div");
  list.className = "upgrade-list";
  list.style.display = "grid";
  list.style.gap = "10px";
  list.style.marginTop = "12px";
  box.append(title, list, closeBtn);
  overlay.appendChild(box);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.style.display = "none";
  });
  document.body.appendChild(overlay);
  upgradeModal = { overlay, list, title };
  return upgradeModal;
}

function computeUpgradeCost(entry, key, amount = 1) {
  const cfg = UPGRADE_CONFIG[key];
  if (!cfg) return 0;
  const baseCost = toPlainValue(valueFromServer(entry.cost_data, entry.cost_high, entry.baseCost || 10)) || 10;
  const current = entry.upgrades?.[key] || 0;
  let total = 0;
  for (let i = 0; i < amount; i += 1) {
    const level = current + i + 1;
    total += Math.max(1, Math.floor(baseCost * cfg.baseMultiplier * cfg.growth ** level));
  }
  return total;
}

function openUpgradeModal(entry) {
  const modal = ensureUpgradeModal();
  const list = modal.list;
  list.replaceChildren();
  Object.entries(UPGRADE_CONFIG).forEach(([key, cfg]) => {
    const card = document.createElement("div");
    Object.assign(card.style, {
      border: "1px solid #333",
      padding: "10px",
      borderRadius: "8px",
      background: "#141414",
    });
    const title = document.createElement("div");
    title.textContent = cfg.label;
    title.style.fontWeight = "600";
    const desc = document.createElement("p");
    desc.textContent = cfg.desc;
    desc.style.margin = "4px 0 8px";
    desc.style.color = "#c9c9c9";
    const level = entry.upgrades?.[key] || 0;
    const levelLine = document.createElement("div");
    levelLine.textContent = `레벨: ${level}`;
    const costPlain = computeUpgradeCost(entry, key, 1);
    const costValue = fromPlainValue(costPlain);
    const costLine = document.createElement("div");
    costLine.textContent = `비용: ${formatResourceValue(costValue)}`;
    costLine.style.color = "#f1c40f";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "업그레이드";
    btn.style.marginTop = "6px";
    btn.style.width = "100%";
    btn.onclick = async () => {
      try {
        beginTrapGuardGracePeriod();
        const res = await upgradeGenerator(entry.generator_id, key, 1);
        if (res.user) syncUserState(res.user);
        if (res.generator) {
          syncEntryBuildState(entry, res.generator);
          entry.upgrades = res.generator.upgrades || entry.upgrades;
        }
        touchTrapMarker();
        openUpgradeModal(entry); // refresh
      } catch (err) {
        alert(err.message || "업그레이드 실패");
      }
    };
    card.append(title, desc, levelLine, costLine, btn);
    list.appendChild(card);
  });
  modal.overlay.style.display = "flex";
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
  if (!entry.upgrades) {
    entry.upgrades = { production: 0, heat_reduction: 0, tolerance: 0 };
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
  modal.overlay.querySelectorAll(".tolerance-info").forEach((node) => node.remove());
  const baseTolerance = entry.baseTolerance || entry.tolerance || DEFAULT_TOLERANCE;
  const heatLine = document.createElement("p");
  heatLine.className = "heat-info";
  heatLine.style.margin = "4px 0";
  const toleranceLine = document.createElement("p");
  toleranceLine.className = "tolerance-info";
  toleranceLine.style.margin = "0";
  const updateHeatLine = () => {
    const buffedTolerance = baseTolerance + (entry.upgrades?.tolerance || 0) * 10;
    heatLine.textContent = `발열: ${Math.round(entry.heat || 0)} / ${buffedTolerance}`;
    toleranceLine.textContent = `내열 증가: +${(entry.upgrades?.tolerance || 0) * 10}`;
  };
  updateHeatLine();
  const prevInfo = modal.overlay.querySelector(".build-info");
  if (prevInfo) prevInfo.remove();
  const actions = modal.overlay.querySelector(".modal-actions");
  const prevSkip = actions.querySelector(".skip-button");
  if (prevSkip) prevSkip.remove();
  const prevToggle = actions.querySelector(".run-toggle");
  if (prevToggle) prevToggle.remove();
  const prevUpgrade = actions.querySelector(".upgrade-button");
  if (prevUpgrade) prevUpgrade.remove();
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

  const upgradeBtn = document.createElement("button");
  upgradeBtn.type = "button";
  upgradeBtn.className = "upgrade-button";
  upgradeBtn.textContent = "업그레이드";
  upgradeBtn.style.flex = "1";
  upgradeBtn.style.background = "#2980b9";
  upgradeBtn.style.color = "#fff";
  upgradeBtn.onclick = () => {
    hideModal();
    openUpgradeModal(entry);
  };
  actions.appendChild(upgradeBtn);

  modal.desc.insertAdjacentElement("afterend", heatLine);
  modal.desc.insertAdjacentElement("afterend", toleranceLine);
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
      const typeInfo = state.generatorTypesById[res.generator.generator_type_id] || {};
      const idxFromType = Number.isInteger(typeInfo.index) ? typeInfo.index : null;
      const idAsNumber = Number(res.generator.generator_type_id);
      let genIndex = idxFromType;
      if (genIndex == null || genIndex < 0 || genIndex >= generators.length) {
        if (Number.isFinite(idAsNumber) && idAsNumber >= 0 && idAsNumber < generators.length) {
          genIndex = idAsNumber;
        } else if (Number.isFinite(idAsNumber) && idAsNumber - 1 >= 0 && idAsNumber - 1 < generators.length) {
          genIndex = idAsNumber - 1;
        }
      }
      const fallbackName = genIndex != null && genIndex >= 0 && genIndex < generators.length
        ? generators[genIndex]?.이름
        : null;
      const genName = (res.generator && res.generator.type)
        ? res.generator.type
        : (typeInfo.name || fallbackName || gen.이름);
      if (genIndex == null || genIndex < 0 || genIndex >= generators.length) {
        genIndex = findGeneratorIndexByName(genName);
      }
      const imgSrc = genIndex >= 0 ? makeImageSrcByIndex(genIndex) : placeholderDataUrl();
      const metaByIndex = genIndex != null && genIndex >= 0 && genIndex < generators.length
        ? generators[genIndex]
        : null;
      const tolerance = Number(metaByIndex?.내열한계 ?? gen.내열한계) || DEFAULT_TOLERANCE;
      const heatRate = Number(metaByIndex?.발열 ?? gen.발열) || 0;
      const level = res.generator.level || 1;
      const baseBuildDurationMs = getBuildDurationMs(metaByIndex);
      const entry = {
        x: worldX,
        name: genName,
        genIndex,
        generator_id: res.generator.generator_id,
        generator_type_id: res.generator.generator_type_id,
        level,
        baseCost: cost,
        cost_data: res.generator.cost_data,
        cost_high: res.generator.cost_high,
        isDeveloping: Boolean(res.generator.isdeveloping),
        buildCompleteTs: res.generator.build_complete_ts ? res.generator.build_complete_ts * 1000 : null,
        baseBuildDurationMs,
        buildDurationMs: baseBuildDurationMs,
        buildTimer: null,
        running: res.generator.running !== false,
        heat: typeof res.generator.heat === "number" ? res.generator.heat : 0,
        tolerance,
        baseTolerance: tolerance,
        heatRate,
        upgrades: res.generator.upgrades || { production: 0, heat_reduction: 0, tolerance: 0 },
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
