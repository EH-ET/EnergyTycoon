// 업그레이드 탭 렌더링
import { upgrades } from "./data.js";
import { requireLoginForContent, dom } from "./ui.js";
import {
  state,
  syncUserState,
  getAuthToken,
  beginTrapGuardGracePeriod,
  touchTrapMarker,
  compareMoneyWith,
} from "./state.js";
import { postUpgrade } from "./apiClient.js";
import { fromPlainValue, formatResourceValue, toPlainValue } from "./bigValue.js";

function getUpgradeLevel(user, upgrade) {
  const base = user ? Number(user[upgrade.field]) || 0 : 0;
  return base + 1;
}

function getUpgradeCost(user, upgrade) {
  const level = getUpgradeLevel(user, upgrade);
  const baseCostPlain = upgrade.baseCost ?? toPlainValue(fromPlainValue(upgrade.baseCost_plain || 0));
  return Math.round(baseCostPlain * Math.pow(upgrade.priceGrowth, level));
}

export function renderUpgradeTab() {
  if (!requireLoginForContent(state.currentUser, "로그인 필요")) return;
  dom.contentArea.replaceChildren();
  const grid = document.createElement("div");
  grid.className = "upgrade-grid";
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(auto-fit, minmax(200px, 1fr))";
  grid.style.gap = "10px";
  grid.style.padding = "10px";

  upgrades.forEach((upgrade) => {
    const levelValue = getUpgradeLevel(state.currentUser, upgrade);
    const costValue = getUpgradeCost(state.currentUser, upgrade);
    const item = document.createElement("div");
    item.style.border = "1px solid #ccc";
    item.style.padding = "10px";
    item.style.textAlign = "center";
    item.style.background = "#f9f9f9";
    item.style.borderRadius = "5px";

    const title = document.createElement("h3");
    title.textContent = upgrade.이름;
    title.style.marginTop = "0";

    const desc = document.createElement("p");
    desc.textContent = upgrade.설명;
    desc.style.fontSize = "14px";

    const cost = document.createElement("p");
    const costValueDisplay = formatResourceValue(fromPlainValue(costValue));
    cost.textContent = `비용: ${costValueDisplay} 돈`;
    cost.style.fontWeight = "bold";

    const level = document.createElement("p");
    level.textContent = `현재 레벨: ${levelValue}`;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "업그레이드";
    btn.style.padding = "8px 12px";
    btn.style.cursor = "pointer";
    btn.onclick = async () => {
      if (compareMoneyWith(costValue) < 0) {
        alert("돈이 부족합니다.");
        return;
      }
      try {
        beginTrapGuardGracePeriod();
        const newUser = await postUpgrade(upgrade.endpoint, getAuthToken());
        syncUserState(newUser);
        touchTrapMarker();
        renderUpgradeTab();
      } catch (e) {
        alert(e.message);
      }
    };

    item.appendChild(title);
    item.appendChild(desc);
    item.appendChild(cost);
    item.appendChild(level);
    item.appendChild(btn);
    grid.appendChild(item);
  });
  dom.contentArea.appendChild(grid);
}
