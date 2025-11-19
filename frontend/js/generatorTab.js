// 발전기 목록 탭 렌더링 및 모달 표시
import { generators } from "./data.js";
import { makeImageSrcByIndex, placeholderDataUrl } from "./generatorHelpers.js";
import { dom } from "./ui.js";

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

export function renderGeneratorTab() {
  dom.contentArea.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "generator-grid";

  generators.forEach((gen, index) => {
    if (!gen || !gen.이름) return;

    const item = document.createElement("div");
    item.className = "generator-item";
    item.draggable = true;
    item.dataset.index = index;
    item.dataset.name = gen.이름;
    item.style.touchAction = "none";
    item.style.userSelect = "none";

    const img = document.createElement("img");
    img.alt = gen.이름;
    img.src = makeImageSrcByIndex(index);
    img.draggable = false;
    img.style.pointerEvents = "none";
    img.addEventListener("error", () => {
      img.src = placeholderDataUrl();
    });

    const info = document.createElement("div");
    info.className = "generator-info";
    info.draggable = false;
    info.style.pointerEvents = "none";
    Object.assign(info.style, { display: "flex", flexDirection: "column" });

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

    item.addEventListener("dragstart", (e) => {
      if (!e.dataTransfer) return;
      e.dataTransfer.setData("text/plain", String(index));
      e.dataTransfer.effectAllowed = "copy";
      item.style.opacity = "0.5";
      try {
        const dragImg = img.cloneNode(true);
        dragImg.style.width = "120px";
        dragImg.style.height = "84px";
        dragImg.style.pointerEvents = "none";
        dragImg.style.position = "absolute";
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

    item.addEventListener("dragend", () => {
      item.style.opacity = "1";
    });

    const showModal = () => {
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

    const moveModal = () => {
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

  dom.contentArea.appendChild(grid);
}

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
