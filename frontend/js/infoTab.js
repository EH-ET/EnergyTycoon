// 정보 탭 렌더링
import { requireLoginForContent, dom } from "./ui.js";
import { state, ensureSessionStart } from "./state.js";

function formatPlayTime(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return `${days}일 ${hours}시간 ${minutes}분`;
}

export function renderInfoTab() {
  dom.contentArea.innerHTML = "";
  if (!requireLoginForContent(state.currentUser, "로그인 후 확인하세요.")) return;
  const sessionStart = ensureSessionStart();
  const playTime = formatPlayTime(Date.now() - sessionStart);
  const totalEnergy = state.currentUser.energy ?? 0;
  const totalMoney = state.currentUser.money ?? 0;
  const rank = state.currentUser.rank ?? "-";
  const infoLines = [
    `이름: ${state.currentUser.username}`,
    `플레이시간: ${playTime}`,
    `얻은 총 에너지량: ${totalEnergy}`,
    `얻은 총 돈: ${totalMoney}`,
    `등수: ${rank}`
  ].join("\n");
  const box = document.createElement("div");
  box.style.whiteSpace = "pre-line";
  box.style.padding = "12px";
  box.style.color = "#cececeff";
  box.textContent = infoLines;
  dom.contentArea.appendChild(box);
}
