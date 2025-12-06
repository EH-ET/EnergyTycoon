// 서버와 통신하는 함수 모음
import { API_BASE, generators } from "./data.js";
import { valueFromServer, toPlainValue, fromPlainValue } from "./bigValue.js";

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_STORAGE_KEY = "et_csrf";

// Track if we're currently refreshing to prevent multiple refresh attempts
let isRefreshing = false;
let refreshPromise = null;

// Global loading callback (set by App.jsx)
let globalLoadingCallback = null;

// Store original fetch before we override it
const originalFetch = window.fetch;

export function setGlobalLoadingCallback(callback) {
  globalLoadingCallback = callback;
}

/**
 * Wrapper for fetch that handles token refresh and server wake-up
 * @param {string} url - The URL to fetch
 * @param {object} options - Fetch options
 * @param {boolean} skipRetry - Internal flag to prevent infinite retry
 * @returns {Promise<Response>}
 */
async function fetchWithTokenRefresh(url, options = {}, skipRetry = false) {
  // Start a timer to show loading if request takes too long (server wake-up)
  const loadingTimer = setTimeout(() => {
    if (globalLoadingCallback) {
      globalLoadingCallback(true, '서버 준비 중...');
    }
  }, 2000); // Show loading after 2 seconds

  try {
    // Use originalFetch to avoid infinite recursion
    const response = await originalFetch(url, options);

    // Clear loading timer
    clearTimeout(loadingTimer);
    if (globalLoadingCallback) {
      globalLoadingCallback(false, '');
    }

    // Handle 401 Unauthorized - token expired
    if (response.status === 401 && !skipRetry) {
      console.log('Token expired, attempting refresh...');

      // Show loading during token refresh
      if (globalLoadingCallback) {
        globalLoadingCallback(true, '토큰 갱신 중...');
      }

      // If already refreshing, wait for that to complete
      if (isRefreshing && refreshPromise) {
        const success = await refreshPromise;
        if (globalLoadingCallback) {
          globalLoadingCallback(false, '');
        }
        if (success) {
          // Retry original request
          return fetchWithTokenRefresh(url, options, true);
        } else {
          throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.');
        }
      }

      // Start refresh
      isRefreshing = true;
      refreshPromise = refreshAccessToken();

      try {
        const success = await refreshPromise;

        if (globalLoadingCallback) {
          globalLoadingCallback(false, '');
        }

        if (success) {
          console.log('Token refreshed successfully, retrying request...');
          // Retry original request with skipRetry=true to prevent infinite loop
          return fetchWithTokenRefresh(url, options, true);
        } else {
          throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.');
        }
      } finally {
        isRefreshing = false;
        refreshPromise = null;
      }
    }

    return response;
  } catch (error) {
    // Clear loading on error
    clearTimeout(loadingTimer);
    if (globalLoadingCallback) {
      globalLoadingCallback(false, '');
    }
    throw error;
  }
}

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
  // 우선 서버에서 내려준 토큰을 로컬 스토리지에서 찾음
  let token = null;
  try {
    token = localStorage.getItem(CSRF_STORAGE_KEY);
  } catch (e) {
    token = null;
  }
  // 없으면 현재 도메인 쿠키에서 조회
  if (!token) {
    token = readCookie(CSRF_COOKIE_NAME);
  }
  // 그래도 없으면 임시 생성 (백엔드 쿠키와 맞지 않으면 이후 요청에서 실패)
  if (!token) {
    token = globalThis.crypto?.randomUUID?.() || `csrf_${Date.now()}`;
    const d = new Date();
    d.setTime(d.getTime() + 7 * 24 * 60 * 60 * 1000);
    document.cookie = `${CSRF_COOKIE_NAME}=${token}; path=/; expires=${d.toUTCString()}; SameSite=Lax`;
  }
  // 캐시
  try {
    localStorage.setItem(CSRF_STORAGE_KEY, token);
  } catch (e) {
    // ignore
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
    list.forEach((t, idxFromServer) => {
      const typeId = t.id || t.generator_type_id;
      if (!typeId) return;
      const nameFromServer = t.name;
      const indexFromServer = Number.isInteger(t.index) ? t.index : (Number.isInteger(t.order) ? t.order : null);
      const matchedIndex = generators.findIndex((g) => g?.이름 === nameFromServer);
      const fallbackName = indexFromServer != null && indexFromServer >= 0 ? generators[indexFromServer]?.이름 : generators[idxFromServer]?.이름;
      const typeName = nameFromServer || fallbackName || String(idxFromServer);
      const resolvedIndex = (indexFromServer != null && indexFromServer >= 0 && indexFromServer < generators.length)
        ? indexFromServer
        : (matchedIndex >= 0 ? matchedIndex : idxFromServer);
      const costValue = valueFromServer(t.cost_data, t.cost_high, t.cost ?? generators[resolvedIndex]?.설치비용);
      const cost = toPlainValue(costValue);
      // 기본 이름 매핑
      state.generatorTypeMap[typeName] = typeId;
      state.generatorTypeInfoMap[typeName] = { id: typeId, cost };
      // 프론트엔드 정의 이름과 서버 이름이 달라도 인덱스/이름을 기준으로 매핑
      if (fallbackName && fallbackName !== typeName) {
        state.generatorTypeMap[fallbackName] = typeId;
        state.generatorTypeInfoMap[fallbackName] = { id: typeId, cost };
      }
      state.generatorTypeIdToName[typeId] = fallbackName || typeName;
      state.generatorTypesById[typeId] = { 
        name: fallbackName || typeName, 
        cost, 
        index: resolvedIndex,
        install_seconds: t.install_seconds || 0
      };
    });
  } catch (e) {
    // Silent fail
  }
}

