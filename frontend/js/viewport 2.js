import { dom } from "./ui.js";
import { state } from "./state.js";
import { updateGeneratorPositions } from "./generatorHelpers.js";

const KEY_STEP = 80;

function adjustUserOffset(delta) {
  if (!delta) return;
  state.userOffsetX = (Number(state.userOffsetX) || 0) + delta;
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
  dom.mainArea.addEventListener("wheel", handleWheel, { passive: false });
  document.addEventListener("keydown", handleKey);
}
