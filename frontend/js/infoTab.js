import { requireLoginForContent, dom } from "./ui.js";
import { fetchRanks } from "./apiClient.js";
import { updateRankFromServer } from "./rank.js";
import { state, ensureSessionStart, getAuthToken } from "./state.js";
import { formatResourceValue } from "./bigValue.js";

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
  const formattedEnergy = state.currentUser.energy_view ? formatResourceValue(state.currentUser.energy_view) : state.currentUser.energy ?? 0;
  energyLine.textContent = `얻은 총 에너지량: ${formattedEnergy}`;
  container.appendChild(energyLine);

  const moneyLine = document.createElement("p");
  const formattedMoney = state.currentUser.money_view ? formatResourceValue(state.currentUser.money_view) : state.currentUser.money ?? 0;
  moneyLine.textContent = `얻은 총 돈: ${formattedMoney}`;
  container.appendChild(moneyLine);

  const rankLine = document.createElement("p");
  const applyRankLine = (rank, score) => {
    const rankText = typeof rank === "number" ? `${rank}위` : "-";
    const scoreText = typeof score === "number" ? score.toLocaleString("ko-KR") : "-";
    const scoreLabel = scoreText !== "-" ? ` (점수 ${scoreText})` : "";
    rankLine.textContent = `등수: ${rankText}${scoreLabel}`;
  };
  applyRankLine(state.currentUser.rank, state.currentUser.rank_score ?? state.currentUser.money);
  container.appendChild(rankLine);

  updateRankFromServer()
    .then((payload) => {
      if (!payload) return;
      applyRankLine(payload.rank, payload.score);
    })
    .catch((err) => {
      console.warn("rank refresh failed", err);
      if (!state.currentUser.rank) rankLine.textContent = "등수: 조회 실패";
    });

  const leaderboardBox = document.createElement("div");
  leaderboardBox.style.marginTop = "18px";
  leaderboardBox.style.padding = "12px";
  leaderboardBox.style.border = "1px solid #3c3c3c";
  leaderboardBox.style.borderRadius = "8px";
  leaderboardBox.style.background = "#141414";

  const leaderboardTitle = document.createElement("h4");
  leaderboardTitle.textContent = "상위 랭커";
  leaderboardTitle.style.margin = "0 0 8px";
  leaderboardTitle.style.fontSize = "16px";
  leaderboardTitle.style.color = "#f0f0f0";
  leaderboardBox.appendChild(leaderboardTitle);

  const leaderboardStatus = document.createElement("p");
  leaderboardStatus.style.margin = "0 0 8px";
  leaderboardStatus.style.fontSize = "13px";
  leaderboardStatus.style.color = "#bdbdbd";
  leaderboardStatus.textContent = "랭킹을 불러오는 중...";
  leaderboardBox.appendChild(leaderboardStatus);

  const leaderboardList = document.createElement("ol");
  leaderboardList.style.margin = "0";
  leaderboardList.style.paddingLeft = "20px";
  leaderboardList.style.color = "#dedede";
  leaderboardBox.appendChild(leaderboardList);

  const renderLeaderboard = (entries) => {
    leaderboardList.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement("li");
      empty.textContent = "표시할 랭커가 없습니다.";
      leaderboardList.appendChild(empty);
      return;
    }
    entries.forEach((entry) => {
      const li = document.createElement("li");
      const you = state.currentUser.username === entry.username ? " (나)" : "";
      const scoreText = typeof entry.score === "number" ? entry.score.toLocaleString("ko-KR") : "-";
      li.textContent = `${entry.rank}위 ${entry.username} - ${scoreText}점${you}`;
      leaderboardList.appendChild(li);
    });
  };

  const loadLeaderboard = async () => {
    if (!state.currentUser) {
      leaderboardStatus.textContent = "로그인이 필요합니다.";
      return;
    }
    try {
      const data = await fetchRanks(getAuthToken(), { limit: 10, offset: 0 });
      const ranks = data.ranks || [];
      renderLeaderboard(ranks);
      if (ranks.length) {
        leaderboardStatus.textContent = `총 ${data.total}명 중 상위 ${ranks.length}명`;
      } else {
        leaderboardStatus.textContent = "랭킹 데이터가 없습니다.";
      }
    } catch (err) {
      console.warn("leaderboard load failed", err);
      leaderboardStatus.textContent = "랭킹을 불러오지 못했습니다.";
    }
  };

  loadLeaderboard();
  container.appendChild(leaderboardBox);

  const sessionStart = ensureSessionStart();
  const updatePlayLine = () => {
    const elapsed = Date.now() - sessionStart;
    playLine.textContent = `플레이시간: ${formatPlayTime(elapsed)}`;
  };
  updatePlayLine();
  playTimeTimer = setInterval(updatePlayLine, 1000);

  dom.contentArea.appendChild(container);
}
