import { useStore } from '../store/useStore';
import { generators } from './data';
import { valueFromServer, toPlainValue } from './bigValue';

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";
const originalFetch = window.fetch.bind(window);

// Track if we're currently refreshing to prevent multiple refresh attempts
let isRefreshing = false;
let refreshPromise = null;
let globalLoadingHandler = null;

export function setGlobalLoadingCallback(cb) {
  globalLoadingHandler = typeof cb === 'function' ? cb : null;
}

// Helper to read cookie
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

async function ensureCsrfToken() {
  let token = null;

  // Try to read from cookie
  token = readCookie(CSRF_COOKIE_NAME);

  if (!token) {
    // If no token in cookie, fetch from server
    try {
      const res = await originalFetch(`${API_BASE}/csrf-token`, {
        credentials: "include"
      });

      // Check response header first
      const headerToken = res.headers.get(CSRF_HEADER_NAME);
      if (headerToken) {
        token = headerToken;
      } else if (res.ok) {
        // Fallback to response body
        const data = await res.json();
        token = data.csrf_token;
      }

      if (token) {
        // Update cookie
        const d = new Date();
        d.setTime(d.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1 year
        document.cookie = `${CSRF_COOKIE_NAME}=${token}; path=/; expires=${d.toUTCString()}; SameSite=Lax`;
      }
    } catch (e) {
      console.error("Failed to fetch CSRF token:", e);
      // Fallback: generate client-side token
      token = globalThis.crypto?.randomUUID?.() || `csrf_${Date.now()}`;
      const d = new Date();
      d.setTime(d.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1 year
      document.cookie = `${CSRF_COOKIE_NAME}=${token}; path=/; expires=${d.toUTCString()}; SameSite=Lax`;
    }
  }

  return token;
}

async function addCsrfHeader(headers = {}) {
  const token = await ensureCsrfToken();
  return { ...headers, [CSRF_HEADER_NAME]: token };
}

/**
 * Handle logout - clear all tokens and reload page
 */
function handleLogout() {
  // Clear any client-side stored tokens (though they should be HttpOnly)
  // and reload to ensure a clean state.
  // The backend will clear HttpOnly cookies on logout.
  window.location.href = "/";
}

/**
 * Wrapper for fetch that handles token refresh and server wake-up
 * @param {string} url - The URL to fetch
 * @param {RequestInit} options - Fetch options
 * @param {boolean} skipRetry - Internal flag to prevent infinite retry
 * @returns {Promise<Response>}
 */
async function fetchWithTokenRefresh(url, options = {}, skipRetry = false) {
  const { setGlobalLoading } = useStore.getState(); // Fallback handler from store
  const notifyLoading = (isLoading, message = '') => {
    if (globalLoadingHandler) {
      globalLoadingHandler(isLoading, message);
    } else {
      setGlobalLoading(isLoading, message);
    }
  };

  let loadingTimer = null;
  const showLoadingAfterDelay = () => {
    loadingTimer = setTimeout(() => {
      notifyLoading(true, '서버 응답 대기 중...');
    }, 1000); // Show loading after 1 second
  };

  showLoadingAfterDelay(); // Start the timer

  try {
    let response = await originalFetch(url, options);

    // Check for and update CSRF token from response headers
    const newCsrfToken = response.headers.get(CSRF_HEADER_NAME);
    if (newCsrfToken) {
        const d = new Date();
        d.setTime(d.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1 year
        document.cookie = `${CSRF_COOKIE_NAME}=${newCsrfToken}; path=/; expires=${d.toUTCString()}; SameSite=Lax`;
    }

    // Handle 401 Unauthorized - token expired
    if (response.status === 401 && !skipRetry) {
      console.log('Token expired, attempting refresh...');

      // Check if this is from a login/signup request - don't refresh
      if (url.includes('/login') || url.includes('/signup') || url.includes('/register')) {
        console.log('401 from auth endpoint - not attempting refresh');
        return response;
      }

      // Show loading during token refresh
      notifyLoading(true, '인증 갱신 중...');

      // If already refreshing, wait for that to complete
      if (isRefreshing && refreshPromise) {
        try {
          const success = await refreshPromise;
          if (success) {
            console.log('Token refreshed successfully, retrying original request...');
            // Retry original request
            return fetchWithTokenRefresh(url, options, true);
          } else {
            // Refresh failed - logout user
            console.error('Token refresh failed, logging out...');
            handleLogout();
            throw new Error('Token refresh failed');
          }
        } catch (e) {
          console.error('Error waiting for refresh:', e);
          handleLogout();
          throw e;
        }
      }

      // Start refresh
      isRefreshing = true;
      refreshPromise = refreshAccessToken();

      try {
        const success = await refreshPromise;
        if (success) {
          console.log('Token refreshed successfully, retrying request...');
          // Retry original request with skipRetry=true to prevent infinite loop
          return fetchWithTokenRefresh(url, options, true);
        } else {
          // Refresh failed - logout user
          console.error('Token refresh failed, logging out...');
          handleLogout();
          throw new Error('Token refresh failed');
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        handleLogout();
        throw refreshError;
      } finally {
        isRefreshing = false;
        refreshPromise = null;
      }
    }

    return response;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  } finally {
    clearTimeout(loadingTimer);
    notifyLoading(false);
  }
}

/**
 * Refresh access token using refresh token (stored in HttpOnly cookie)
 * @returns {Promise<boolean>} true if refresh succeeded, false otherwise
 */
export async function refreshAccessToken() {
  try {
    // First try to get a fresh CSRF token from server
    const csrfRes = await originalFetch(`${API_BASE}/csrf-token`, { credentials: "include" });
    const csrfData = await csrfRes.json();
    const csrfFromHeader = csrfRes.headers.get(CSRF_HEADER_NAME);

    if (csrfFromHeader) {
        // Update CSRF cookie from header
        const d = new Date();
        d.setTime(d.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1 year
        document.cookie = `${CSRF_COOKIE_NAME}=${csrfFromHeader}; path=/; expires=${d.toUTCString()}; SameSite=Lax`;
        console.log('CSRF token refreshed from header');
    } else if (csrfData.csrf_token) {
        // Fallback: Update CSRF cookie from body if header not present
        const d = new Date();
        d.setTime(d.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1 year
        document.cookie = `${CSRF_COOKIE_NAME}=${csrfData.csrf_token}; path=/; expires=${d.toUTCString()}; SameSite=Lax`;
        console.log('CSRF token refreshed from body');
    } else {
        console.warn("No CSRF token found in refresh response.");
    }

    // Now attempt to refresh access token
    const csrfHeaders = await addCsrfHeader({
      "Content-Type": "application/json",
    });
    const res = await originalFetch(`${API_BASE}/refresh/access`, {
      method: "POST",
      headers: csrfHeaders,
      credentials: "include" // Send refresh token cookie
    });

    if (!res.ok) {
      const errorData = await res.json();
      console.error("Token refresh failed:", res.status, errorData);
      return false; // Refresh token expired or invalid
    }

    return true; // Successfully refreshed
  } catch (e) {
    console.error("Token refresh failed:", e);
    return false;
  }
}

// Override global fetch to use fetchWithTokenRefresh for API calls
window.fetch = async (...args) => {
  const [url, options] = args;
  const urlStr = typeof url === 'string' ? url : url.url;

  // Skip fetchWithTokenRefresh for auth/CSRF endpoints to avoid loops and false refresh attempts
  const bypassPaths = ["/csrf-token", "/csrf", "/login", "/signup", "/register", "/logout", "/refresh/access"];
  const shouldBypass = bypassPaths.some((p) => urlStr.includes(p));
  if (shouldBypass) {
    const csrfHeaders = await addCsrfHeader(options?.headers);
    const bypassOptions = {
      ...options,
      headers: csrfHeaders,
      credentials: "include",
    };
    return originalFetch(url, bypassOptions);
  }

  // Add CSRF header to all outgoing requests
  const csrfHeaders = await addCsrfHeader(options?.headers);
  const newOptions = {
    ...options,
    headers: csrfHeaders,
    credentials: "include" // Ensure cookies are sent
  };

  return fetchWithTokenRefresh(urlStr, newOptions);
};

// Export original fetch for internal use (e.g., refreshAccessToken)
export { originalFetch };

// API functions
export async function login(username, password) {
  const response = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
    credentials: "include" // Send cookies
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Login failed");
  }
  return response.json();
}

export async function register(username, password) {
  const response = await fetch(`${API_BASE}/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
    credentials: "include" // Send cookies
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Registration failed");
  }
  return response.json();
}

export async function logout() {
  const response = await fetch(`${API_BASE}/logout`, {
    method: "POST",
    credentials: "include" // Send cookies
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Logout failed");
  }
  return response.json();
}

export async function fetchGeneratorTypes() {
  const response = await fetch(`${API_BASE}/generator_types`, {
    credentials: "include"
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to fetch generator types");
  }
  return response.json();
}

export async function loadGeneratorTypes(state) {
  const data = await fetchGeneratorTypes();
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

    state.generatorTypeMap[typeName] = typeId;
    state.generatorTypeInfoMap[typeName] = { id: typeId, cost };

    if (fallbackName && fallbackName !== typeName) {
      state.generatorTypeMap[fallbackName] = typeId;
      state.generatorTypeInfoMap[fallbackName] = { id: typeId, cost };
    }

    state.generatorTypeIdToName[typeId] = fallbackName || typeName;
    state.generatorTypesById[typeId] = { name: fallbackName || typeName, cost, index: resolvedIndex };
  });
}

export async function saveProgress(userId, generatorTypeId, x_position, world_position, token, energy) {
  const headers = { "Content-Type": "application/json" };
  // if (token) headers.authorization = `Bearer ${token}`; // Token is now in HttpOnly cookie
  const response = await fetch(`${API_BASE}/progress`, {
    method: "POST",
    headers,
    body: JSON.stringify({ user_id: userId, generator_type_id: generatorTypeId, x_position, world_position }),
    credentials: "include"
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to save progress");
  }
  return response.json();
}

export async function loadProgress(userId) {
  const response = await fetch(`${API_BASE}/progress?user_id=${userId}`, {
    credentials: "include"
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load progress");
  }
  return response.json();
}

export async function exchangeEnergy(userId, amount) {
  const headers = { "Content-Type": "application/json" };
  const response = await fetch(`${API_BASE}/exchange`, {
    method: "POST",
    headers,
    body: JSON.stringify({ user_id: userId, amount }),
    credentials: "include"
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to exchange energy");
  }
  return response.json();
}

export async function fetchExchangeRate() {
  const response = await fetch(`${API_BASE}/exchange_rate`, {
    credentials: "include"
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to fetch exchange rate");
  }
  return response.json();
}

export async function upgradeProduction(amount = 1) {
  const response = await fetch(`${API_BASE}/upgrade/production`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
    credentials: "include"
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to upgrade production");
  }
  return response.json();
}

export async function upgradeHeatReduction(amount = 1) {
  const response = await fetch(`${API_BASE}/upgrade/heat_reduction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
    credentials: "include"
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to upgrade heat reduction");
  }
  return response.json();
}

export async function upgradeTolerance(amount = 1) {
  const response = await fetch(`${API_BASE}/upgrade/tolerance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
    credentials: "include"
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to upgrade tolerance");
  }
  return response.json();
}

export async function upgradeMaxGenerators(amount = 1) {
  const response = await fetch(`${API_BASE}/upgrade/max_generators`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
    credentials: "include"
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to upgrade max generators");
  }
  return response.json();
}

export async function upgradeDemand(amount = 1) {
  const response = await fetch(`${API_BASE}/upgrade/demand`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
    credentials: "include"
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to upgrade demand");
  }
  return response.json();
}

export async function postUpgrade(endpoint, token, amount = 1) {
  const headers = { "Content-Type": "application/json" };
  // if (token) headers.authorization = `Bearer ${token}`; // Token is now in HttpOnly cookie
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ amount }),
    credentials: "include"
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || `Failed to post upgrade to ${endpoint}`);
  }
  return response.json();
}

export async function demolishGenerator(generatorId) {
  const response = await fetch(`${API_BASE}/progress/${generatorId}`, {
    method: "DELETE",
    credentials: "include"
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to demolish generator");
  }
  return response.json();
}

export async function fetchMyRank(criteria = 'money') {
  const response = await fetch(`${API_BASE}/rank/my?criteria=${criteria}`, {
    credentials: "include"
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to fetch my rank");
  }
  return response.json();
}

export async function skipGeneratorBuild(generatorId) {
  const response = await fetch(`${API_BASE}/progress/${generatorId}/build/skip`, {
    method: "POST",
    credentials: "include"
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to skip build");
  }
  return response.json();
}

export async function fetchRanks({ limit = 10, offset = 0, criteria = 'money' } = {}) {
  const response = await fetch(`${API_BASE}/rank?limit=${limit}&offset=${offset}&criteria=${criteria}`, {
    credentials: "include"
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to fetch ranks");
  }
  return response.json();
}

export async function deleteAccount(password) {
  const response = await fetch(`${API_BASE}/delete_account`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
    credentials: "include"
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to delete account");
  }
  return response.json();
}

export async function autosaveProgress(payload = {}) {
  const headers = { "Content-Type": "application/json" };
  const response = await fetch(`${API_BASE}/progress/autosave`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    credentials: "include"
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to autosave progress");
  }
  return response.json();
}

export async function updateGeneratorState(generatorId, payload = {}) {
  const headers = { "Content-Type": "application/json" };
  const response = await fetch(`${API_BASE}/progress/${generatorId}/state`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    credentials: "include"
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to update generator state");
  }
  return response.json();
}

export async function upgradeGenerator(generatorId, upgrade, amount = 1) {
  const headers = { "Content-Type": "application/json" };
  const response = await fetch(`${API_BASE}/progress/${generatorId}/upgrade`, {
    method: "POST",
    headers,
    body: JSON.stringify({ upgrade, amount }),
    credentials: "include"
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to upgrade generator");
  }
  return response.json();
}

export async function fetchRebirthInfo() {
  const response = await fetch(`${API_BASE}/rebirth/info`, {
    credentials: "include"
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to fetch rebirth info");
  }
  return response.json();
}

export async function performRebirth(count = 1) {
  const headers = { "Content-Type": "application/json" };
  const response = await fetch(`${API_BASE}/rebirth`, {
    method: "POST",
    headers,
    body: JSON.stringify({ count }),
    credentials: "include"
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to perform rebirth");
  }
  return response.json();
}

export async function updateTutorialProgress(step) {
  const headers = { "Content-Type": "application/json" };
  const response = await fetch(`${API_BASE}/tutorial/progress`, {
    method: "POST",
    headers,
    body: JSON.stringify({ step }),
    credentials: "include"
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to update tutorial progress");
  }
  return response.json();
}

export async function skipTutorial() {
  const response = await fetch(`${API_BASE}/tutorial/skip`, {
    method: "POST",
    credentials: "include"
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to skip tutorial");
  }
  return response.json();
}

export async function getTutorialStatus() {
  const response = await fetch(`${API_BASE}/tutorial/status`, {
    credentials: "include"
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to get tutorial status");
  }
  return response.json();
}

export async function createInquiry(type, content) {
  const headers = { "Content-Type": "application/json" };
  const response = await fetch(`${API_BASE}/inquiry`, {
    method: "POST",
    headers,
    body: JSON.stringify({ type, content }),
    credentials: "include"
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to create inquiry");
  }
  return response.json();
}

export async function fetchInquiries() {
  const response = await fetch(`${API_BASE}/inquiry`, {
    credentials: "include"
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to fetch inquiries");
  }
  return response.json();
}

export async function acceptInquiry(inquiryId) {
  const response = await fetch(`${API_BASE}/inquiry/${inquiryId}/accept`, {
    method: "POST",
    credentials: "include"
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to accept inquiry");
  }
  return response.json();
}

export async function rejectInquiry(inquiryId) {
  const response = await fetch(`${API_BASE}/inquiry/${inquiryId}/reject`, {
    method: "POST",
    credentials: "include"
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to reject inquiry");
  }
  return response.json();
}
