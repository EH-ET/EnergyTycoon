import { requireLoginForContent, dom } from "./ui.js";
import { state, ensureSessionStart } from "./state.js";

let playTimeTimer = null;

function formatPlayTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}일 ${hours}시간 ${minutes}분 ${seconds}초`;
}

function stopPlayTimer() {
  if (playTimeTimer) {
    clearInterval(playTimeTimer);
    playTimeTimer = null;
  }
}

export function destroyInfoTab() {
  stopPlayTimer();
}

export function renderInfoTab() {
  stopPlayTimer();
  if (!requireLoginForContent(state.currentUser, "로그인 후 확인하세요.")) return;
  dom.contentArea.replaceChildren();

  const container = document.createElement("div");
  container.style.padding = "12px";
  container.style.color = "#cececeff";

  const nameLine = document.createElement("p");
  nameLine.textContent = `이름: ${state.currentUser.username}`;
  container.appendChild(nameLine);

  const playLine = document.createElement("p");
  container.appendChild(playLine);

  const energyLine = document.createElement("p");
  energyLine.textContent = `얻은 총 에너지량: ${state.currentUser.energy ?? 0}`;
  container.appendChild(energyLine);

  const moneyLine = document.createElement("p");
  moneyLine.textContent = `얻은 총 돈: ${state.currentUser.money ?? 0}`;
  container.appendChild(moneyLine);

  const rankLine = document.createElement("p");
  rankLine.textContent = `등수: ${state.currentUser.rank ?? "-"}`;
  container.appendChild(rankLine);

  const sessionStart = ensureSessionStart();
  const updatePlayLine = () => {
    const elapsed = Date.now() - sessionStart;
    playLine.textContent = `플레이시간: ${formatPlayTime(elapsed)}`;
  };
  updatePlayLine();
  playTimeTimer = setInterval(updatePlayLine, 1000);

  dom.contentArea.appendChild(container);
}
