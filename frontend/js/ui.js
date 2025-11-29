// DOM 참조와 화면 갱신 유틸
import { state } from "./state.js";
import { formatResourceValue } from "./bigValue.js";

export const dom = {
  generatorBtn: document.querySelector(".generator-btn"),
  tradeBtn: document.querySelector(".trade-btn"),
  upgradeBtn: document.querySelector(".upgrade-btn"),
  infoBtn: document.querySelector(".info-btn"),
  contentArea: document.querySelector(".content-area"),
  mainArea: document.querySelector(".main"),
  username: document.querySelector(".username"),
  generatorCount: document.querySelector(".stat-value.generator-count"),
  moneyValue: document.querySelector(".stat-value.money-value"),
  energyValue: document.querySelector(".stat-value.energy-value"),
  profileName: document.querySelector(".profile-modal .modal-line.profile-name"),
  profileRank: document.querySelector(".profile-modal .modal-line.profile-rank"),
  profileRoot: document.querySelector(".profile"),
  profileTrigger: document.querySelector(".profile-trigger"),
  moneyRate: document.querySelector(".money-rate"),
  energyRate: document.querySelector(".energy-rate"),
};

export function updateUserUI(user, placedCountOverride) {
  if (!user) return;
  if (dom.username) dom.username.textContent = user.username;
  if (dom.moneyValue) dom.moneyValue.textContent = user.money_view ? formatResourceValue(user.money_view) : user.money;
  if (dom.energyValue) dom.energyValue.textContent = user.energy_view ? formatResourceValue(user.energy_view) : user.energy;
  if (dom.profileName) {
    const strong = document.createElement("strong");
    strong.textContent = "이름:";
    dom.profileName.replaceChildren(strong, document.createTextNode(` ${user.username}`));
  }
  if (dom.profileRank) {
    const strong = document.createElement("strong");
    strong.textContent = "랭킹:";
    const rankText = typeof user.rank === "number" ? `${user.rank}위` : "-";
    dom.profileRank.replaceChildren(strong, document.createTextNode(` ${rankText}`));
  }
  const count = placedCountOverride ?? state.placedGenerators.length ?? 0;
  const max = 10 + (user.max_generators_bonus || 0);
  if (dom.generatorCount) dom.generatorCount.textContent = `${count}/${max}`;
}

export function updateExchangeRateUI(rate) {
  if (!dom.moneyRate) return;
  if (typeof rate === "number" && Number.isFinite(rate)) {
    dom.moneyRate.textContent = rate.toFixed(2);
  } else {
    dom.moneyRate.textContent = "-";
  }
}

export function updateEnergyRateUI(rate) {
  if (!dom.energyRate) return;
  if (typeof rate === "number" && Number.isFinite(rate)) {
    dom.energyRate.textContent = rate.toFixed(2);
  } else {
    dom.energyRate.textContent = "0";
  }
}

export function requireLoginForContent(user, message) {
  if (user) return true;
  if (dom.contentArea) {
    dom.contentArea.replaceChildren();
    const warning = document.createElement("div");
    warning.style.padding = "12px";
    warning.style.color = "#f00";
    warning.textContent = message || "로그인 필요";
    dom.contentArea.appendChild(warning);
  }
  return false;
}