export async function saveProgress(userId, generatorTypeId, x_position, world_position, token, energy) {
  const payload = { user_id: userId, generator_type_id: generatorTypeId, x_position, world_position };
  const headers = attachCsrf({ "Content-Type": "application/json" });
  if (token) headers.authorization = `Bearer ${token}`;
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
  const headers = { authorization: token ? `Bearer ${token}` : undefined };
  if (!headers.authorization) delete headers.authorization;
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
  const headers = attachCsrf({ "Content-Type": "application/json" });
  if (token) headers.authorization = `Bearer ${token}`;
  
  // Convert plain amount to BigValue for backend
  const amountBV = fromPlainValue(amount);
  
  const res = await fetch(`${API_BASE}/change/energy2money`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify({ 
      user_id: userId, 
      amount_data: amountBV.data,
      amount_high: amountBV.high
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    const errorMsg = typeof data.detail === 'string' ? data.detail : '교환 실패';
    throw new Error(errorMsg);
  }
  return data;
}

export async function fetchExchangeRate(token) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/change/rate`, { headers, credentials: "include" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "환율 조회 실패");
  return data;
}

export async function upgradeDemand(token) {
  const headers = attachCsrf({});
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/upgrade/demand`, {
    method: "POST",
    headers,
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "업그레이드 실패");
  return data;
}

export const upgradeSupply = upgradeDemand;

export async function postUpgrade(endpoint, token) {
  const headers = attachCsrf({ "Content-Type": "application/json" });
  if (token) headers.authorization = `Bearer ${token}`;
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
  const headers = attachCsrf({});
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/progress/${encodeURIComponent(generatorId)}`, {
    method: "DELETE",
    headers,
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "철거 실패");
  return data;
}

export async function fetchMyRank(token, criteria = 'money') {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/rank?criteria=${criteria}`, {
    headers,
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "랭크 조회 실패");
  return data;
}

export async function skipGeneratorBuild(generatorId, token) {
  const headers = attachCsrf({ "Content-Type": "application/json" });
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/progress/${encodeURIComponent(generatorId)}/build/skip`, {
    method: "POST",
    headers,
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "건설 스킵 실패");
  return data;
}

export async function fetchRanks(token, { limit = 10, offset = 0, criteria = 'money' } = {}) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  params.set("criteria", criteria);
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/ranks?${params.toString()}`, {
    headers,
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "랭킹 목록 조회 실패");
  return data;
}

export async function deleteAccount(password, token) {
  const headers = attachCsrf({ "Content-Type": "application/json" });
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/delete_account`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify({ password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "계정 삭제 실패");
  return data;
}

export async function autosaveProgress(token, payload = {}) {
  const body = {};
  if (payload.energy_data != null) body.energy_data = payload.energy_data;
  if (payload.energy_high != null) body.energy_high = payload.energy_high;
  if (payload.money_data != null) body.money_data = payload.money_data;
  if (payload.money_high != null) body.money_high = payload.money_high;
  if (payload.play_time_ms != null) body.play_time_ms = payload.play_time_ms;
  if (payload.generators && Array.isArray(payload.generators)) {
    const filtered = payload.generators
      .filter(g => g && (g.generator_id || g.id))
      .map(g => ({
        generator_id: g.generator_id || g.id,
        heat: typeof g.heat === 'number' ? Math.max(0, Math.floor(g.heat)) : 0,
        running: g.running !== false, // true unless explicitly false
      }));
    
    if (filtered.length > 0) {
      body.generators = filtered;
    }
  }
  if (!Object.keys(body).length) throw new Error("저장할 데이터가 없습니다.");
  const headers = attachCsrf({ "Content-Type": "application/json" });
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/progress/autosave`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "자동 저장 실패");
  return data;
}

