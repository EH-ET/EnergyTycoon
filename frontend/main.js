const generatorBtn = document.querySelector(".generator-btn");
const tradeBtn = document.querySelector(".trade-btn");
const upgradeBtn = document.querySelector(".upgrade-btn");
const infoBtn = document.querySelector(".info-btn");
const contentArea = document.querySelector(".content-area");
let contentMode = "generator";

const generators = [
  {"이름": "광합성", "세부설명": "태양을 이용해 에너지를 생산합니다. 낮에만 작동하며 친환경적입니다.", "설치비용": 5, "설치시간(초)": 3, "생산량(에너지)": 1, "크기": 1, "내열한계": 50, "발열": 0},
  {"이름": "풍력", "세부설명": "바람을 이용해 에너지를 생산합니다. 바람이 강할수록 효율이 올라갑니다.", "설치비용": 20, "설치시간(초)": 10, "생산량(에너지)": 5, "크기": 3, "내열한계": 70, "발열": 2},
  {"이름": "지열", "세부설명": "지열을 이용해 안정적으로 전력을 생산합니다. 초기비용이 높지만 안정적입니다.", "설치비용": 50, "설치시간(초)": 30, "생산량(에너지)": 20, "크기": 5, "내열한계": 100, "발열": 5}
];

function makeImageSrcByIndex(idx) {
  const num = Number(idx);
  if (Number.isNaN(num)) return placeholderDataUrl();
  return `/frontend/generator/${num + 1}.png`;
}

// 유틸: 간단한 데이터 URL 플레이스홀더(SVG)
function placeholderDataUrl() {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='180'><rect width='100%' height='100%' fill='%23e0e0e0'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='20' fill='%23666'>이미지 없음</text></svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
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

function generatorMode() {
  contentArea.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "generator-grid";

  generators.forEach((gen, index) => {
    if (!gen || !gen.이름) return;

    const item = document.createElement("div");
    item.className = "generator-item";

    const img = document.createElement("img");
    img.alt = gen.이름;
    img.src = makeImageSrcByIndex(index);

    // 이미지 로드 실패 시 플레이스홀더로 대체
    img.addEventListener("error", () => {
      img.src = placeholderDataUrl();
    });

    // 텍스트 정보
    const info = document.createElement("div");
    info.className = "generator-info";
    Object.assign(info.style, { display: "flex", flexDirection: "column"});

    const title = document.createElement("div");
    title.textContent = gen.이름;
    Object.assign(title.style, { fontWeight: "600", fontSize: "15px", color: "#ffffffff" });

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
  // 우선 오른쪽 위에 배치 시도
  let left = rect.right + margin;
  let top = rect.top;

  // 화면 오른쪽을 벗어나면 왼쪽에 배치
  if (left + modalRect.width > window.innerWidth - 8) {
    left = rect.left - modalRect.width - margin;
  }
  // 아래를 벗어나면 위로 올림
  if (top + modalRect.height > window.innerHeight - 8) {
    top = window.innerHeight - modalRect.height - 8;
  }
  // 최종 위치 적용
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

// 플레이스홀더 모드들(간단한 자리 표시자)
function tradeMode() {
  contentArea.innerHTML = "<div style='padding:12px;color:#444;'>거래 모드(개발 중)</div>";
}
function upgradeMode() {
  contentArea.innerHTML = "<div style='padding:12px;color:#444;'>업그레이드 모드(개발 중)</div>";
}
function infoMode() {
  contentArea.innerHTML = "<div style='padding:12px;color:#444;'>정보 모드(개발 중)</div>";
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

// 버튼에 모드 전환 및 렌더 호출 연결
generatorBtn.addEventListener("click", () => { contentMode = "generator"; renderContent(); });
tradeBtn.addEventListener("click", () => { contentMode = "trade"; renderContent(); });
upgradeBtn.addEventListener("click", () => { contentMode = "upgrade"; renderContent(); });
infoBtn.addEventListener("click", () => { contentMode = "info"; renderContent(); });

// 초기 렌더
document.addEventListener("DOMContentLoaded", () => {
  renderContent();
});