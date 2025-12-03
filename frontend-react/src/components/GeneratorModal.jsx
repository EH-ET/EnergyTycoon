import { useState, useEffect } from 'react';
import { useStore, getAuthToken } from '../store/useStore';
import { demolishGenerator, skipGeneratorBuild, updateGeneratorState, upgradeGenerator } from '../utils/apiClient';
import { computeSkipCost } from '../utils/generatorHelpers';
import { formatResourceValue, fromPlainValue, valueFromServer, toPlainValue } from '../utils/bigValue';
import { generators } from '../utils/data';
import AlertModal from './AlertModal';

const DEMOLISH_COST_RATE = 0.5;
const UPGRADE_CONFIG = {
  production: { label: "생산량 증가", desc: "에너지 생산 +10%/레벨, 발열 +0.5/레벨", baseMultiplier: 0.5, growth: 1.25 },
  heat_reduction: { label: "발열 감소", desc: "발열 10% 감소/레벨", baseMultiplier: 0.4, growth: 1.2 },
  tolerance: { label: "내열 증가", desc: "내열 +10/레벨", baseMultiplier: 0.45, growth: 1.2 },
};
const PRODUCTION_UPGRADE_FACTOR = 0.1;

function computeUpgradeCost(entry, key) {
  const cfg = UPGRADE_CONFIG[key];
  if (!cfg) return 0;
  const baseCost = entry.baseCost || 10;
  const current = entry.upgrades?.[key] || 0;
  const level = current + 1;
  return Math.max(1, Math.floor(baseCost * cfg.baseMultiplier * cfg.growth ** level));
}