export async function updateGeneratorState(generatorId, payload = {}, token) {
  const body = {};
  if (payload.running != null) body.running = Boolean(payload.running);
  if (typeof payload.heat === "number") body.heat = Math.max(0, Math.floor(payload.heat));
  if (payload.explode) body.explode = true;
  if (!Object.keys(body).length) throw new Error("변경할 내용이 없습니다.");
  const headers = attachCsrf({ "Content-Type": "application/json" });
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/progress/${encodeURIComponent(generatorId)}/state`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(body),
  });
  
  // Handle 404 gracefully - generator may have been deleted (e.g., during rebirth)
  if (res.status === 404) {
    return null;
  }
  
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "발전기 상태 업데이트 실패");
  return data;
}

export async function upgradeGenerator(generatorId, upgrade, amount = 1, token) {
  const headers = attachCsrf({ "Content-Type": "application/json" });
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/progress/${encodeURIComponent(generatorId)}/upgrade`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify({ upgrade, amount }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "발전기 업그레이드 실패");
  return data;
}

export async function fetchRebirthInfo(token) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/rebirth/info`, {
    headers,
    credentials: "include",
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`환생 정보 불러오기 실패 ${res.status} ${txt}`);
  }
  return res.json();
}

export async function performRebirth(token) {
  const headers = attachCsrf({ "Content-Type": "application/json" });
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/rebirth`, {
    method: "POST",
    headers,
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "환생 실패");
  return data;
}


// ============= Tutorial API =============

export async function updateTutorialProgress(step, token) {
  const headers = attachCsrf({ "Content-Type": "application/json" });
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/tutorial/progress`, {
    method: "PUT",
    headers,
    credentials: "include",
    body: JSON.stringify({ step })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "튜토리얼 업데이트 실패");
  return data;
}

export async function skipTutorial(token) {
  const headers = attachCsrf({ "Content-Type": "application/json" });
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/tutorial/skip`, {
    method: "POST",
    headers,
    credentials: "include"
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "튜토리얼 건너뛰기 실패");
  return data;
}

export async function getTutorialStatus(token) {
  const headers = attachCsrf();
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/tutorial/status`, {
    method: "GET",
    headers,
    credentials: "include"
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "튜토리얼 상태 불러오기 실패");
  return data;
}

/**
 * Refresh access token using refresh token (stored in HttpOnly cookie)
 * @returns {Promise<boolean>} true if refresh succeeded, false otherwise
 */
export async function refreshAccessToken() {
  try {
    // First try to get a fresh CSRF token from server
    try {
      const csrfRes = await originalFetch(`${API_BASE}/csrf`, {
        method: "GET",
        credentials: "include"
      });
      if (csrfRes.ok) {
        const csrfData = await csrfRes.json();
        if (csrfData.csrf_token) {
          localStorage.setItem(CSRF_STORAGE_KEY, csrfData.csrf_token);
        }
      }
    } catch (csrfError) {
      console.warn("Failed to refresh CSRF token:", csrfError);
      // Continue anyway, use existing CSRF token
    }

    const headers = attachCsrf();
    // Use originalFetch to avoid infinite loop
    const res = await originalFetch(`${API_BASE}/refresh/access`, {
      method: "POST",
      headers,
      credentials: "include" // Send refresh token cookie
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error("Token refresh failed:", res.status, errorData);
      return false; // Refresh token expired or invalid
    }

    return true; // Successfully refreshed
  } catch (e) {
    console.error("Token refresh failed:", e);
    return false;
  }
}

// ============= Inquiry API =============

export async function createInquiry(type, content, token) {
  const headers = attachCsrf({ "Content-Type": "application/json" });
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/inquiries`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify({ type, content }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "문의 제출 실패");
  return data;
}

export async function fetchInquiries(token) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/inquiries`, {
    headers,
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "문의 목록 조회 실패");
  return data;
}

export async function acceptInquiry(inquiryId, token) {
  const headers = attachCsrf({ "Content-Type": "application/json" });
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/inquiries/${encodeURIComponent(inquiryId)}/accept`, {
    method: "POST",
    headers,
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "문의 수락 실패");
  return data;
}

export async function rejectInquiry(inquiryId, token) {
  const headers = attachCsrf({ "Content-Type": "application/json" });
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/inquiries/${encodeURIComponent(inquiryId)}/reject`, {
    method: "POST",
    headers,
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "문의 거절 실패");
  return data;
}

// ============= Global Fetch Override =============

// Override global fetch to use fetchWithTokenRefresh for API calls
window.fetch = function(url, options) {
  // Only intercept API calls to our backend
  const urlStr = typeof url === 'string' ? url : url.toString();

  if (urlStr.includes(API_BASE)) {
    return fetchWithTokenRefresh(urlStr, options);
  }

  // For non-API calls, use original fetch
  return originalFetch(url, options);
};

// Export original fetch for internal use (e.g., refreshAccessToken)
export { originalFetch };
