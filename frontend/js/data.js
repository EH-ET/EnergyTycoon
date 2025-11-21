// 공통 상수와 하드코딩된 기본 데이터
const DEPLOY_FRONTEND_URL = "NotExistYet-URL---------FRONT";
const DEPLOY_BACKEND_URL = "NotExistYet-URL--------BACK";

function trimTrailingSlash(url) {
  if (!url) return url;
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export const FRONTEND_BASE = (() => {
  if (window.__FRONTEND_BASE__) return window.__FRONTEND_BASE__;
  const { hostname } = window.location || {};
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";
  if (isLocalHost) return "";
  return trimTrailingSlash(DEPLOY_FRONTEND_URL);
})();

export function toFrontendPath(path) {
  const base = trimTrailingSlash(FRONTEND_BASE);
  return base ? `${base}/${path}` : path;
}

export const API_BASE = (() => {
  if (window.__API_BASE__) return window.__API_BASE__;
  const { protocol, hostname, port } = window.location || {};
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";
  if (isLocalHost || port === "5500") return "http://127.0.0.1:8000";
  if (protocol === "http:" || protocol === "https:") return trimTrailingSlash(DEPLOY_BACKEND_URL);
  return "http://127.0.0.1:8000";
})();

export const generators = [
  {"이름": "광합성", "세부설명": "태양을 이용해 에너지를 생산합니다. 낮에만 작동하며 친환경적입니다.", "설치비용": 5, "설치시간(초)": 3, "생산량(에너지)": 1, "크기": 1, "내열한계": 50, "발열": 0},
  {"이름": "풍력", "세부설명": "바람을 이용해 에너지를 생산합니다. 바람이 강할수록 효율이 올라갑니다.", "설치비용": 20, "설치시간(초)": 10, "생산량(에너지)": 5, "크기": 3, "내열한계": 70, "발열": 2},
  {"이름": "지열", "세부설명": "지열을 이용해 안정적으로 전력을 생산합니다. 초기비용이 높지만 안정적입니다.", "설치비용": 50, "설치시간(초)": 30, "생산량(에너지)": 20, "크기": 5, "내열한계": 100, "발열": 5}
];

export const upgrades = [
  {"이름": "전체 생산량 증가", "endpoint": "production", "field": "production_bonus", "설명": "모든 발전기의 생산량을 늘립니다.", "baseCost": 100, "priceGrowth": 1.25},
  {"이름": "발열 감소", "endpoint": "heat_reduction", "field": "heat_reduction", "설명": "발전기의 발열을 줄입니다.", "baseCost": 100, "priceGrowth": 1.15},
  {"이름": "내열한계 증가", "endpoint": "tolerance", "field": "tolerance_bonus", "설명": "발전기의 내열한계를 높입니다.", "baseCost": 100, "priceGrowth": 1.2},
  {"이름": "최대 발전기 수 증가", "endpoint": "max_generators", "field": "max_generators_bonus", "설명": "설치 가능한 발전기의 최대 수를 늘립니다.", "baseCost": 150, "priceGrowth": 1.3},
  {"이름": "공급 증가", "endpoint": "supply", "field": "supply_bonus", "설명": "시장 공급을 늘려 교환 가치 하락을 늦춥니다.", "baseCost": 120, "priceGrowth": 1.2}
];
