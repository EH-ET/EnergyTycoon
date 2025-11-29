import { useState } from 'react';
import { createPortal } from 'react-dom';
import { generators } from '../../utils/data';
import { valueFromServer, formatResourceValue } from '../../utils/bigValue';

export default function GeneratorTab() {
  const makeImageSrc = (index) => `/generator/${index + 1}.png`;
  const [hovered, setHovered] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  return (
    <>
      <div className="generator-grid">
        {generators.map((gen, index) => {
          if (!gen || !gen.이름) return null;

          const cost = valueFromServer(gen["설치비용(수)"], gen["설치비용(높이)"], gen.설치비용);
          const production = valueFromServer(gen["생산량(에너지수)"], gen["생산량(에너지높이)"], gen["생산량(에너지)"]);

          return (
            <div
              key={index}
            className="generator-item"
            draggable
            data-index={index}
            data-name={gen.이름}
            style={{ touchAction: 'none', userSelect: 'none', position: 'relative' }}
            onDragStart={(e) => {
              if (!e.dataTransfer) return;
              e.dataTransfer.setData('text/plain', String(index));
              e.dataTransfer.effectAllowed = 'copy';
              e.currentTarget.style.opacity = '0.5';
            }}
            onDragEnd={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setHovered({ gen, cost, production });
              setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
            }}
            onMouseMove={(e) => {
              setTooltipPos({ x: e.clientX, y: e.clientY });
            }}
            onMouseLeave={() => setHovered(null)}
          >
            <img
              src={makeImageSrc(index)}
              alt={gen.이름}
              draggable={false}
                style={{ pointerEvents: 'none' }}
                onError={(e) => {
                  e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="84"%3E%3Crect fill="%23333" width="120" height="84"/%3E%3C/svg%3E';
                }}
              />
              <div className="generator-info" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontWeight: '600', fontSize: '15px', color: '#ffffffff' }}>
                  {gen.이름}
                </div>
                <div className="generator-stats">
                  <p style={{ fontSize: '13px', color: '#ffffffff', margin: 0 }}>
                    설치비용: {formatResourceValue(cost)}
                  </p>
                  <p style={{ fontSize: '13px', color: '#ffffffff', margin: 0 }}>
                    생산량: {formatResourceValue(production)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {hovered && createPortal(
        <div
          style={{
            position: 'fixed',
            left: `${Math.min(Math.max(tooltipPos.x - 110, 8), window.innerWidth - 230)}px`,
            top: `${Math.min(Math.max(tooltipPos.y - 140, 8), window.innerHeight - 180)}px`,
            zIndex: 5000,
            maxWidth: '220px',
            padding: '10px',
            background: 'rgba(0,0,0,0.9)',
            color: '#fff',
            borderRadius: '8px',
            boxShadow: '0 8px 22px rgba(0,0,0,0.45)',
            pointerEvents: 'none',
            fontSize: '13px',
            lineHeight: 1.35,
          }}
        >
          {hovered.gen.세부설명 && (
            <div style={{ marginBottom: '6px' }}>{hovered.gen.세부설명}</div>
          )}
          <p style={{ margin: '0 0 4px', opacity: 0.9 }}>
            설치비용: {formatResourceValue(hovered.cost)}
          </p>
          <p style={{ margin: '0 0 4px', opacity: 0.9 }}>
            설치시간: {hovered.gen["설치시간(초)"]}s
          </p>
          <p style={{ margin: '0 0 4px', opacity: 0.9 }}>
            생산량: {formatResourceValue(hovered.production)}
          </p>
          <p style={{ margin: '0 0 4px', opacity: 0.9 }}>
            크기: {hovered.gen.크기 || 0}
          </p>
          <p style={{ margin: '0 0 4px', opacity: 0.9 }}>
            발열: {hovered.gen.발열 || 0}
          </p>
          <p style={{ margin: 0, opacity: 0.9 }}>
            내열한계: {hovered.gen.내열한계}
          </p>
        </div>,
        document.body
      )}
    </>
  );
}
