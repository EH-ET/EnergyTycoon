import axios from 'axios';
import { useStore } from '../store/useStore';
import { generators, API_BASE } from './data';
import { valueFromServer, toPlainValue } from './bigValue';

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";

// Helper to read a cookie
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

// Create an Axios instance
const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // Send cookies with requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add CSRF token
apiClient.interceptors.request.use(
  (config) => {
    const csrfToken = getCookie(CSRF_COOKIE_NAME);
    if (csrfToken) {
      config.headers[CSRF_HEADER_NAME] = csrfToken;
    }
    return config;
  },
  (error) => Promise.reject(error)
);


// --- Token Refresh Logic ---
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor for handling token expiry
apiClient.interceptors.response.use(
  (response) => {
    // If the response has a new CSRF token, update the cookie
    const newCsrfToken = response.headers[CSRF_HEADER_NAME.toLowerCase()];
    if (newCsrfToken) {
        const d = new Date();
        d.setTime(d.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1 year
        // Cross-site requires SameSite=None; Secure
        document.cookie = `${CSRF_COOKIE_NAME}=${newCsrfToken}; path=/; expires=${d.toUTCString()}; SameSite=None; Secure`;
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Check if it's a 401 error and not a retry request
    if (error.response?.status === 401 && !originalRequest._retry) {
      console.log('401 error detected:', originalRequest.url);

      // Avoid refresh loops for login/signup/refresh endpoints
      const bypassUrls = ['/login', '/signup', '/register', '/refresh/access', '/refresh/refresh'];
      if (bypassUrls.some(url => originalRequest.url.includes(url))) {
        console.log('401 from auth endpoint, not attempting refresh');
        return Promise.reject(error);
      }

      // If we're already refreshing, wait for that to complete
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
        .then(() => {
            return apiClient(originalRequest);
        })
        .catch(err => {
            return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        console.log('Attempting to refresh access token...');
        await refreshAccessToken();
        console.log('Access token refreshed successfully');
        processQueue(null);
        return apiClient(originalRequest);
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        processQueue(refreshError);
        handleLogout(); // Logout user if refresh fails
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle 403 Forbidden - CSRF token issues
    if (error.response?.status === 403) {
      const detail = error.response?.data?.detail || '';
      if (detail.toLowerCase().includes('csrf')) {
        console.error('CSRF token error:', detail);
      }
    }

    return Promise.reject(error);
  }
);


function handleLogout() {
    // Clear all client-side state (Zustand and localStorage)
    useStore.getState().logout();
    
    // Redirect the user to the login page.
    window.location.href = "/"; 
}

// API functions using the apiClient
export async function refreshAccessToken() {
    // This function directly uses the apiClient to ensure interceptors are applied
    const response = await apiClient.post('/refresh/access');
    return response.data;
}


export async function login(username, password) {
  const response = await apiClient.post('/login', { username, password });
  return response.data;
}

export async function register(username, password) {
  const response = await apiClient.post('/register', { username, password });
  return response.data;
}

export async function logout() {
  const response = await apiClient.post('/logout');
  handleLogout(); // Ensure redirect after logout call
  return response.data;
}

export async function fetchGeneratorTypes() {
  const response = await apiClient.get('/generator_types');
  return response.data;
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

export async function saveProgress(userId, generatorTypeId, x_position, world_position) {
  const response = await apiClient.post('/progress', { user_id: userId, generator_type_id: generatorTypeId, x_position, world_position });
  return response.data;
}

export async function loadProgress(userId) {
  const response = await apiClient.get(`/progress?user_id=${userId}`);
  return response.data;
}

export async function exchangeEnergy(userId, amount) {
  // The 'amount' parameter is expected to be a BigValue object.
  // The payload is structured to match what the backend's ExchangeIn schema requires.
  const payload = {
    user_id: userId,
    amount_data: amount.data,
    amount_high: amount.high,
  };
  const response = await apiClient.post('/change/energy2money', payload);
  return response.data;
}

export async function fetchExchangeRate() {
  const response = await apiClient.get('/change/rate');
  return response.data;
}

export async function upgradeProduction(amount = 1) {
    const response = await apiClient.post('/upgrade/production', { amount });
    return response.data;
}

export async function upgradeHeatReduction(amount = 1) {
    const response = await apiClient.post('/upgrade/heat_reduction', { amount });
    return response.data;
}

export async function upgradeTolerance(amount = 1) {
    const response = await apiClient.post('/upgrade/tolerance', { amount });
    return response.data;
}

export async function upgradeMaxGenerators(amount = 1) {
    const response = await apiClient.post('/upgrade/max_generators', { amount });
    return response.data;
}

export async function upgradeDemand(amount = 1) {
    const response = await apiClient.post('/upgrade/demand', { amount });
    return response.data;
}

export async function postUpgrade(endpoint, amount = 1) {
    const response = await apiClient.post(`/upgrade/${endpoint}`, { amount });
    return response.data;
}

export async function postBulkUpgrades(upgrades) {
    // upgrades: [{ endpoint: string, amount: number }, ...]
    const response = await apiClient.post('/upgrade/bulk', { upgrades });
    return response.data;
}

export async function demolishGenerator(generatorId) {
    const response = await apiClient.delete(`/progress/${generatorId}`);
    return response.data;
}

export async function fetchMyRank(criteria = 'money') {
    const validCriteria = criteria || 'money';
    const response = await apiClient.get(`/rank?criteria=${validCriteria}`);
    return response.data;
}

export async function skipGeneratorBuild(generatorId) {
    const response = await apiClient.post(`/progress/${generatorId}/build/skip`);
    return response.data;
}

export async function fetchRanks({ limit = 10, offset = 0, criteria = 'money' } = {}) {
    const validCriteria = criteria || 'money';
    const response = await apiClient.get(`/ranks?limit=${limit}&offset=${offset}&criteria=${validCriteria}`);
    return response.data;
}

export async function deleteAccount(password) {
    const response = await apiClient.post('/delete_account', { password });
    return response.data;
}

export async function autosaveProgress(payload = {}) {
    const response = await apiClient.post('/progress/autosave', payload);
    return response.data;
}

export async function updateGeneratorState(generatorId, payload = {}) {
    const response = await apiClient.post(`/progress/${generatorId}/state`, payload);
    return response.data;
}

export async function upgradeGenerator(generatorId, upgrade, amount = 1) {
    const response = await apiClient.post(`/progress/${generatorId}/upgrade`, { upgrade, amount });
    return response.data;
}

export async function fetchRebirthInfo() {
    const response = await apiClient.get('/rebirth/info');
    return response.data;
}

export async function performRebirth(count = 1) {
    const response = await apiClient.post('/rebirth', { count });
    return response.data;
}

export async function updateTutorialProgress(step) {
    const response = await apiClient.post('/tutorial/progress', { step });
    return response.data;
}

export async function skipTutorial() {
    const response = await apiClient.post('/tutorial/skip');
    return response.data;
}

export async function getTutorialStatus() {
    const response = await apiClient.get('/tutorial/status');
    return response.data;
}

export async function createInquiry(type, content) {
    const response = await apiClient.post('/inquiries', { type, content });
    return response.data;
}

export async function fetchInquiries() {
    const response = await apiClient.get('/inquiries');
    return response.data;
}

export async function acceptInquiry(inquiryId) {
    const response = await apiClient.post(`/inquiries/${inquiryId}/accept`);
    return response.data;
}

export async function rejectInquiry(inquiryId) {
    const response = await apiClient.post(`/inquiries/${inquiryId}/reject`);
    return response.data;
}
