// 업그레이드 탭 렌더링 + 환생 업그레이드/일괄 기능
import { upgrades, rebirthUpgrades } from "./data.js";
import { requireLoginForContent, dom } from "./ui.js";
import {
  state,
  syncUserState,
  beginTrapGuardGracePeriod,
  touchTrapMarker,
  compareMoneyWith,
} from "./state.js";
import { postUpgrade, fetchRebirthInfo, performRebirth } from "./apiClient.js";
import { fromPlainValue, formatResourceValue, toPlainValue, valueFromServer } from "./bigValue.js";

const MAX_REBIRTH_BULK_INPUT = 99;

function getRawLevel(user, upgrade) {
  return user ? Number(user?.[upgrade.field]) || 0 : 0;
}

function getDisplayLevel(user, upgrade) {
  const displayOffset = upgrade.levelDisplayOffset ?? (upgrade.currency === "money" ? 1 : 0);
  return getRawLevel(user, upgrade) + displayOffset;
}

function getUpgradeCostForAmount(user, upgrade, amount = 1) {
  const currentLevel = getRawLevel(user, upgrade);
  const costOffset = upgrade.costExponentOffset ?? 1;
  const baseCostPlain =
    upgrade.baseCost_plain ?? upgrade.baseCost ?? toPlainValue(fromPlainValue(upgrade.baseCost_plain || 0));
  let total = 0;
  for (let i = 0; i < amount; i += 1) {
    const level = currentLevel + i + costOffset;
    total += Math.floor(baseCostPlain * Math.pow(upgrade.priceGrowth, level));
  }
  return total;
}

function formatCost(cost, currency) {
  if (currency === "money") {
    return `${formatResourceValue(fromPlainValue(cost))} 돈`;
  }
  return `${Math.max(0, Number(cost) || 0).toLocaleString("ko-KR")} 환생`;
}

function maxAmountForUpgrade(upgrade) {
  if (upgrade.currency === "money") {
    return 1 + (state.currentUser?.upgrade_batch_upgrade || 0);
  }
  const availableRebirths = state.currentUser?.rebirth_count ?? 0;
  let maxAffordable = 0;
  for (let i = 1; i <= MAX_REBIRTH_BULK_INPUT; i += 1) {
    const cost = getUpgradeCostForAmount(state.currentUser, upgrade, i);
    if (cost > availableRebirths) break;
    maxAffordable = i;
  }
  return Math.max(1, maxAffordable || 1);
}

function buildUpgradeCard(upgrade) {
  const item = document.createElement("div");
  item.style.border = "1px solid #ccc";
  item.style.padding = "10px";
  item.style.textAlign = "center";
  item.style.background = "#f9f9f9";
  item.style.borderRadius = "5px";
  item.style.minWidth = "220px";
  item.style.flex = "0 0 240px";

  const title = document.createElement("h3");
  title.textContent = upgrade.이름;
  title.style.marginTop = "0";

  const desc = document.createElement("p");
  desc.textContent = upgrade.설명;
  desc.style.fontSize = "14px";

  const level = document.createElement("p");
  level.textContent = `현재 레벨: ${getDisplayLevel(state.currentUser, upgrade)}`;

  const cost = document.createElement("p");
  cost.style.fontWeight = "bold";

  const maxAmount = maxAmountForUpgrade(upgrade);
  const amountWrap = document.createElement("div");
  amountWrap.style.display = "flex";
  amountWrap.style.justifyContent = "center";
  amountWrap.style.gap = "6px";
  amountWrap.style.alignItems = "center";

  const amountInput = document.createElement("input");
  amountInput.type = "number";
  amountInput.min = "1";
  amountInput.step = "1";
  amountInput.value = "1";
  amountInput.style.width = "70px";
  amountInput.style.padding = "4px";
  amountInput.style.display = maxAmount > 1 ? "block" : "none";
  if (maxAmount > 1) {
    amountInput.max = String(maxAmount);
  }

  const amountLabel = document.createElement("span");
  amountLabel.textContent = maxAmount > 1 ? `x${maxAmount}까지` : "";
  amountLabel.style.fontSize = "12px";
  amountLabel.style.color = "#666";

  amountWrap.append(amountInput, amountLabel);

  const recomputeCost = () => {
    const desired = Math.max(1, Math.min(maxAmount, Math.floor(Number(amountInput.value) || 1)));
    amountInput.value = String(desired);
    const totalCost = getUpgradeCostForAmount(state.currentUser, upgrade, desired);
    cost.textContent = `비용: ${formatCost(totalCost, upgrade.currency || "money")}`;
    return { desired, totalCost };
  };
  recomputeCost();
  amountInput.addEventListener("input", recomputeCost);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "업그레이드";
  btn.style.padding = "8px 12px";
  btn.style.cursor = "pointer";
  btn.onclick = async () => {
    const desired = Math.max(1, Math.min(maxAmount, Math.floor(Number(amountInput.value) || 1)));
    const totalCost = getUpgradeCostForAmount(state.currentUser, upgrade, desired);
    if ((upgrade.currency || "money") === "money") {
      if (compareMoneyWith(totalCost) < 0) {
        alert("돈이 부족합니다.");
        return;
      }
    } else if ((state.currentUser?.rebirth_count ?? 0) < totalCost) {
      alert("환생이 부족합니다.");
      return;
    }
    try {
      beginTrapGuardGracePeriod();
      const newUser = await postUpgrade(upgrade.endpoint, desired);
      syncUserState(newUser);
      touchTrapMarker();
      await renderUpgradeTab();
    } catch (e) {
      alert(e.message);
    }
  };

  item.appendChild(title);
  item.appendChild(desc);
  item.appendChild(cost);
  if (maxAmount > 1) item.appendChild(amountWrap);
  item.appendChild(level);
  item.appendChild(btn);
  return item;
}

