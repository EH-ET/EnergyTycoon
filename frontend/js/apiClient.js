// 서버와 통신하는 함수 모음
import { API_BASE } from "./data.js";

export async function loadGeneratorTypes(state) {
  try {
    const res = await fetch(`${API_BASE}/generator_types`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data.types) return;
    data.types.forEach((t) => {
      state.generatorTypeMap[t.name] = t.id;
      state.generatorTypeInfoMap[t.name] = { id: t.id, cost: t.cost };
      state.generatorTypeIdToName[t.id] = t.name;
    });
  } catch (e) {
    console.warn("generator_types load failed", e);
  }
}

export async function saveProgress(userId, generatorTypeId, x_position, world_position, token) {
  const payload = { user_id: userId, generator_type_id: generatorTypeId, x_position, world_position };
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

export async function fetchMarketRate(token) {
  const res = await fetch(`${API_BASE}/market`, { headers: { "Authorization": `Bearer ${token}` } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function exchangeEnergy(token, userId, amount) {
  const res = await fetch(`${API_BASE}/change/energy2money`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ user_id: userId, amount }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "교환 실패");
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

export async function postUpgrade(endpoint, token) {
  const res = await fetch(`${API_BASE}/upgrade/${endpoint}`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`업그레이드 실패: ${txt}`);
  }
  return res.json();
}
