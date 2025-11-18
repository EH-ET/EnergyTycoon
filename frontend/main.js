const generatorBtn = document.querySelector(".generator-btn");
const tradeBtn = document.querySelector(".trade-btn");
const upgradeBtn = document.querySelector(".upgrade-btn");
const infoBtn = document.querySelector(".info-btn");
const contentArea = document.querySelector(".content-area");
const mainArea = document.querySelector(".main");
const username = document.querySelector(".username");
let contentMode = "generator";
let currentUser = null;

// 변경: 백엔드 주소 설정 (개발 환경 기본: localhost:8000)
const API_BASE = (function(){
  if (window.__API_BASE__) return window.__API_BASE__;
  return "http://localhost:8000";
})();

const generators = [
  {"이름": "광합성", "세부설명": "태양을 이용해 에너지를 생산합니다. 낮에만 작동하며 친환경적입니다.", "설치비용": 5, "설치시간(초)": 3, "생산량(에너지)": 1, "크기": 1, "내열한계": 50, "발열": 0},
  {"이름": "풍력", "세부설명": "바람을 이용해 에너지를 생산합니다. 바람이 강할수록 효율이 올라갑니다.", "설치비용": 20, "설치시간(초)": 10, "생산량(에너지)": 5, "크기": 3, "내열한계": 70, "발열": 2},
  {"이름": "지열", "세부설명": "지열을 이용해 안정적으로 전력을 생산합니다. 초기비용이 높지만 안정적입니다.", "설치비용": 50, "설치시간(초)": 30, "생산량(에너지)": 20, "크기": 5, "내열한계": 100, "발열": 5}
];

const upgrades = [
  {"이름": "전체 생산량 증가", "endpoint": "production", "field": "production_bonus", "설명": "모든 발전기의 생산량을 늘립니다.", "baseCost": 100, "priceGrowth": 1.25},
  {"이름": "발열 감소", "endpoint": "heat_reduction", "field": "heat_reduction", "설명": "발전기의 발열을 줄입니다.", "baseCost": 100, "priceGrowth": 1.15},
  {"이름": "내열한계 증가", "endpoint": "tolerance", "field": "tolerance_bonus", "설명": "발전기의 내열한계를 높입니다.", "baseCost": 100, "priceGrowth": 1.2},
  {"이름": "최대 발전기 수 증가", "endpoint": "max_generators", "field": "max_generators_bonus", "설명": "설치 가능한 발전기의 최대 수를 늘립니다.", "baseCost": 150, "priceGrowth": 1.3}
];

// 이름 -> generator_type 정보 매핑을 저장
const generatorTypeMap = {};
const generatorTypeInfoMap = {};
const generatorTypeIdToName = {};
const placedGenerators = [];

function defaultPlacementY() {
  const height = mainArea ? mainArea.clientHeight : 0;
  return Math.max(16, height - 96); // place slightly above build bar
}

const SESSION_START_KEY = "session_start_ts";

function ensureSessionStart() {
  let ts = Number(localStorage.getItem(SESSION_START_KEY));
  if (!ts) {
    ts = Date.now();
    localStorage.setItem(SESSION_START_KEY, String(ts));
  }
  return ts;
}

function formatPlayTime(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return `${days}일 ${hours}시간 ${minutes}분`;
}

function getUpgradeLevel(user, upgrade) {
  const base = user ? Number(user[upgrade.field]) || 0 : 0;
  return base + 1; // 기본 1레벨
}

function getUpgradeCost(user, upgrade) {
  const level = getUpgradeLevel(user, upgrade);
  return Math.round(upgrade.baseCost * Math.pow(upgrade.priceGrowth, level));
}

// 유틸: 인덱스 기반 이미지 경로 생성 (1.png, 2.png, ...)
function makeImageSrcByIndex(idx) {
  const num = Number(idx);
  if (Number.isNaN(num)) return placeholderDataUrl();
  return `/frontend/generator/${num + 1}.png`;
}

function findGeneratorIndexByName(name) {
  return generators.findIndex(g => g && g.이름 === name);
}

