// 교환소 탭 렌더링
import { requireLoginForContent, dom } from "./ui.js";
import { exchangeEnergy, upgradeSupply, moneyToEnergy } from "./apiClient.js";
import { getAuthToken, state, syncUserState } from "./state.js";

export function renderTradeTab() {
  dom.contentArea.innerHTML = "";
  if (!requireLoginForContent(state.currentUser, "로그인 필요")) return;

  const wrap = document.createElement("div");
  wrap.style.display = "grid";
  wrap.style.gridTemplateColumns = "1fr 1fr";
  wrap.style.gap = "12px";
  wrap.style.padding = "12px";

  const panel = document.createElement("div");
  panel.style.padding = "12px";
  panel.style.border = "1px solid #444";
  panel.style.background = "#0f0f0f";
  panel.style.color = "#eaeaea";
  panel.style.borderRadius = "8px";

  const rateInfo = document.createElement("div");
  rateInfo.style.marginBottom = "8px";
  rateInfo.textContent = "최근 환율: 거래 시 표시됩니다.";

  const sellInput = document.createElement("input");
  sellInput.type = "number";
  sellInput.min = "1";
  sellInput.placeholder = "팔 에너지 (기본 1)";
  sellInput.value = "1";
  sellInput.style.width = "100%";
  sellInput.style.marginBottom = "8px";

  const buyInput = document.createElement("input");
  buyInput.type = "number";
  buyInput.min = "1";
  buyInput.placeholder = "살 에너지 (쓸 돈)";
  buyInput.value = "1";
  buyInput.style.width = "100%";
  buyInput.style.marginBottom = "8px";

  const sellBtn = document.createElement("button");
  sellBtn.textContent = "에너지 → 돈 교환";
  sellBtn.style.width = "100%";
  sellBtn.style.padding = "10px";
  sellBtn.style.cursor = "pointer";

  const supplyBtn = document.createElement("button");
  supplyBtn.textContent = "공급 증가 업그레이드";
  supplyBtn.style.width = "100%";
  supplyBtn.style.padding = "10px";
  supplyBtn.style.cursor = "pointer";
  supplyBtn.style.marginTop = "8px";

  const msg = document.createElement("div");
  msg.style.marginTop = "8px";
  msg.style.fontSize = "13px";
  msg.style.color = "#a8ff8e";

  panel.appendChild(rateInfo);
  panel.appendChild(sellInput);
  panel.appendChild(sellBtn);
  panel.appendChild(buyInput);
  panel.appendChild(supplyBtn);
  panel.appendChild(msg);

  const chartBox = document.createElement("div");
  chartBox.style.border = "1px solid #444";
  chartBox.style.borderRadius = "8px";
  chartBox.style.padding = "8px";
  chartBox.style.background = "#0a0a0a";
  chartBox.innerHTML = `
    <svg width="100%" height="240" viewBox="0 0 240 240" style="background:#111;">
      <line x1="30" y1="10" x2="30" y2="210" stroke="#666" stroke-width="1"/>
      <line x1="30" y1="210" x2="230" y2="210" stroke="#666" stroke-width="1"/>
      <text x="10" y="20" fill="#888" font-size="12">가격</text>
      <text x="200" y="230" fill="#888" font-size="12">수량</text>
      <polyline points="40,40 220,200" stroke="#4caf50" fill="none" stroke-width="2"></polyline>
      <polyline points="40,200 200,40" stroke="#f44336" fill="none" stroke-width="2"></polyline>
      <text x="60" y="55" fill="#4caf50" font-size="12">수요</text>
      <text x="140" y="60" fill="#f44336" font-size="12">공급</text>
    </svg>
  `;

  wrap.appendChild(panel);
  wrap.appendChild(chartBox);
  dom.contentArea.appendChild(wrap);

  sellBtn.onclick = async () => {
    const amount = Number(sellInput.value) || 1;
    if (amount <= 0) return alert("1 이상 입력하세요");
    const token = getAuthToken();
    if (!token) {
      alert("로그인이 필요합니다.");
      return;
    }
    try {
      const beforeMoney = state.currentUser.money;
      const data = await exchangeEnergy(token, state.currentUser.user_id, amount);
      state.currentUser.energy = data.energy;
      state.currentUser.money = data.money;
      syncUserState(state.currentUser);
      const gained = data.money - beforeMoney;
      const rateText = data.rate ? ` (rate ${data.rate.toFixed(2)})` : "";
      rateInfo.textContent = data.rate ? `최근 환율: 1 에너지 → ${data.rate.toFixed(2)} 돈` : rateInfo.textContent;
      msg.textContent = `성공: ${amount} 에너지 → ${gained} 돈${rateText}`;
    } catch (e) {
      alert(e.message || e);
    }
  };

  buyBtn.onclick = async () => {
    const amount = Number(buyInput.value) || 1;
    if (amount <= 0) return alert("1 이상 입력하세요");
    const token = getAuthToken();
    if (!token) {
      alert("로그인이 필요합니다.");
      return;
    }
    if (state.currentUser.money < amount) {
      alert("돈이 부족합니다.");
      return;
    }
    try {
      const data = await moneyToEnergy(token, state.currentUser.user_id, amount);
      state.currentUser.energy = data.energy;
      state.currentUser.money = data.money;
      syncUserState(state.currentUser);
      msg.textContent = `성공: 돈 ${amount} → 에너지 ${amount}`;
      rateInfo.textContent = data.rate ? `최근 환율: 1 에너지 → ${data.rate.toFixed(2)} 돈` : rateInfo.textContent;
    } catch (e) {
      alert(e.message || e);
    }
  };

  supplyBtn.onclick = async () => {
    const token = getAuthToken();
    if (!token) {
      alert("로그인이 필요합니다.");
      return;
    }
    try {
      const data = await upgradeSupply(token);
      syncUserState(data);
      msg.textContent = `공급 증가 레벨이 ${data.supply_bonus}가 되었습니다.`;
    } catch (e) {
      alert(e.message || e);
    }
  };
}
