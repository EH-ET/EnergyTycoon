// 발전기 이미지/좌표 관련 보조 함수들
import { generators } from "./data.js";
import { dom } from "./ui.js";
import { state } from "./state.js";

export function defaultPlacementY() {
  const height = dom.mainArea ? dom.mainArea.clientHeight : 0;
  return Math.max(16, height - 96);
}

export function makeImageSrcByIndex(idx) {
  const num = Number(idx);
  if (Number.isNaN(num)) return placeholderDataUrl();
  return `/frontend/generator/${num + 1}.png`;
}

export function findGeneratorIndexByName(name) {
  return generators.findIndex((g) => g && g.이름 === name);
}

export function placeholderDataUrl() {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='180'><rect width='100%' height='100%' fill='%23e0e0e0'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='20' fill='%23666'>이미지 없음</text></svg>`;
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

export function clearPlacedGeneratorVisuals() {
  state.placedGenerators.length = 0;
  document.querySelectorAll(".placed-generator").forEach((el) => el.remove());
}

export function placeGeneratorVisual(x, imgSrc, name) {
  if (!dom.mainArea) return;
  if (getComputedStyle(dom.mainArea).position === "static") {
    dom.mainArea.style.position = "relative";
  }
  const el = document.createElement("div");
  el.className = "placed-generator";
  Object.assign(el.style, {
    position: "absolute",
    left: `${x}px`,
    top: `${defaultPlacementY()}px`,
    transform: "translate(-50%, 0)",
    pointerEvents: "none",
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
}

export function renderSavedGenerators(list) {
  if (!Array.isArray(list)) return;
  list.forEach((g) => {
    const name = g.type || state.generatorTypeIdToName[g.generator_type_id] || "";
    const idx = findGeneratorIndexByName(name);
    const imgSrc = idx >= 0 ? makeImageSrcByIndex(idx) : placeholderDataUrl();
    state.placedGenerators.push({ x: g.x_position, name, genIndex: idx });
    placeGeneratorVisual(g.x_position, imgSrc, name || "발전기");
  });
}
