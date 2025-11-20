// 서버와 통신하는 함수 모음
import { API_BASE } from "./data.js";

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
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/progress`, {
    method: "POST",
    headers,
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
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/progress?user_id=${encodeURIComponent(userId)}`, { headers });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`진행도 불러오기 실패 ${res.status} ${txt}`);
  }
  return res.json();
}

export async function exchangeEnergy(token, userId, amount, energy) {
  const res = await fetch(`${API_BASE}/change/energy2money`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ user_id: userId, amount, energy }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "교환 실패");
  return data;
}

export async function fetchExchangeRate(token) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/change/rate`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "환율 조회 실패");
  return data;
}

export async function upgradeSupply(token) {
  const res = await fetch(`${API_BASE}/upgrade/supply`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "업그레이드 실패");
  return data;
}

export async function postUpgrade(endpoint, token, energy) {
  const headers = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
  const body = energy != null ? JSON.stringify({ energy }) : "{}";
  const res = await fetch(`${API_BASE}/upgrade/${endpoint}`, {
    method: "POST",
    headers,
    body,
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
    headers: { "Authorization": `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "철거 실패");
  return data;
}

export async function fetchMyRank(token) {
  if (!token) throw new Error("토큰이 없습니다.");
  const res = await fetch(`${API_BASE}/rank`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "랭크 조회 실패");
  return data;
}

export async function fetchRanks(token, { limit = 10, offset = 0 } = {}) {
  if (!token) throw new Error("토큰이 없습니다.");
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  const res = await fetch(`${API_BASE}/ranks?${params.toString()}`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "랭킹 목록 조회 실패");
  return data;
}