// 유틸: 간단한 데이터 URL 플레이스홀더(SVG)
function placeholderDataUrl() {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='180'><rect width='100%' height='100%' fill='%23e0e0e0'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='20' fill='%23666'>이미지 없음</text></svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

function clearPlacedGenerators() {
  placedGenerators.length = 0;
  document.querySelectorAll(".placed-generator").forEach(el => el.remove());
}

// 모달 요소 하나만 생성하여 재사용
const generatorModal = document.createElement("div");
generatorModal.className = "generator-modal";
Object.assign(generatorModal.style, {
  position: "fixed",
  zIndex: 9999,
  maxWidth: "320px",
  padding: "10px",
  background: "rgba(0,0,0,0.85)",
  color: "#fff",
  borderRadius: "6px",
  pointerEvents: "none",
  display: "none",
  fontSize: "13px",
  lineHeight: "1.3",
});
document.body.appendChild(generatorModal);

// 서버에서 generator types 로드해서 이름->id 매핑 생성
async function loadGeneratorTypes() {
  try {
    const res = await fetch(`${API_BASE}/generator_types`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data.types) return;
    data.types.forEach(t => {
      generatorTypeMap[t.name] = t.id;
      generatorTypeInfoMap[t.name] = { id: t.id, cost: t.cost };
      generatorTypeIdToName[t.id] = t.name;
    });
  } catch (e) {
    console.warn("generator_types load failed", e);
  }
}

// 설치 정보 서버로 전송
async function saveProgress(userId, generatorTypeId, x_position, world_position, token) {
  const payload = {
    user_id: userId,
    generator_type_id: generatorTypeId,
    x_position: x_position,
    world_position: world_position
  };
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/progress`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`서버응답오류 ${res.status} ${txt}`);
  }
  return await res.json();
}

function renderSavedGenerators(list) {
  if (!Array.isArray(list)) return;
  list.forEach(g => {
    const name = g.type || generatorTypeIdToName[g.generator_type_id] || "";
    const idx = findGeneratorIndexByName(name);
    const imgSrc = idx >= 0 ? makeImageSrcByIndex(idx) : placeholderDataUrl();
    placedGenerators.push({ x: g.x_position, name, genIndex: idx });
    placeGeneratorVisual(g.x_position, imgSrc, name || "발전기");
  });
  if (currentUser) updateUserUI(currentUser);
}

async function loadProgress(userId, token) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/progress?user_id=${encodeURIComponent(userId)}`, { headers });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`진행도 불러오기 실패 ${res.status} ${txt}`);
  }
  return await res.json();
}

function computeEnergyPerSecond() {
  let total = 0;
  placedGenerators.forEach(pg => {
    if (pg.genIndex != null && pg.genIndex >= 0) {
      const g = generators[pg.genIndex];
      const base = g ? Number(g["생산량(에너지)"]) || 0 : 0;
      total += base;
    }
  });
  const bonus = currentUser ? Number(currentUser.production_bonus) || 0 : 0;
  const multiplier = 1 + bonus * 0.1;
  return total * multiplier;
}

let energyTimer = null;
function startEnergyTimer() {
  if (energyTimer) clearInterval(energyTimer);
  energyTimer = setInterval(() => {
    if (!currentUser) return;
    const delta = computeEnergyPerSecond();
    if (delta <= 0) return;
    currentUser.energy = Math.round((Number(currentUser.energy) || 0) + delta);
    localStorage.setItem("user", JSON.stringify(currentUser));
    updateUserUI(currentUser);
  }, 1000);
}

// 화면에 설치된 발전기 표시 (간단)
function placeGeneratorVisual(x, imgSrc, name) {
  if (!mainArea) return;
  // mainArea을 상대위치로 설정
  if (getComputedStyle(mainArea).position === "static") {
    mainArea.style.position = "relative";
  }
  const el = document.createElement("div");
  el.className = "placed-generator";
  Object.assign(el.style, {
    position: "absolute",
    left: `${x}px`,
    top: `${defaultPlacementY()}px`,
    transform: "translate(-50%, 0)",
    pointerEvents: "none",
    textAlign: "center"
  });
  const img = document.createElement("img");
  img.src = imgSrc;
  img.width = 64;
  img.height = 48;
  img.style.display = "block";
  img.style.filter = "drop-shadow(0 2px 4px rgba(0,0,0,0.25))";
  const lbl = document.createElement("div");
  lbl.textContent = name;
  lbl.style.fontSize = "11px";
  lbl.style.color = "#333";
  el.appendChild(img);
  el.appendChild(lbl);
  mainArea.appendChild(el);
}