export default function GeneratorModal({ generator, onClose }) {
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  const [alertMessage, setAlertMessage] = useState('');

  const syncUserState = useStore(state => state.syncUserState);
  const removePlacedGenerator = useStore(state => state.removePlacedGenerator);
  const generatorTypesById = useStore(state => state.generatorTypesById);
  const updatePlacedGenerator = useStore(state => state.updatePlacedGenerator);

  const updateGeneratorEntry = (patcher) => {
    if (!generator?.generator_id) return;
    updatePlacedGenerator(generator.generator_id, (prev) => {
      const base = prev || generator;
      const patch = typeof patcher === 'function' ? patcher(base) : patcher;
      return { ...base, ...(patch || {}) };
    });
  };

  useEffect(() => {
    const updateTimer = () => {
      if (!generator.isDeveloping || !generator.buildCompleteTs) {
        setRemainingTime(0);
        return;
      }
      const remaining = Math.max(0, Math.ceil(((generator.buildCompleteTs || Date.now()) - Date.now()) / 1000));
      setRemainingTime(remaining);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [generator]);

  const handleDemolish = async () => {
    try {
      const token = getAuthToken();
      const res = await demolishGenerator(generator.generator_id, token);

      removePlacedGenerator(generator.generator_id);

      if (res.user) {
        syncUserState(res.user);
      }

      onClose();
    } catch (err) {
      setAlertMessage(err.message || '철거 실패');
    }
  };

  const handleSkip = async () => {
    try {
      const token = getAuthToken();
      const res = await skipGeneratorBuild(generator.generator_id, token);

      if (res.user) {
        syncUserState(res.user);
      }

      if (res.generator) {
        updateGeneratorEntry(() => ({
          isDeveloping: Boolean(res.generator.isdeveloping),
          buildCompleteTs: res.generator.build_complete_ts ? res.generator.build_complete_ts * 1000 : null,
          running: res.generator.running !== false,
          heat: typeof res.generator.heat === 'number' ? res.generator.heat : 0,
          upgrades: res.generator.upgrades || generator.upgrades,
        }));
      }

      onClose();
    } catch (err) {
      setAlertMessage(err.message || '건설 스킵 실패');
    }
  };

  const handleToggleRunning = async () => {
    const id = generator?.generator_id;
    if (!id) {
      setAlertMessage('발전기 ID가 없습니다.');
      return;
    }

    const nextRunning = generator.running === false;
    try {
      const token = getAuthToken();
      const res = await updateGeneratorState(
        id,
        { running: nextRunning, heat: generator.heat },
        token
      );

      const serverRunning = res.generator ? res.generator.running !== false : nextRunning;
      const serverHeat = typeof res.generator?.heat === 'number' ? res.generator.heat : generator.heat;
      updateGeneratorEntry((prev) => ({
        ...prev,
        running: serverRunning,
        heat: typeof serverHeat === 'number' ? serverHeat : prev?.heat,
      }));

      if (res.user) {
        syncUserState(res.user);
      }
    } catch (err) {
      setAlertMessage(err.message || '상태 변경 실패');
    }
  };

  const handleUpgrade = async (key) => {
    try {
      const token = getAuthToken();
      const res = await upgradeGenerator(generator.generator_id, key, 1, token);

      if (res.user) {
        syncUserState(res.user);
      }

      if (res.generator) {
        const upgrades = res.generator.upgrades || generator.upgrades || {};
        updateGeneratorEntry((prev) => ({
          ...prev,
          upgrades,
        }));
      }

      setShowUpgrade(false);
    } catch (err) {
      setAlertMessage(err.message || '업그레이드 실패');
    }
  };

  const typeInfo = generatorTypesById[generator.generator_type_id] || {};
  const baseCost = typeInfo.cost || 0;
  const demolishCostPlain = Math.max(1, Math.round(baseCost * DEMOLISH_COST_RATE));

  // baseTolerance가 없으면 기본값 100 사용
  const baseTolerance = generator.baseTolerance || generator.tolerance || 100;
  const currentUser = useStore(state => state.currentUser);
  const userToleranceBonus = Number(currentUser?.tolerance_bonus) || 0;
  const buffedTolerance = baseTolerance + (generator.upgrades?.tolerance || 0) * 10 + userToleranceBonus * 10;
  
  // Skip cost calculation using cost_data and cost_high directly
  const skipCostValue = (() => {
    if (!generator.isDeveloping || !generator.buildCompleteTs) return fromPlainValue(0);
    const remainingSeconds = Math.max(0, Math.ceil((generator.buildCompleteTs - Date.now()) / 1000));
    const totalDurationSeconds = Math.max(1, Math.ceil((generator.buildDurationMs || generator.baseBuildDurationMs || 2000) / 1000));
    const costValue = valueFromServer(generator.cost_data || typeInfo.cost_data, generator.cost_high || typeInfo.cost_high, baseCost);
    const costPlain = toPlainValue(costValue);
    const skipCostPlain = Math.max(1, Math.ceil((remainingSeconds / totalDurationSeconds) * costPlain));
    return fromPlainValue(skipCostPlain);
  })();
  const isRunning = generator.running !== false && !generator.isDeveloping;
  const statusColor = generator.isDeveloping ? '#4fa3ff' : isRunning ? '#f1c40f' : '#e74c3c';

  const computeProductionPerSec = () => {
    const idx = Number(generator.genIndex);
    const meta = Number.isInteger(idx) && idx >= 0 ? generators[idx] : null;
    if (!meta) return 0;
    const productionValue = valueFromServer(
      meta["생산량(에너지수)"],
      meta["생산량(에너지높이)"],
      meta["생산량(에너지)"]
    );
    const base = Math.max(0, toPlainValue(productionValue));
    const upgradeLevel = generator.upgrades?.production || 0;
    const upgraded = base * (1 + PRODUCTION_UPGRADE_FACTOR * upgradeLevel);
    const bonus = Number(currentUser?.production_bonus) || 0;
    const rebirthCount = Number(currentUser?.rebirth_count) || 0;
    const rebirthMultiplier = rebirthCount > 0 ? Math.pow(2, rebirthCount) : 1;
    return upgraded * (1 + 0.1 * bonus) * rebirthMultiplier;
  };

  const productionPerSec = computeProductionPerSec();

  return (
    <>
      <AlertModal
        message={alertMessage}
        onClose={() => setAlertMessage('')}
      />
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: 'linear-gradient(160deg, #0d1117 0%, #111827 100%)',
          color: '#f6f8fa',
          padding: '22px',
          borderRadius: '14px',
          minWidth: '300px',
          maxWidth: '90vw',
          boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
          border: '1px solid #1f2a3d',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#f6f8fa' }}>{generator.name || '발전기'}</h3>
          <span style={{
            fontSize: '12px',
            padding: '6px 10px',
            borderRadius: '999px',
            background: statusColor,
            color: '#0d1117',
            fontWeight: 800,
            letterSpacing: '0.3px'
          }}>
            {generator.isDeveloping ? '건설 중' : isRunning ? '운영 중' : '중단'}
          </span>
        </div>
        <p style={{ margin: '4px 0 10px', color: '#9ba4b5', fontSize: '13px' }}>
          내열: {Math.round(buffedTolerance)} / 발열: {Math.round(generator.heat || 0)}
        </p>
        {showUpgrade ? (
          <>
            <h3 style={{ marginTop: 0, color: '#f6f8fa' }}>발전기 업그레이드</h3>
            {Object.entries(UPGRADE_CONFIG).map(([key, cfg]) => {
              const level = generator.upgrades?.[key] || 0;
              const cost = computeUpgradeCost(generator, key);

              return (
                <div
                  key={key}
                  style={{
                    border: '1px solid #223148',
                    padding: '10px',
                    borderRadius: '8px',
                    background: '#0f1729',
                    marginBottom: '10px',
                  }}
                >
                  <div style={{ fontWeight: '600' }}>{cfg.label}</div>
                  <p style={{ margin: '4px 0 8px', color: '#9ba4b5' }}>{cfg.desc}</p>
                  <div>레벨: {level}</div>
                  <div style={{ color: '#f1c40f' }}>비용: {formatResourceValue(fromPlainValue(cost))}</div>
                  <button
                    onClick={() => handleUpgrade(key)}
                    style={{
                      marginTop: '6px',
                      width: '100%',
                      background: '#1f6feb',
                      color: '#fff',
                      border: 'none',
                      padding: '10px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    업그레이드
                  </button>
                </div>
              );
            })}
            <button
              onClick={() => setShowUpgrade(false)}
              style={{
                width: '100%',
                marginTop: '12px',
                padding: '10px',
                borderRadius: '10px',
                border: '1px solid #223148',
                background: '#0f1729',
                color: '#c8d1e5',
                cursor: 'pointer',
              }}
            >
              닫기
            </button>
          </>
        ) : (
          <>
            <div style={{ marginBottom: '10px', color: '#9ba4b5' }}>
              철거 비용: <span style={{ color: '#f39c12' }}>{formatResourceValue(fromPlainValue(demolishCostPlain))}</span>
            </div>
            <div style={{ marginBottom: '10px', color: '#c8d1e5' }}>
              초당 생산량: <span style={{ color: '#f1c40f', fontWeight: 800 }}>{productionPerSec.toLocaleString()} /초</span>
            </div>

            {generator.isDeveloping && remainingTime > 0 && (
              <div style={{
                padding: '10px',
                borderRadius: '10px',
                background: '#0f1729',
                border: '1px solid #223148',
                marginBottom: '10px',
                color: '#c8d1e5'
              }}>
                건설 중 ({remainingTime}초 남음)
                <button
                  onClick={handleSkip}
                  style={{
                    width: '100%',
                    marginTop: '8px',
                    padding: '10px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#1f6feb',
                    color: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  즉시 완성 ({formatResourceValue(skipCostValue)})
                </button>
              </div>
            )}

            <div style={{ display: 'grid', gap: '8px', marginTop: '12px' }}>
              <button
                onClick={handleToggleRunning}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: generator.running === false ? '#2ecc71' : '#f39c12',
                  color: '#0d1117',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {generator.running === false ? '운영 재개' : '운영 중단'}
              </button>
              <button
                onClick={() => setShowUpgrade(true)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #223148',
                  background: '#0f1729',
                  color: '#c8d1e5',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                업그레이드
              </button>
              <button
                onClick={handleDemolish}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#e74c3c',
                  color: '#fff',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                철거 (비용 {formatResourceValue(fromPlainValue(demolishCostPlain))})
              </button>
              <button
                onClick={onClose}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #223148',
                  background: '#0d1117',
                  color: '#9ba4b5',
                  cursor: 'pointer'
                }}
              >
                닫기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
    </>
  );
}
