import { dom } from "./ui.js";
import { state } from "./state.js";
import { updateGeneratorPositions } from "./generatorHelpers.js";

const KEY_STEP = 80;
const BG_FALLBACK_WIDTH = 4000;

function setBackgroundStyles() {
  if (!dom.mainArea) return;
  dom.mainArea.style.backgroundImage = "url('./backgroundImgEhET.png')";
  dom.mainArea.style.backgroundRepeat = "no-repeat";
  const offset = Number(state.userOffsetX) || 0;
  dom.mainArea.style.backgroundPosition = `calc(50% + ${offset}px) 0`;
  dom.mainArea.style.backgroundSize = "auto 100%";
}

function measureBackground() {
  if (!dom.mainArea) return;
  const img = new Image();
  img.onload = () => {
    const height = dom.mainArea.clientHeight || img.naturalHeight || 1;
    const scale = height / (img.naturalHeight || 1);
    state.backgroundHeight = height;
    state.backgroundWidth = (img.naturalWidth || BG_FALLBACK_WIDTH) * scale;
    const viewWidth = dom.mainArea.clientWidth || 0;
    const maxShift = Math.max(0, (state.backgroundWidth - viewWidth) / 2);
    state.userOffsetX = 0;
    if (maxShift > 0) {
      dom.mainArea.dataset.bgCenterOffset = String(maxShift);
    }
    updateGeneratorPositions();
  };
  img.src = "./backgroundImgEhET.png";
}

function clampOffset(nextOffset) {
  if (!dom.mainArea) return nextOffset;
  const viewWidth = dom.mainArea.clientWidth || 0;
  const bgWidth = state.backgroundWidth || BG_FALLBACK_WIDTH;
  const maxShift = Math.max(0, (bgWidth - viewWidth) / 2);
  const minOffset = -maxShift;
  const maxOffset = maxShift;
  return Math.min(maxOffset, Math.max(minOffset, nextOffset));
}

function adjustUserOffset(delta) {
  if (!delta) return;
  const current = Number(state.userOffsetX) || 0;
  state.userOffsetX = clampOffset(current + delta);
  updateGeneratorPositions();
}

function handleWheel(event) {
  if (!dom.mainArea) return;
  if (!dom.mainArea.contains(event.target)) return;
  event.preventDefault();
  const deltaX = event.deltaX;
  const deltaY = event.deltaY;
  let delta = 0;
  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    delta = deltaX;
  } else if (deltaY !== 0) {
    delta = deltaY;
  }
  adjustUserOffset(delta);
}

function handleKey(event) {
  const tag = event.target && event.target.tagName;
  if (tag && ["INPUT", "TEXTAREA", "SELECT"].includes(tag.toUpperCase())) return;
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    adjustUserOffset(-KEY_STEP);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    adjustUserOffset(KEY_STEP);
  }
}

export function initViewportControls() {
  if (!dom.mainArea) return;
  setBackgroundStyles();
  measureBackground();
  dom.mainArea.addEventListener("wheel", handleWheel, { passive: false });
  document.addEventListener("keydown", handleKey);
}