// generatorMode: 이미지와 세부 정보 표시, 호버 시 모달 출력
function generatorMode() {
  contentArea.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "generator-grid";

  generators.forEach((gen, index) => {
    if (!gen || !gen.이름) return;

    const item = document.createElement("div");
    item.className = "generator-item";
    item.draggable = true;
    item.dataset.index = index;
    item.dataset.name = gen.이름;
    // 보장: 포인터로 드래그 시작되도록 포인터 이벤트 속성 조정
    item.style.touchAction = "none";
    item.style.userSelect = "none";

    const img = document.createElement("img");
    img.alt = gen.이름;
    img.src = makeImageSrcByIndex(index);
    // 자식 요소가 드래그 이벤트를 가로채지 않도록 비활성화
    img.draggable = false;
    img.style.pointerEvents = "none";

    // 이미지 로드 실패 시 플레이스홀더로 대체
    img.addEventListener("error", () => {
      img.src = placeholderDataUrl();
    });

    // 텍스트 정보
    const info = document.createElement("div");
    info.className = "generator-info";
    // info 영역도 자식이 포인터 이벤트를 가로채지 않도록 설정
    info.draggable = false;
    info.style.pointerEvents = "none";
    Object.assign(info.style, { display: "flex", flexDirection: "column"});

    const title = document.createElement("div");
    title.textContent = gen.이름;
    Object.assign(title.style, { fontWeight: "600", fontSize: "15px", color: "#222" });

    const stats = document.createElement("div");
    stats.className = "generator-stats";
    stats.innerHTML = `
      <p style="font-size:13px;color:#555; margin:0;">설치비용: ${gen.설치비용}</p>
      <p style="font-size:13px;color:#555; margin:0;">설치시간: ${gen["설치시간(초)"]}s</p>
      <p style="font-size:13px;color:#555; margin:0;">생산량: ${gen["생산량(에너지)"]}</p>
      <p style="font-size:13px;color:#555; margin:0;">크기: ${gen.크기}</p>
    `;

    info.appendChild(title);
    info.appendChild(stats);

    item.appendChild(img);
    item.appendChild(info);

    // 드래그 시작: 인덱스 전송
    item.addEventListener("dragstart", (e) => {
      console.log("Drag started for:", gen.이름);
      // 일부 브라우저(예: Firefox)에서 dataTransfer가 없을 수 있으니 안전 검사
      if (!e.dataTransfer) return;
      e.dataTransfer.setData("text/plain", String(index));
      e.dataTransfer.effectAllowed = "copy";
      
      // 드래그 중인 아이템 표시
      item.style.opacity = "0.5";
      
      // 커스텀 드래그 이미지(선택적)
      try {
        const dragImg = img.cloneNode(true);
        dragImg.style.width = "120px";
        dragImg.style.height = "84px";
        dragImg.style.pointerEvents = "none";
        dragImg.style.position = "absolute";
        dragImg.style.top = "-9999px";
        document.body.appendChild(dragImg);
        e.dataTransfer.setDragImage(dragImg, 60, 42);
        setTimeout(() => {
          if (document.body.contains(dragImg)) {
            document.body.removeChild(dragImg);
          }
        }, 0);
      } catch (err) {
        console.warn("Custom drag image failed:", err);
      }
    });

    // 드래그 끝나면 원래 스타일로 복원
    item.addEventListener("dragend", () => {
      console.log("Drag ended");
      item.style.opacity = "1";
    });

    // 모달 표시 로직: 마우스 오버 시 세부설명과 추가 정보 표시
    const showModal = (evt) => {
      const rect = item.getBoundingClientRect();
      const modalHtmlParts = [];
      if (gen.세부설명) {
        modalHtmlParts.push(`<div style="margin-bottom:6px;">${escapeHtml(gen.세부설명)}</div>`);
      }
      modalHtmlParts.push(`<p style="opacity:0.9;font-size:12px;">설치비용: ${gen.설치비용}</p>`);
      modalHtmlParts.push(`<p style="opacity:0.9;font-size:12px;">설치시간: ${gen["설치시간(초)"]}s</p>`);
      modalHtmlParts.push(`<p style="opacity:0.9;font-size:12px;">생산량: ${gen["생산량(에너지)"]}</p>`);
      modalHtmlParts.push(`<p style="opacity:0.9;font-size:12px;">내열한계: ${gen.내열한계}</p>`);
      generatorModal.innerHTML = modalHtmlParts.join("");
      generatorModal.style.display = "block";
      positionModalNearRect(rect);
    };

    const moveModal = (evt) => {
      const rect = item.getBoundingClientRect();
      positionModalNearRect(rect);
    };

    const hideModal = () => {
      generatorModal.style.display = "none";
    };

    item.addEventListener("mouseenter", showModal);
    item.addEventListener("mousemove", moveModal);
    item.addEventListener("mouseleave", hideModal);

    grid.appendChild(item);
  });

  contentArea.appendChild(grid);
}

