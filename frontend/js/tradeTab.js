// 교환소 탭 렌더링
import { requireLoginForContent, dom, updateExchangeRateUI } from "./ui.js";
import { exchangeEnergy, fetchExchangeRate } from "./apiClient.js";
import { state, syncUserState, getAuthToken } from "./state.js";

export function renderTradeTab() {
  if (!requireLoginForContent(state.currentUser, "로그인 필요")) return;
  dom.contentArea.replaceChildren();

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

  const sellBtn = document.createElement("button");
  sellBtn.type = "button";
  sellBtn.textContent = "에너지 → 돈 교환";
  sellBtn.style.width = "100%";
  sellBtn.style.padding = "10px";
  sellBtn.style.cursor = "pointer";

  const msg = document.createElement("div");
  msg.style.marginTop = "8px";
  msg.style.fontSize = "13px";
  msg.style.color = "#a8ff8e";

  const previewBox = document.createElement("div");
  previewBox.style.marginTop = "8px";
  previewBox.style.fontSize = "13px";
  previewBox.style.color = "#ccc";
  const rateLineEl = document.createElement("div");
  rateLineEl.className = "rate-line";
  rateLineEl.textContent = "1 에너지당 - 원";
  const amountLineEl = document.createElement("div");
  amountLineEl.className = "amount-line";
  amountLineEl.textContent = "0 에너지 → 0 원 예상";
  previewBox.append(rateLineEl, amountLineEl);

  panel.appendChild(rateInfo);
  panel.appendChild(sellInput);
  panel.appendChild(sellBtn);
  panel.appendChild(msg);
  panel.appendChild(previewBox);

  const chartBox = document.createElement("div");
  chartBox.style.border = "1px solid #444";
  chartBox.style.borderRadius = "8px";
  chartBox.style.padding = "8px";
  chartBox.style.background = "#0a0a0a";
  const svgNS = "http://www.w3.org/2000/svg";
  const createSvgChild = (tag, attrs) => {
    const el = document.createElementNS(svgNS, tag);
    Object.entries(attrs).forEach(([key, value]) => {
      el.setAttribute(key, value);
    });
    return el;
  };
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "240");
  svg.setAttribute("viewBox", "0 0 240 240");
  svg.style.background = "#111";
  svg.appendChild(createSvgChild("line", { x1: "30", y1: "10", x2: "30", y2: "210", stroke: "#666", "stroke-width": "1" }));
  svg.appendChild(createSvgChild("line", { x1: "30", y1: "210", x2: "230", y2: "210", stroke: "#666", "stroke-width": "1" }));
  const priceLabel = createSvgChild("text", { x: "10", y: "20", fill: "#888", "font-size": "12" });
  priceLabel.textContent = "가격";
  svg.appendChild(priceLabel);
  const qtyLabel = createSvgChild("text", { x: "200", y: "230", fill: "#888", "font-size": "12" });
  qtyLabel.textContent = "수량";
  svg.appendChild(qtyLabel);
  svg.appendChild(createSvgChild("polyline", { points: "40,40 220,200", stroke: "#4caf50", fill: "none", "stroke-width": "2" }));
  svg.appendChild(createSvgChild("polyline", { points: "40,200 200,40", stroke: "#f44336", fill: "none", "stroke-width": "2" }));
  const demandLabel = createSvgChild("text", { x: "60", y: "55", fill: "#4caf50", "font-size": "12" });
  demandLabel.textContent = "수요";
  svg.appendChild(demandLabel);
  const supplyLabel = createSvgChild("text", { x: "140", y: "60", fill: "#f44336", "font-size": "12" });
  supplyLabel.textContent = "공급";
  svg.appendChild(supplyLabel);
  chartBox.appendChild(svg);

  wrap.appendChild(panel);
  wrap.appendChild(chartBox);
  dom.contentArea.appendChild(wrap);

  let inFlight = false;
  let lastRate = null;

  const setBusy = (busy) => {
    inFlight = busy;
    sellBtn.disabled = busy;
  };

  const updateRateMessage = (rate) => {
    if (typeof rate === "number") {
      rateInfo.textContent = `최근 환율: 1 에너지 → ${rate.toFixed(2)} 돈`;
    }
  };

  const updatePreview = () => {
    const rateLine = previewBox.querySelector(".rate-line");
    const amountLine = previewBox.querySelector(".amount-line");
    if (!rateLine || !amountLine) return;
    if (typeof lastRate === "number") {
      rateLine.textContent = `1 에너지당 ${lastRate.toFixed(2)} 원`;
    } else {
      rateLine.textContent = "환율을 불러오는 중...";
    }
    const amount = Number(sellInput.value) || 0;
    const expected =
      typeof lastRate === "number" ? Math.max(1, Math.floor(amount * lastRate)) : "-";
    amountLine.textContent = `${amount} 에너지 → ${expected} 원 예상`;
  };

  sellInput.addEventListener("input", updatePreview);
  sellInput.addEventListener("change", updatePreview);

  const loadRate = async () => {
    if (!state.currentUser) {
      alert("로그인이 필요합니다.");
      return;
    }
    try {
      const data = await fetchExchangeRate(getAuthToken());
      lastRate = data.rate;
      state.exchangeRate = lastRate;
      updateExchangeRateUI(lastRate);
      updatePreview();
      updateRateMessage(lastRate);
    } catch (e) {
      console.warn("환율 조회 실패", e);
    }
  };

  sellBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const amount = Number(sellInput.value) || 1;
    if (amount <= 0) return alert("1 이상 입력하세요");
    if (inFlight) return;
    if (!state.currentUser) {
      alert("로그인이 필요합니다.");
      return;
    }
    try {
      setBusy(true);
      const beforeMoney = state.currentUser.money;
      const data = await exchangeEnergy(
        getAuthToken(),
        state.currentUser.user_id,
        amount,
        state.currentUser.energy,
      );
      const nextUser = data.user || { ...state.currentUser, energy: data.energy, money: data.money };
      state.currentUser.energy = nextUser.energy;
      state.currentUser.money = nextUser.money;
      syncUserState(nextUser);
      const gained = nextUser.money - beforeMoney;
      lastRate = data.rate ?? lastRate;
      state.exchangeRate = lastRate;
      updateExchangeRateUI(lastRate);
      updateRateMessage(lastRate);
      updatePreview();
      const rateText = lastRate ? ` (rate ${lastRate.toFixed(2)})` : "";
      msg.textContent = `성공: ${amount} 에너지 → ${gained} 돈${rateText}`;
    } catch (e) {
      alert(e.message || e);
    } finally {
      setBusy(false);
    }
  });

  loadRate();
}
