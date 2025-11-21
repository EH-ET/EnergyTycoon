// 서버와 통신하는 함수 모음
import { API_BASE } from "./data.js";

const CSRF_COOKIE_NAME = "csrf_token";

function readCookie(name) {
  const cookie = document.cookie || "";
  const entries = cookie.split(";").map((c) => c.trim());
  for (const entry of entries) {
    if (!entry) continue;
    const [k, ...rest] = entry.split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

function ensureCsrfToken() {
  let token = readCookie(CSRF_COOKIE_NAME);
  if (!token) {
    token = globalThis.crypto?.randomUUID?.() || `csrf_${Date.now()}`;
    const d = new Date();
    d.setTime(d.getTime() + 7 * 24 * 60 * 60 * 1000);
    document.cookie = `${CSRF_COOKIE_NAME}=${token}; path=/; expires=${d.toUTCString()}; SameSite=Lax`;
  }
  return token;
}

function attachCsrf(headers = {}) {
  const token = ensureCsrfToken();
  return { ...headers, "x-csrf-token": token };
}

export async function loadGeneratorTypes(state) {
  try {
    const res = await fetch(`${API_BASE}/generator_types`);
    if (!res.ok) return;
    const data = await res.json();
    const list = data.generator_types || data.types;
    if (!list) return;
    list.forEach((t) => {
      const typeId = t.id || t.generator_type_id;
      const typeName = t.name;
      if (!typeId || !typeName) return;
      state.generatorTypeMap[typeName] = typeId;
      state.generatorTypeInfoMap[typeName] = { id: typeId, cost: t.cost };
      state.generatorTypeIdToName[typeId] = typeName;
      state.generatorTypesById[typeId] = { name: typeName, cost: t.cost };
    });
  } catch (e) {
    console.warn("generator_types load failed", e);
  }
}

export async function saveProgress(userId, generatorTypeId, x_position, world_position, token, energy) {
  const payload = { user_id: userId, generator_type_id: generatorTypeId, x_position, world_position };
  if (typeof energy === "number") {
    payload.energy = energy;
  }
  const headers = attachCsrf({ "Content-Type": "application/json" });
  const res = await fetch(`${API_BASE}/progress`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`서버응답오류 ${res.status} ${txt}`);
  }
  return res.json();
}

export async function loadProgress(userId, token) {
  const headers = {};
  const res = await fetch(`${API_BASE}/progress?user_id=${encodeURIComponent(userId)}`, {
    headers,
    credentials: "include",
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`진행도 불러오기 실패 ${res.status} ${txt}`);
  }
  return res.json();
}

export async function exchangeEnergy(token, userId, amount, energy) {
  const res = await fetch(`${API_BASE}/change/energy2money`, {
    method: "POST",
    headers: attachCsrf({ "Content-Type": "application/json" }),
    credentials: "include",
    body: JSON.stringify({ user_id: userId, amount, energy }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "교환 실패");
  return data;
}

export async function fetchExchangeRate(token) {
  const headers = {};
  const res = await fetch(`${API_BASE}/change/rate`, { headers, credentials: "include" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "환율 조회 실패");
  return data;
}

export async function upgradeSupply(token) {
  const res = await fetch(`${API_BASE}/upgrade/supply`, {
    method: "POST",
    headers: attachCsrf({}),
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "업그레이드 실패");
  return data;
}

export async function postUpgrade(endpoint, token) {
  const headers = attachCsrf({ "Content-Type": "application/json" });
  const res = await fetch(`${API_BASE}/upgrade/${endpoint}`, {
    method: "POST",
    headers,
    credentials: "include",
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`업그레이드 실패: ${txt}`);
  }
  return res.json();
}

export async function moneyToEnergy() {
  throw new Error("moneyToEnergy is deprecated");
}

export async function demolishGenerator(generatorId, token) {
  const res = await fetch(`${API_BASE}/progress/${encodeURIComponent(generatorId)}`, {
    method: "DELETE",
    headers: attachCsrf({}),
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "철거 실패");
  return data;
}

export async function fetchMyRank(token) {
  const res = await fetch(`${API_BASE}/rank`, {
    headers: {},
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "랭크 조회 실패");
  return data;
}

export async function skipGeneratorBuild(generatorId) {
  const res = await fetch(`${API_BASE}/progress/${encodeURIComponent(generatorId)}/build/skip`, {
    method: "POST",
    headers: attachCsrf({ "Content-Type": "application/json" }),
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "건설 스킵 실패");
  return data;
}

export async function fetchRanks(token, { limit = 10, offset = 0 } = {}) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  const res = await fetch(`${API_BASE}/ranks?${params.toString()}`, {
    headers: {},
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "랭킹 목록 조회 실패");
  return data;
}

export async function autosaveProgress(token, payload = {}) {
  const body = {};
  if (typeof payload.energy === "number") body.energy = payload.energy;
  if (typeof payload.money === "number") body.money = payload.money;
  if (payload.energy_data != null) body.energy_data = payload.energy_data;
  if (payload.energy_high != null) body.energy_high = payload.energy_high;
  if (payload.money_data != null) body.money_data = payload.money_data;
  if (payload.money_high != null) body.money_high = payload.money_high;
  if (!Object.keys(body).length) throw new Error("저장할 데이터가 없습니다.");
  const res = await fetch(`${API_BASE}/progress/autosave`, {
    method: "POST",
    headers: attachCsrf({
      "Content-Type": "application/json",
    }),
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "자동 저장 실패");
  return data;
}
