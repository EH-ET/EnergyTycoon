import { useEffect, useRef, useState } from 'react';
import { useStore, getAuthToken } from '../store/useStore';
import { generators } from '../utils/data';
import { saveProgress } from '../utils/apiClient';
import { makeImageSrcByIndex, computeMaxGenerators } from '../utils/generatorHelpers';
import { dispatchTutorialEvent, TUTORIAL_EVENTS } from '../utils/tutorialEvents';
import GeneratorModal from './GeneratorModal';
import AlertModal from './AlertModal';
import { clampOffset, SCROLL_RANGE, BG_FALLBACK_WIDTH } from '../hooks/useViewport';
import { valueFromServer, toPlainValue, formatResourceValue, fromPlainValue } from '../utils/bigValue';

const DEFAULT_TOLERANCE = 100;

export default function Main() {
  const [dragOver, setDragOver] = useState(false);
  const [selectedGeneratorId, setSelectedGeneratorId] = useState(null);
  const [alertMessage, setAlertMessage] = useState('');
  const mainRef = useRef(null);
  const scrollSyncRef = useRef(false);

  const placedGenerators = useStore(state => state.placedGenerators);
  const selectedGenerator = useStore(
    state => state.placedGenerators.find(pg => {
      if (!selectedGeneratorId) return false;
      const target = String(selectedGeneratorId);
      if (pg?.generator_id != null && String(pg.generator_id) === target) return true;
      if (pg?.id != null && String(pg.id) === target) return true;
      return false;
    })
  );
  const userOffsetX = useStore(state => state.userOffsetX);
  const currentUser = useStore(state => state.currentUser);
  const syncUserState = useStore(state => state.syncUserState);
  const addPlacedGenerator = useStore(state => state.addPlacedGenerator);
  const compareMoneyWith = useStore(state => state.compareMoneyWith);
  const generatorTypeInfoMap = useStore(state => state.generatorTypeInfoMap);
  const generatorTypeMap = useStore(state => state.generatorTypeMap);
  const generatorTypesById = useStore(state => state.generatorTypesById);
  const setUserOffsetX = useStore(state => state.setUserOffsetX);
  const backgroundWidth = useStore(state => state.backgroundWidth);
  const worldWidth = backgroundWidth || SCROLL_RANGE || BG_FALLBACK_WIDTH;

  useEffect(() => {
    if (selectedGeneratorId && !selectedGenerator) {
      setSelectedGeneratorId(null);
    }
  }, [selectedGeneratorId, selectedGenerator]);
  const setBackgroundSize = useStore(state => state.setBackgroundSize);

  // Tutorial: Detect scroll
  useEffect(() => {
    const handleScroll = (e) => {
      if (currentUser?.tutorial === 1) {
        dispatchTutorialEvent(TUTORIAL_EVENTS.SCROLL);
      }
    };
    
    const mainEl = mainRef.current;
    if (mainEl) {
      mainEl.addEventListener('scroll', handleScroll);
      return () => mainEl.removeEventListener('scroll', handleScroll);
    }
  }, [currentUser]);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const idx = e.dataTransfer.getData('text/plain');
    if (idx === '') return;

    const rect = e.currentTarget.getBoundingClientRect();
    const screenX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const worldX = Math.max(0, Math.min(worldWidth, Math.round(screenX - (Number(userOffsetX) || 0))));
    const gen = generators[Number(idx)];
    if (!gen) return;

    if (!currentUser) {
      setAlertMessage('설치하려면 로그인 필요합니다.');
      return;
    }

    const genInfo = generatorTypeInfoMap[gen.이름];
    const genTypeId = genInfo ? genInfo.id : generatorTypeMap[gen.이름];
    const cost = genInfo && typeof genInfo.cost === 'number' ? genInfo.cost : gen.설치비용;

    if (!genTypeId) {
      setAlertMessage('서버에서 발전기 정보를 불러오지 못했습니다.');
      return;
    }

    if (compareMoneyWith(cost) < 0) {
      setAlertMessage('돈이 부족합니다.');
      return;
    }

    const maxAllowed = computeMaxGenerators(currentUser);
    if (placedGenerators.length >= maxAllowed) {
      setAlertMessage(`최대 발전기 수(${maxAllowed})를 초과했습니다.`);
      return;
    }

    try {
      const token = getAuthToken();
      const res = await saveProgress(
        currentUser.user_id,
        genTypeId,
        worldX,
        0,
        token,
        currentUser.energy
      );

      if (res.user) {
        syncUserState(res.user);
      }

      const typeInfo = generatorTypesById[res.generator.generator_type_id] || {};
      const idxFromType = Number.isInteger(typeInfo.index) ? typeInfo.index : null;
      let genIndex = idxFromType;

      if (genIndex == null || genIndex < 0 || genIndex >= generators.length) {
        const idAsNumber = Number(res.generator.generator_type_id);
        if (Number.isFinite(idAsNumber) && idAsNumber >= 0 && idAsNumber < generators.length) {
          genIndex = idAsNumber;
        }
      }

      const genName = typeInfo.name || generators[genIndex]?.이름 || gen.이름;
      const metaByIndex = genIndex != null && genIndex >= 0 && genIndex < generators.length
        ? generators[genIndex]
        : null;
      const tolerance = Number(metaByIndex?.내열한계 ?? gen.내열한계) || DEFAULT_TOLERANCE;
      const heatRate = Number(metaByIndex?.발열 ?? gen.발열) || 0;

      const entry = {
        x: worldX,
        x_position: res.generator.x_position ?? worldX,
        world_position: res.generator.world_position ?? 0,
        name: genName,
        genIndex,
        generator_id: res.generator.generator_id,
        generator_type_id: res.generator.generator_type_id,
        level: res.generator.level || 1,
        baseCost: cost,
        cost_data: res.generator.cost_data,
        cost_high: res.generator.cost_high,
        isDeveloping: Boolean(res.generator.isdeveloping),
        buildCompleteTs: res.generator.build_complete_ts ? res.generator.build_complete_ts * 1000 : null,
        running: res.generator.running !== false,
        heat: typeof res.generator.heat === 'number' ? res.generator.heat : 0,
        tolerance,
        baseTolerance: tolerance,
        heatRate,
        upgrades: res.generator.upgrades || { production: 0, heat_reduction: 0, tolerance: 0 },
      };

      addPlacedGenerator(entry);
      
      // Tutorial: Detect generator purchase
      if (currentUser?.tutorial === 2) {
        dispatchTutorialEvent(TUTORIAL_EVENTS.BUY_GENERATOR);
      }
    } catch (err) {
      setAlertMessage('설치 실패: ' + (err.message || err));
    }
  };

  const getGeneratorSize = (name) => {
    const gen = generators.find(g => g?.이름 === name);
    const sizeFactor = gen?.크기 || 1;
    return Math.max(32, Math.min(300, sizeFactor * 50));
  };

  const handleWheelScroll = (e) => {
    const container = mainRef.current;
    if (!container) return;
    const deltaRaw = Math.abs(e.deltaX) >= Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    // 스크롤 방향을 직관적으로 좌우 이동하도록 반전
    const delta = -deltaRaw;
    if (!delta) return;
    const viewWidth = container.clientWidth || 0;
    const current = userOffsetX || 0;
    const next = clampOffset(current + delta, worldWidth, viewWidth);
    const targetScroll = Math.max(0, -next);
    scrollSyncRef.current = true;
    container.scrollLeft = targetScroll;
    requestAnimationFrame(() => { scrollSyncRef.current = false; });
    setUserOffsetX(next);
  };

  const handleScroll = () => {
    if (scrollSyncRef.current) return;
    const container = mainRef.current;
    if (!container) return;
    const scrollLeft = container.scrollLeft || 0;
    const viewWidth = container.clientWidth || 0;
    const clamped = clampOffset(-scrollLeft, worldWidth, viewWidth);
    if (clamped !== userOffsetX) {
      setUserOffsetX(clamped);
    }
  };

  // 배경 이미지 크기 측정 후 오프셋 클램프 (1회)
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const img = new Image();
    img.onload = () => {
      const height = el.clientHeight || img.naturalHeight || 1;
      const scale = height / Math.max(1, img.naturalHeight);
      const width = (img.naturalWidth || BG_FALLBACK_WIDTH) * scale;
      setBackgroundSize(width, height);
      setUserOffsetX((prev) => clampOffset(prev || 0, width, el.clientWidth || 0));
    };
    img.onerror = () => {
      const width = backgroundWidth || SCROLL_RANGE || BG_FALLBACK_WIDTH;
      setUserOffsetX((prev) => clampOffset(prev || 0, width, el.clientWidth || 0));
    };
    img.src = '/backgroundImgEhET.png';

    const handleResize = () => {
      const width = backgroundWidth || SCROLL_RANGE || BG_FALLBACK_WIDTH;
      setUserOffsetX((prev) => clampOffset(prev || 0, width, el.clientWidth || 0));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  // backgroundWidth/setters are stable from zustand; run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const container = mainRef.current;
    if (!container) return;
    const target = Math.max(0, -(userOffsetX || 0));
    if (Math.abs((container.scrollLeft || 0) - target) > 1) {
      scrollSyncRef.current = true;
      container.scrollLeft = target;
      requestAnimationFrame(() => { scrollSyncRef.current = false; });
    }
  }, [userOffsetX]);

  return (
    <>
      <main>
        <div
          className={`main ${dragOver ? 'drag-over' : ''}`}
          onWheel={handleWheelScroll}
          onScroll={handleScroll}
          ref={mainRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            position: 'relative'
          }}
        >
          <div
            className="main-content"
            style={{
              backgroundImage: 'url(/backgroundImgEhET.png)',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: '0 0',
              backgroundSize: 'auto 100%',
              width: `${worldWidth}px`
            }}
          >
            {placedGenerators.map((generator) => {
              const baseX = typeof generator.x_position === 'number'
                ? generator.x_position
                : (typeof generator.world_position === 'number'
                  ? generator.world_position
                  : (typeof generator.x === 'number' ? generator.x : 0));
              const screenX = baseX;
              const width = getGeneratorSize(generator.name);
              const isRunning = generator.running !== false && !generator.isDeveloping;
              const nameColor = generator.isDeveloping
                ? '#4fa3ff'
                : isRunning
                  ? '#f1c40f'
                  : '#e74c3c';

              // 원래 위치 계산 방식과 동일하게
              const containerHeight = 600; // main 영역 대략적인 높이
              const defaultY = Math.max(32, containerHeight - 60);

              // Helper calculations for tooltip
              const getBaseProduction = () => {
                const idx = Number(generator.genIndex);
                const meta = Number.isInteger(idx) && idx >= 0 ? generators[idx] : null;
                if (!meta) return 0;
                const productionValue = valueFromServer(
                  meta["생산량(에너지수)"],
                  meta["생산량(에너지높이)"],
                  meta["생산량(에너지)"]
                );
                return Math.max(0, toPlainValue(productionValue));
              };

              const computeProduction = () => {
                const base = getBaseProduction();
                const bonus = Number(currentUser?.production_bonus) || 0;
                const rebirthCount = Number(currentUser?.rebirth_count) || 0;
                const energyMultiplier = Number(currentUser?.energy_multiplier) || 0;
                const rebirthMultiplier = rebirthCount > 0 ? Math.pow(2, rebirthCount) : 1;
                const energyMult = energyMultiplier > 0 ? Math.pow(2, energyMultiplier) : 1;
                const level = generator.upgrades?.production || 0;
                const upgraded = base * (1 + 0.1 * level); // PRODUCTION_UPGRADE_FACTOR = 0.1
                return upgraded * (1 + 0.1 * bonus) * rebirthMultiplier * energyMult;
              };

              const computeHeatRate = () => {
                const baseHeat = Number(generator.heatRate) || 0;
                const upgrades = generator.upgrades || {};
                const prodLevel = Number(upgrades.production) || 0;
                const level = Number(upgrades.heat_reduction) || 0;
                
                const productionHeat = prodLevel * 0.5;
                const reductionMultiplier = Math.pow(0.9, level);
                const userHeatReduction = Number(currentUser?.heat_reduction) || 0;
                
                let totalHeat = baseHeat + productionHeat;
                totalHeat = totalHeat * reductionMultiplier;
                if (userHeatReduction > 0) {
                  totalHeat = totalHeat * (1 - userHeatReduction / 100);
                }
                return Math.max(0, totalHeat);
              };

              const computeTolerance = () => {
                const base = generator.baseTolerance || 100;
                const userBonus = Number(currentUser?.tolerance_bonus) || 0;
                const level = generator.upgrades?.tolerance || 0;
                return base + (level * 10) + (userBonus * 10);
              };

              const prodPerSec = computeProduction();
              const heatRate = computeHeatRate();
              const tolerance = computeTolerance();

              return (
                <div
                  key={generator.generator_id}
                  className="placed-generator"
                  onClick={() => {
                    const id = generator.generator_id ?? generator.id;
                    if (id != null) {
                      setSelectedGeneratorId(id);
                      // Tutorial: Detect generator click
                      if (currentUser?.tutorial === 9) {
                        dispatchTutorialEvent(TUTORIAL_EVENTS.CLICK_GENERATOR);
                      }
                    }
                  }}
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  style={{
                    position: 'absolute',
                    left: `${screenX}px`,
                    top: `${defaultY}px`,
                    transform: 'translate(-50%, -100%)',
                    pointerEvents: 'auto',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                  >
                    {/* Tooltip */}
                    <div className="generator-tooltip">
                      <div style={{ color: '#f1c40f', fontWeight: 'bold' }}>
                        ⚡ {formatResourceValue(fromPlainValue(prodPerSec))}/s
                      </div>
                      <div style={{ color: '#e74c3c', fontSize: '11px', marginTop: '2px' }}>
                        🔥 {Math.round(generator.heat || 0)} / {Math.round(tolerance)} (+{heatRate.toFixed(1)}/s)
                      </div>
                    </div>

                    <img
                      src={makeImageSrcByIndex(generator.genIndex)}
                      alt={generator.name}
                      width={width}
                      draggable={false}
                      onDragStart={(e) => e.preventDefault()}
                      style={{
                        display: 'block',
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))'
                      }}
                    onError={(e) => {
                      e.target.src = 'data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" width=\"120\" height=\"84\"%3E%3Crect fill=\"%23333\" width=\"120\" height=\"84\"/%3E%3C/svg%3E';
                    }}
                  />
                  {generator.isDeveloping && (
                    <img
                      src="/generator/build.png"
                      alt="건설 중"
                      className="build-overlay"
                      style={{
                        position: 'absolute',
                        top: '-20px',
                        left: '50%',
                        transform: 'translate(-50%, 0)',
                        width: '48px',
                        pointerEvents: 'none'
                      }}
                    />
                  )}
                  <div style={{ fontSize: '16px', fontWeight: '900', color: nameColor }}>
                    {generator.name}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
      {selectedGenerator && (
        <GeneratorModal
          generator={selectedGenerator}
          onClose={() => setSelectedGeneratorId(null)}
        />
      )}
      <AlertModal
        message={alertMessage}
        onClose={() => setAlertMessage('')}
      />
    </>
  );
}