// 보조: 모달을 요소 근처에 위치시키기
function positionModalNearRect(rect) {
  const margin = 8;
  const modalRect = generatorModal.getBoundingClientRect();
  let left = rect.right + margin;
  let top = rect.top;

  if (left + modalRect.width > window.innerWidth - 8) {
    left = rect.left - modalRect.width - margin;
  }
  if (top + modalRect.height > window.innerHeight - 8) {
    top = window.innerHeight - modalRect.height - 8;
  }
  generatorModal.style.left = Math.max(8, left) + "px";
  generatorModal.style.top = Math.max(8, top) + "px";
}

// 보안: 간단한 HTML 이스케이프
function escapeHtml(str) {
  if (typeof str !== "string") return str;
  return str.replace(/[&<>"']/g, (s) => {
    switch (s) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return s;
    }
  });
}

// UI 업데이트 함수
function updateUserUI(user) {
  username.textContent = user.username;
  document.querySelector(".money.text-bar.long p").textContent = user.money;
  document.querySelector(".energy.text-bar.long p").textContent = user.energy;
  document.querySelector(".profile-modal .modal-line").innerHTML = `<strong>이름:</strong> ${user.username}`;
  // Generator count update, assume 0 for now
  const count = document.querySelectorAll(".placed-generator").length;
  const max = 10 + user.max_generators_bonus * 5;
  document.querySelector(".generator.text-bar.generator-text-bar p").textContent = `${count}/${max}`;
}

