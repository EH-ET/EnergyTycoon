import { useState, useEffect } from 'react';
import { useStore, getAuthToken } from '../store/useStore';
import { demolishGenerator, skipGeneratorBuild, updateGeneratorState, upgradeGenerator } from '../utils/apiClient';
import { computeSkipCost } from '../utils/generatorHelpers';
import { formatResourceValue, fromPlainValue } from '../utils/bigValue';
import AlertModal from './AlertModal';

const DEMOLISH_COST_RATE = 0.5;
const UPGRADE_CONFIG = {
  production: { label: "생산량 증가", desc: "에너지 생산 +10%/레벨, 발열 +0.5/레벨", baseMultiplier: 0.5, growth: 1.25 },
  heat_reduction: { label: "발열 감소", desc: "발열 10% 감소/레벨", baseMultiplier: 0.4, growth: 1.2 },
  tolerance: { label: "내열 증가", desc: "내열 +10/레벨", baseMultiplier: 0.45, growth: 1.2 },
};

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
      const res = await skipGeneratorBuild(generator.generator_id);

      if (res.user) {
        syncUserState(res.user);
      }

      if (res.generator) {
        updateGeneratorEntry(() => ({
          isDeveloping: Boolean(res.generator.isdeveloping),
          buildCompleteTs: res.generator.build_complete_ts ? res.generator.build_complete_ts * 1000 : null,
          running: res.generator.running !== false,
          heat: typeof res.generator.heat === 'number' ? res.generator.heat : 0,
        }));
      }

      onClose();
    } catch (err) {
      setAlertMessage(err.message || '건설 스킵 실패');
    }
  };

  const handleToggleRunning = async () => {
    try {
      const res = await updateGeneratorState(generator.generator_id, {
        running: generator.running === false,
        heat: generator.heat,
      });

      const nextRunning = res.generator ? res.generator.running !== false : generator.running === false;
      const nextHeat = typeof res.generator?.heat === 'number' ? res.generator.heat : generator.heat;
      updateGeneratorEntry((prev) => ({
        ...prev,
        running: nextRunning,
        heat: typeof nextHeat === 'number' ? nextHeat : prev?.heat,
      }));

      if (res.user) {
        syncUserState(res.user);
      }

      onClose();
    } catch (err) {
      setAlertMessage(err.message || '상태 변경 실패');
    }
  };

  const handleUpgrade = async (key) => {
    try {
      const res = await upgradeGenerator(generator.generator_id, key, 1);

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
  const demolishCost = Math.max(1, Math.round(baseCost * DEMOLISH_COST_RATE));

  // baseTolerance가 없으면 기본값 100 사용
  const baseTolerance = generator.baseTolerance || generator.tolerance || 100;
  const buffedTolerance = baseTolerance + (generator.upgrades?.tolerance || 0) * 10;
  const skipCost = computeSkipCost(generator);

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
          background: '#111',
          color: '#fff',
          padding: '20px',
          borderRadius: '8px',
          minWidth: '260px',
          boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
        }}
      >
        {showUpgrade ? (
          <>
            <h3 style={{ marginTop: 0 }}>발전기 업그레이드</h3>
            {Object.entries(UPGRADE_CONFIG).map(([key, cfg]) => {
              const level = generator.upgrades?.[key] || 0;
              const cost = computeUpgradeCost(generator, key);

              return (
                <div
                  key={key}
                  style={{
                    border: '1px solid #333',
                    padding: '10px',
                    borderRadius: '8px',
                    background: '#141414',
                    marginBottom: '10px',
                  }}
                >
                  <div style={{ fontWeight: '600' }}>{cfg.label}</div>
                  <p style={{ margin: '4px 0 8px', color: '#c9c9c9' }}>{cfg.desc}</p>
                  <div>레벨: {level}</div>
                  <div style={{ color: '#f1c40f' }}>비용: {formatResourceValue(fromPlainValue(cost))}</div>
                  <button
                    onClick={() => handleUpgrade(key)}
                    style={{ marginTop: '6px', width: '100%' }}
                  >
                    업그레이드
                  </button>
                </div>
              );
            })}
            <button onClick={() => setShowUpgrade(false)} style={{ width: '100%', marginTop: '12px' }}>
              닫기
            </button>
          </>
        ) : (
          <>
            <h3 style={{ marginTop: 0 }}>{generator.name || '발전기'}</h3>
            <p>철거 비용: {demolishCost} 돈</p>
            <p style={{ margin: '4px 0' }}>발열: {Math.round(generator.heat || 0)} / {buffedTolerance}</p>
            <p style={{ margin: '0' }}>내열 증가: +{(generator.upgrades?.tolerance || 0) * 10}</p>

            {generator.isDeveloping && remainingTime > 0 && (
              <>
                <p style={{ margin: '6px 0' }}>건설 중 ({remainingTime}초 남음)</p>
                <button onClick={handleSkip} style={{ width: '100%', marginBottom: '8px' }}>
                  즉시 완성 ({formatResourceValue(fromPlainValue(skipCost))})
                </button>
              </>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button onClick={onClose} style={{ flex: 1 }}>
                닫기
              </button>
              <button
                onClick={handleDemolish}
                style={{ flex: 1, background: '#c0392b', color: '#fff' }}
              >
                철거 (비용 {demolishCost})
              </button>
              <button
                onClick={handleToggleRunning}
                style={{
                  flex: 1,
                  background: generator.running === false ? '#27ae60' : '#f39c12',
                  color: '#fff',
                }}
              >
                {generator.running === false ? '운영 재개' : '운영 중단'}
              </button>
              <button
                onClick={() => setShowUpgrade(true)}
                style={{ flex: 1, background: '#2980b9', color: '#fff' }}
              >
                업그레이드
              </button>
            </div>
          </>
        )}
      </div>
    </div>
    </>
  );
}
