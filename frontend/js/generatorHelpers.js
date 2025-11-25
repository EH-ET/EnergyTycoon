// 발전기 이미지/좌표 관련 보조 함수들
import { generators } from "./data.js";
import { dom } from "./ui.js";
import { state } from "./state.js";
import { formatResourceValue, fromPlainValue } from "./bigValue.js";

const BUILD_OVERLAY_SRC = "./generator/build.png";
const DEFAULT_TOLERANCE = 100;

export function getBuildDurationMs(meta) {
  const seconds = Number(meta?.["설치시간(초)"]);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.max(1000, seconds * 1000);
  }
  return 2000;
}

export function defaultPlacementY() {
  const height = dom.mainArea ? dom.mainArea.clientHeight : 0;
  return Math.max(32, height - 80);
}

export function makeImageSrcByIndex(idx) {
  const num = Number(idx);
  if (Number.isNaN(num)) return placeholderDataUrl();
  return `generator/${num + 1}.png`;
}

export function findGeneratorIndexByName(name) {
  return generators.findIndex((g) => g && g.이름 === name);
}

export function placeholderDataUrl() {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='180'><rect width='100%' height='100%' fill='%23e0e0e0'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='20' fill='%23666'>이미지 없음</text></svg>`;
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

function cleanupEntry(entry) {
  if (!entry) return;
  if (entry.buildTimer) {
    clearTimeout(entry.buildTimer);
    entry.buildTimer = null;
  }
}

export function clearPlacedGeneratorVisuals() {
  state.placedGenerators.forEach((entry) => cleanupEntry(entry));
  state.placedGenerators.length = 0;
  document.querySelectorAll(".placed-generator").forEach((el) => el.remove());
}

export function placeGeneratorVisual(x, imgSrc, name, generatorId) {
  if (!dom.mainArea) return null;
  if (getComputedStyle(dom.mainArea).position === "static") {
    dom.mainArea.style.position = "relative";
  }
  const offset = Number(state.userOffsetX) || 0;
  const worldX = Number(x) || 0;
  const screenX = worldX + offset;
  const el = document.createElement("div");
  el.className = "placed-generator";
  if (generatorId) {
    el.dataset.generatorId = generatorId;
  }
  el.dataset.worldX = String(worldX);
  Object.assign(el.style, {
    position: "absolute",
    left: `${screenX}px`,
    top: `${defaultPlacementY()}px`,
    transform: "translate(-50%, -100%)",
    pointerEvents: "auto",
    cursor: "pointer",
    textAlign: "center"
  });
  const img = document.createElement("img");
  img.src = imgSrc;
  // 발전기 크기 비율 적용 (기본 단위 50px, 최소/최대 범위 지정)
  const sizeFactor = Number(name && generators.find((g) => g?.이름 === name)?.크기) || 1;
  const width = Math.max(32, Math.min(300, sizeFactor * 50));
  img.width = width;
  img.style.display = "block";
  img.style.filter = "drop-shadow(0 2px 4px rgba(0,0,0,0.25))";
  const lbl = document.createElement("div");
  lbl.textContent = name;
  lbl.style.fontSize = "11px";
  lbl.style.color = "#333";
  el.appendChild(img);
  el.appendChild(lbl);
  dom.mainArea.appendChild(el);
  return el;
}

export function renderSavedGenerators(list) {
  if (!Array.isArray(list)) return;
  list.forEach((g) => {
    const typeInfo = state.generatorTypesById[g.generator_type_id] || {};
    const idxFromType = Number.isInteger(typeInfo.index) ? typeInfo.index : null;
    const idAsNumber = Number(g.generator_type_id);
    const idxFromId = Number.isFinite(idAsNumber) ? idAsNumber : null;
    let idx = idxFromType;
    if (idx == null || idx < 0 || idx >= generators.length) {
      if (idxFromId != null && idxFromId >= 0 && idxFromId < generators.length) {
        idx = idxFromId;
      } else if (idxFromId != null && idxFromId - 1 >= 0 && idxFromId - 1 < generators.length) {
        idx = idxFromId - 1; // allow 1-based ids
      }
    }
    const name = g.type
      || typeInfo.name
      || state.generatorTypeIdToName[g.generator_type_id]
      || (idx != null && idx >= 0 && idx < generators.length ? generators[idx]?.이름 : "");
    if (idx == null || idx < 0 || idx >= generators.length) {
      idx = findGeneratorIndexByName(name);
    }
    const imgSrc = idx >= 0 ? makeImageSrcByIndex(idx) : placeholderDataUrl();
    const meta = generators[idx] || {};
    const baseBuildDurationMs = getBuildDurationMs(meta);
    const entry = {
      x: g.x_position,
      name,
      genIndex: idx,
      generator_id: g.generator_id,
      generator_type_id: g.generator_type_id,
      level: g.level || 1,
      baseCost: g.cost || typeInfo.cost || 0,
      cost_data: g.cost_data,
      cost_high: g.cost_high,
      isDeveloping: Boolean(g.isdeveloping),
      buildCompleteTs: g.build_complete_ts ? g.build_complete_ts * 1000 : null,
      baseBuildDurationMs,
      buildDurationMs: baseBuildDurationMs,
      buildTimer: null,
      running: g.running !== false,
      heat: Number(g.heat) || 0,
      tolerance: Number(meta?.내열한계) || DEFAULT_TOLERANCE,
      baseTolerance: Number(meta?.내열한계) || DEFAULT_TOLERANCE,
      heatRate: Number(meta?.발열) || 0,
      upgrades: g.upgrades || { production: 0, heat_reduction: 0, tolerance: 0 },
    };
    entry.element = placeGeneratorVisual(g.x_position, imgSrc, name || "발전기", g.generator_id);
    state.placedGenerators.push(entry);
    applyBuildOverlay(entry);
  });
}

export function updateGeneratorPositions() {
  const offset = Number(state.userOffsetX) || 0;
  document.querySelectorAll(".placed-generator").forEach((el) => {
    const base = Number(el.dataset.worldX);
    const worldX = Number.isFinite(base) ? base : 0;
    el.style.left = `${worldX + offset}px`;
  });
}

function ensureBuildOverlayElement(element) {
  let overlay = element.querySelector(".build-overlay");
  if (!overlay) {
    overlay = document.createElement("img");
    overlay.className = "build-overlay";
    overlay.src = BUILD_OVERLAY_SRC;
    overlay.style.position = "absolute";
    overlay.style.top = "-20px";
    overlay.style.left = "50%";
    overlay.style.transform = "translate(-50%, 0)";
    overlay.style.width = "48px";
    overlay.style.pointerEvents = "none";
    element.appendChild(overlay);
  }
  return overlay;
}

function clearBuildOverlay(entry) {
  if (!entry || !entry.element) return;
  const overlay = entry.element.querySelector(".build-overlay");
  if (overlay) overlay.remove();
  if (entry.buildTimer) {
    clearTimeout(entry.buildTimer);
    entry.buildTimer = null;
  }
}

function applyBuildOverlay(entry) {
  if (!entry || !entry.element) return;
  if (!entry.isDeveloping) {
    clearBuildOverlay(entry);
    return;
  }
  const overlay = ensureBuildOverlayElement(entry.element);
  overlay.style.display = "block";
  const remaining = Math.max(0, (entry.buildCompleteTs || Date.now()) - Date.now());
  if (entry.buildTimer) {
    clearTimeout(entry.buildTimer);
    entry.buildTimer = null;
  }
  if (remaining <= 0) {
    entry.isDeveloping = false;
    entry.buildCompleteTs = null;
    clearBuildOverlay(entry);
    return;
  }
  entry.buildTimer = window.setTimeout(() => {
    entry.isDeveloping = false;
    entry.buildCompleteTs = null;
    clearBuildOverlay(entry);
  }, remaining);
}

export function syncEntryBuildState(entry, generator) {
  if (!entry) return;
  if (generator) {
    entry.level = generator.level || entry.level || 1;
    if (generator.cost != null) entry.baseCost = generator.cost;
    entry.isDeveloping = Boolean(generator.isdeveloping);
    entry.buildCompleteTs = generator.build_complete_ts ? generator.build_complete_ts * 1000 : null;
    if (!entry.baseBuildDurationMs || entry.baseBuildDurationMs <= 0) {
      const meta = entry.genIndex != null && entry.genIndex >= 0 ? generators[entry.genIndex] : null;
      entry.baseBuildDurationMs = getBuildDurationMs(meta);
    }
    entry.buildDurationMs = entry.baseBuildDurationMs || entry.buildDurationMs || 2000;
    entry.running = generator.running !== false;
    if (typeof generator.heat === "number") entry.heat = generator.heat;
    if (generator.upgrades) entry.upgrades = generator.upgrades;
  }
  applyBuildOverlay(entry);
}

export function computeSkipCost(entry) {
  if (!entry || !entry.isDeveloping) return 0;
  const remainingSeconds = Math.max(0, Math.ceil(((entry.buildCompleteTs || Date.now()) - Date.now()) / 1000));
  const baseCost = entry.baseCost || 0;
  return Math.max(1, Math.ceil((remainingSeconds || 1) * baseCost / 10));
}

export function formatPlainValue(amount) {
  return formatResourceValue(fromPlainValue(amount));
}

export function cleanupGeneratorEntry(entry) {
  cleanupEntry(entry);
  if (entry.element) {
    const overlay = entry.element.querySelector(".build-overlay");
    if (overlay) overlay.remove();
  }
}
