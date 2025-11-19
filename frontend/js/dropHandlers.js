// 드롭 이벤트를 처리해 발전기를 설치
import { generators } from "./data.js";
import { placeGeneratorVisual, makeImageSrcByIndex, findGeneratorIndexByName, placeholderDataUrl } from "./generatorHelpers.js";
import { saveProgress } from "./apiClient.js";
import { dom } from "./ui.js";
import { state, getAuthContext, syncUserState } from "./state.js";
import { startEnergyTimer } from "./energy.js";

export function initDropHandlers() {
  if (!dom.mainArea) return;
  if (getComputedStyle(dom.mainArea).position === "static") {
    dom.mainArea.style.position = "relative";
  }
  dom.mainArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    dom.mainArea.classList.add("drag-over");
  });
  dom.mainArea.addEventListener("dragleave", () => {
    dom.mainArea.classList.remove("drag-over");
  });
  dom.mainArea.addEventListener("drop", async (e) => {
    e.preventDefault();
    dom.mainArea.classList.remove("drag-over");
    const idx = e.dataTransfer.getData("text/plain");
    if (idx === "") return;
    const rect = dom.mainArea.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
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
    if (user.money < cost) {
      alert("돈이 부족합니다.");
      return;
    }
    try {
      const res = await saveProgress(user.user_id, genTypeId, Math.round(x), 0, token, state.currentUser.energy);
      if (res.user) {
        syncUserState(res.user);
      } else {
        user.money = Math.max(0, user.money - cost);
        syncUserState(user);
      }
      const genName = res.generator && res.generator.type ? res.generator.type : gen.이름;
      const idxByName = findGeneratorIndexByName(genName);
      const imgSrc = idxByName >= 0 ? makeImageSrcByIndex(idxByName) : placeholderDataUrl();
      state.placedGenerators.push({ x, name: genName, genIndex: idxByName });
      placeGeneratorVisual(x, imgSrc, genName);
      syncUserState(state.currentUser);
      startEnergyTimer();
    } catch (err) {
      alert("설치 실패: " + (err.message || err));
    }
  });
}