function renderUpgradeSection(titleText, upgradeList) {
  const section = document.createElement("section");
  const heading = document.createElement("h3");
  heading.textContent = titleText;
  heading.style.margin = "0 0 8px";
  section.appendChild(heading);

  const grid = document.createElement("div");
  grid.className = "upgrade-grid";
  grid.style.display = "flex";
  grid.style.flexWrap = "nowrap";
  grid.style.gap = "10px";
  grid.style.padding = "10px";
  grid.style.overflowX = "auto";
  grid.style.overflowY = "hidden";
  grid.style.scrollBehavior = "smooth";
  grid.style.alignItems = "stretch";

  upgradeList.forEach((upgrade) => grid.appendChild(buildUpgradeCard(upgrade)));
  section.appendChild(grid);
  return section;
}

function renderRebirthSummary(rebirthInfo) {
  const user = state.currentUser;
  const bar = document.createElement("div");
  bar.style.display = "grid";
  bar.style.gridTemplateColumns = "repeat(auto-fit, minmax(140px, 1fr))";
  bar.style.gap = "10px";
  bar.style.padding = "10px";
  bar.style.background = "#0f172a";
  bar.style.color = "#e2e8f0";
  bar.style.borderRadius = "8px";

  const maxChain = rebirthInfo?.max_chain ?? Math.max(1, 1 + (user?.rebirth_chain_upgrade || 0));
  const maxBatch = 1 + (user?.upgrade_batch_upgrade || 0);
  const startMoneyValue = rebirthInfo
    ? valueFromServer(rebirthInfo.start_money_data, rebirthInfo.start_money_high)
    : fromPlainValue(10 * (10 ** (user?.rebirth_start_money_upgrade || 0)));

  const chips = [
    { label: "환생 횟수", value: `${user?.rebirth_count ?? 0}회` },
    { label: "연속 환생 한도", value: `${maxChain}회` },
    { label: "업그레이드 일괄 구매", value: `${maxBatch}단계` },
    { label: "환생 시작 자금", value: formatResourceValue(startMoneyValue) },
  ];

  chips.forEach((chip) => {
    const box = document.createElement("div");
    box.style.background = "#1e293b";
    box.style.padding = "8px";
    box.style.borderRadius = "6px";
    box.style.border = "1px solid #334155";
    const label = document.createElement("div");
    label.textContent = chip.label;
    label.style.fontSize = "12px";
    label.style.color = "#94a3b8";
    const value = document.createElement("div");
    value.textContent = chip.value;
    value.style.fontSize = "14px";
    value.style.fontWeight = "bold";
    box.append(label, value);
    bar.appendChild(box);
  });

  return bar;
}

