// 발전기 이미지/좌표 관련 보조 함수들
import { generators } from "./data.js";
import { dom } from "./ui.js";
import { state } from "./state.js";
import { formatResourceValue, fromPlainValue } from "./bigValue.js";

const BUILD_OVERLAY_SRC = "./generator/build.png";

export function defaultPlacementY() {
  const height = dom.mainArea ? dom.mainArea.clientHeight : 0;
  return Math.max(32, height - 160);
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
    transform: "translate(-50%, 0)",
    pointerEvents: "auto",
    cursor: "pointer",
    textAlign: "center"
  });
  const img = document.createElement("img");
  img.src = imgSrc;
  img.width = 64;
  img.height = 48;
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
    const name = g.type || state.generatorTypeIdToName[g.generator_type_id] || "";
    const idx = findGeneratorIndexByName(name);
    const imgSrc = idx >= 0 ? makeImageSrcByIndex(idx) : placeholderDataUrl();
    const typeInfo = state.generatorTypesById[g.generator_type_id] || {};
    const entry = {
      x: g.x_position,
      name,
      genIndex: idx,
      generator_id: g.generator_id,
      generator_type_id: g.generator_type_id,
      level: g.level || 1,
      baseCost: g.cost || typeInfo.cost || 0,
      isDeveloping: Boolean(g.isdeveloping),
      buildCompleteTs: g.build_complete_ts ? g.build_complete_ts * 1000 : null,
      buildTimer: null,
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