// 플레이스홀더 모드들(간단한 자리 표시자)
function tradeMode() {
  contentArea.innerHTML = "<div style='padding:12px;color:#444;'>거래 모드(개발 중)</div>";
}
function upgradeMode() {
  if (!currentUser) {
    contentArea.innerHTML = "<div style='padding:12px;color:#f00;'>로그인 필요</div>";
    return;
  }
  contentArea.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "upgrade-grid";
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(auto-fit, minmax(200px, 1fr))";
  grid.style.gap = "10px";
  grid.style.padding = "10px";
  upgrades.forEach(upgrade => {
    const levelValue = getUpgradeLevel(currentUser, upgrade);
    const costValue = getUpgradeCost(currentUser, upgrade);
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
    cost.textContent = `비용: ${costValue} 돈`;
    cost.style.fontWeight = "bold";
    const level = document.createElement("p");
    level.textContent = `현재 레벨: ${levelValue}`;
    const btn = document.createElement("button");
    btn.textContent = "업그레이드";
    btn.style.padding = "8px 12px";
    btn.style.cursor = "pointer";
    btn.onclick = async () => {
      if (!currentUser) return;
      const token = localStorage.getItem("access_token");
      if (!token) {
        alert("로그인 필요");
        return;
      }
      if (currentUser.money < costValue) {
        alert("돈이 부족합니다.");
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/upgrade/${upgrade.endpoint}`, {
          method: "POST",
          headers: {"Authorization": `Bearer ${token}`}
        });
        if (!res.ok) {
          const txt = await res.text();
          alert(`업그레이드 실패: ${txt}`);
          return;
        }
        const newUser = await res.json();
        currentUser = newUser;
        localStorage.setItem("user", JSON.stringify(newUser));
        updateUserUI(newUser);
        upgradeMode();
      } catch (e) {
        alert(`오류: ${e.message}`);
      }
    };
    item.appendChild(title);
    item.appendChild(desc);
    item.appendChild(cost);
    item.appendChild(level);
    item.appendChild(btn);
    grid.appendChild(item);
  });
  contentArea.appendChild(grid);
}
function infoMode() {
  contentArea.innerHTML = "";
  if (!currentUser) {
    contentArea.innerHTML = "<div style='padding:12px;color:#f00;'>로그인 후 확인하세요.</div>";
    return;
  }
  const sessionStart = ensureSessionStart();
  const playTime = formatPlayTime(Date.now() - sessionStart);
  const totalEnergy = currentUser.energy ?? 0;
  const totalMoney = currentUser.money ?? 0;
  const rank = currentUser.rank ?? "-";
  const infoLines = [
    `이름: ${currentUser.username}`,
    `플레이시간: ${playTime}`,
    `얻은 총 에너지량: ${totalEnergy}`,
    `얻은 총 돈: ${totalMoney}`,
    `등수: ${rank}`
  ].join("\n");
  const box = document.createElement("div");
  box.style.whiteSpace = "pre-line";
  box.style.padding = "12px";
  box.style.color = "#cececeff";
  box.textContent = infoLines;
  contentArea.appendChild(box);
}

// 렌더러: 현재 모드에 따라 호출
function renderContent() {
  switch (contentMode) {
    case "generator":
      generatorMode();
      break;
    case "trade":
      tradeMode();
      break;
    case "upgrade":
      upgradeMode();
      break;
    case "info":
      infoMode();
      break;
    default:
      contentArea.innerHTML = "";
  }
}

// drop 관련 초기화
function initDropHandlers() {
  if (!mainArea) return;
  // mainArea 상대위치 보장
  if (getComputedStyle(mainArea).position === "static") {
    mainArea.style.position = "relative";
  }
  mainArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    mainArea.classList.add("drag-over");
  });
  mainArea.addEventListener("dragleave", (e) => {
    mainArea.classList.remove("drag-over");
  });
mainArea.addEventListener("drop", async (e) => {
  e.preventDefault();
  mainArea.classList.remove("drag-over");
  const idx = e.dataTransfer.getData("text/plain");
  if (idx === "") return;
  const rect = mainArea.getBoundingClientRect();
  // 마우스 위치 기준으로 설치 좌표 계산
  const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
  const gen = generators[Number(idx)];
  if (!gen) return;

    const token = localStorage.getItem("access_token");
    const userStr = localStorage.getItem("user");
    if (!token || !userStr) {
      alert("설치하려면 로그인 필요합니다.");
      return;
    }
    const user = JSON.parse(userStr);
    // generator type 정보 확인 (id, cost)
    const genInfo = generatorTypeInfoMap[gen.이름];
    const genTypeId = genInfo ? genInfo.id : generatorTypeMap[gen.이름];
    const cost = genInfo && typeof genInfo.cost === "number" ? genInfo.cost : gen.설치비용;
    if (!genTypeId) {
      alert("서버에서 발전기 정보를 불러오지 못했습니다.");
      return;
    }
  if (user.money < cost) {
    alert("돈이 부족합니다.");
    return;
  }
  // generator type id 확인 (서버에서 로드한 매핑 사용)
  try {
    const res = await saveProgress(user.user_id, genTypeId, Math.round(x), 0, token);
    // 로컬 상태 업데이트: 서버 응답 기반
    if (res.user) {
      currentUser = res.user;
      localStorage.setItem("user", JSON.stringify(res.user));
      updateUserUI(res.user);
    } else {
      // fallback 차감
      user.money = Math.max(0, user.money - cost);
      currentUser = user;
      localStorage.setItem("user", JSON.stringify(user));
      updateUserUI(user);
    }
    const genName = res.generator && res.generator.type ? res.generator.type : gen.이름;
    const idxByName = findGeneratorIndexByName(genName);
    const imgSrc = idxByName >= 0 ? makeImageSrcByIndex(idxByName) : placeholderDataUrl();
    placedGenerators.push({ x, name: genName, genIndex: idxByName });
    placeGeneratorVisual(x, imgSrc, genName);
    if (currentUser) updateUserUI(currentUser);
    startEnergyTimer();
  } catch (err) {
    alert("설치 실패: " + (err.message || err));
  }
});
}

// 버튼에 모드 전환 및 렌더 호출 연결
generatorBtn.addEventListener("click", () => { contentMode = "generator"; renderContent(); });
tradeBtn.addEventListener("click", () => { contentMode = "trade"; renderContent(); });
upgradeBtn.addEventListener("click", () => { contentMode = "upgrade"; renderContent(); });
infoBtn.addEventListener("click", () => { contentMode = "info"; renderContent(); });

// 사용자 데이터 로드 및 UI 업데이트
function loadUserData() {
  const userStr = localStorage.getItem("user");
  if (userStr) {
    currentUser = JSON.parse(userStr);
    updateUserUI(currentUser);
  }
}

async function hydrateProgress() {
  if (!currentUser) return;
  const token = localStorage.getItem("access_token");
  if (!token) return;
  try {
    clearPlacedGenerators();
    const res = await loadProgress(currentUser.user_id, token);
    renderSavedGenerators(res.generators);
    startEnergyTimer();
  } catch (e) {
    console.warn("progress load failed", e);
  }
}

// 초기 렌더 및 타입 로드
document.addEventListener("DOMContentLoaded", async () => {
  await loadGeneratorTypes();
  loadUserData();
  renderContent();
  initDropHandlers();
  await hydrateProgress();
});