function renderRebirthSection(rebirthInfo) {
  const user = state.currentUser;
  const section = document.createElement("section");
  section.style.border = "1px solid #334155";
  section.style.background = "#0b1220";
  section.style.color = "#e2e8f0";
  section.style.borderRadius = "8px";
  section.style.padding = "12px";
  section.style.display = "flex";
  section.style.flexDirection = "column";
  section.style.gap = "8px";

  const title = document.createElement("h3");
  title.textContent = "환생";
  title.style.margin = "0";
  section.appendChild(title);

  const desc = document.createElement("p");
  desc.textContent = "환생하면 진행도가 초기화되고 배수가 증가하며 환생 포인트를 획득합니다.";
  desc.style.margin = "0";
  desc.style.fontSize = "13px";
  desc.style.color = "#cbd5e1";
  section.appendChild(desc);

  const nextCostValue = rebirthInfo
    ? valueFromServer(rebirthInfo.next_cost_data, rebirthInfo.next_cost_high)
    : null;
  const chainCostValue = rebirthInfo
    ? valueFromServer(rebirthInfo.chain_cost_data, rebirthInfo.chain_cost_high)
    : nextCostValue;
  const maxChain = rebirthInfo?.max_chain ?? Math.max(1, 1 + (user?.rebirth_chain_upgrade || 0));

  const costLine = document.createElement("div");
  costLine.textContent = `다음 환생 비용: ${nextCostValue ? formatResourceValue(nextCostValue) : "-"}`;
  costLine.style.fontSize = "13px";
  section.appendChild(costLine);

  const bulkCostLine = document.createElement("div");
  bulkCostLine.textContent = `전체환생(${maxChain}회) 비용: ${
    chainCostValue ? formatResourceValue(chainCostValue) : "-"
  }`;
  bulkCostLine.style.fontSize = "13px";
  section.appendChild(bulkCostLine);

  const btnRow = document.createElement("div");
  btnRow.style.display = "flex";
  btnRow.style.gap = "8px";
  btnRow.style.flexWrap = "wrap";

  const makeButton = (label, count, disabled = false) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.style.padding = "10px 14px";
    btn.style.background = "#2563eb";
    btn.style.color = "#fff";
    btn.style.border = "none";
    btn.style.borderRadius = "6px";
    btn.style.cursor = disabled ? "not-allowed" : "pointer";
    btn.disabled = disabled;
    btn.onclick = async () => {
      try {
        beginTrapGuardGracePeriod();
        const res = await performRebirth(count);
        if (res?.user) syncUserState(res.user);
        touchTrapMarker();
        alert(res?.message || "환생 완료");
        await renderUpgradeTab();
      } catch (e) {
        alert(e.message);
      }
    };
    return btn;
  };

  btnRow.appendChild(makeButton("환생하기", 1));
  btnRow.appendChild(makeButton(`전체환생하기(${maxChain}회)`, maxChain, maxChain <= 1));
  section.appendChild(btnRow);

  return section;
}

async function loadRebirthInfoSafely() {
  try {
    const info = await fetchRebirthInfo();
    if (info?.user) syncUserState(info.user);
    return info;
  } catch (err) {
    console.warn("rebirth info load failed", err);
    return null;
  }
}

export async function renderUpgradeTab() {
  if (!requireLoginForContent(state.currentUser, "로그인 필요")) return;
  dom.contentArea.replaceChildren();
  dom.contentArea.style.overflowY = "auto";

  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.gap = "16px";
  wrapper.style.padding = "10px";
  dom.contentArea.appendChild(wrapper);

  const rebirthInfo = await loadRebirthInfoSafely();

  wrapper.appendChild(renderRebirthSummary(rebirthInfo));
  wrapper.appendChild(renderRebirthSection(rebirthInfo));
  wrapper.appendChild(renderUpgradeSection("돈 업그레이드", upgrades));
  wrapper.appendChild(renderUpgradeSection("환생 업그레이드", rebirthUpgrades));
}
