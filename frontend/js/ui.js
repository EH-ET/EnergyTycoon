// DOM 참조와 화면 갱신 유틸
import { state } from "./state.js";

export const dom = {
  generatorBtn: document.querySelector(".generator-btn"),
  tradeBtn: document.querySelector(".trade-btn"),
  upgradeBtn: document.querySelector(".upgrade-btn"),
  infoBtn: document.querySelector(".info-btn"),
  contentArea: document.querySelector(".content-area"),
  mainArea: document.querySelector(".main"),
  username: document.querySelector(".username"),
  moneyBar: document.querySelector(".money.text-bar.long p"),
  energyBar: document.querySelector(".energy.text-bar.long p"),
  generatorBar: document.querySelector(".generator.text-bar.generator-text-bar p"),
  profileName: document.querySelector(".profile-modal .modal-line"),
};

export function updateUserUI(user, placedCountOverride) {
  if (!user) return;
  dom.username.textContent = user.username;
  dom.moneyBar.textContent = user.money;
  dom.energyBar.textContent = user.energy;
  dom.profileName.innerHTML = `<strong>이름:</strong> ${user.username}`;
  const count = placedCountOverride ?? state.placedGenerators.length ?? 0;
  const max = 10 + (user.max_generators_bonus || 0) * 5;
  dom.generatorBar.textContent = `${count}/${max}`;
}

export function requireLoginForContent(user, message) {
  if (user) return true;
  dom.contentArea.innerHTML = `<div style='padding:12px;color:#f00;'>${message || "로그인 필요"}</div>`;
  return false;
}
