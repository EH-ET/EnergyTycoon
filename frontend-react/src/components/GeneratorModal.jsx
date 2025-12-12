import { useState, useEffect } from 'react';
import { useStore, getAuthToken } from '../store/useStore';
import { demolishGenerator, skipGeneratorBuild, updateGeneratorState } from '../utils/apiClient';
import { computeSkipCost } from '../utils/generatorHelpers';
import { formatResourceValue, fromPlainValue, valueFromServer, toPlainValue, multiplyByFloat } from '../utils/bigValue';
import { generators } from '../utils/data';
import { dispatchTutorialEvent, TUTORIAL_EVENTS } from '../utils/tutorialEvents';
import AlertModal from './AlertModal';

const DEMOLISH_COST_RATE = 0.5;
const UPGRADE_CONFIG = {
  production: { label: "생산량 증가", desc: "에너지 생산 +10%/레벨, 발열 +0.5/레벨", baseMultiplier: 1, growth: 1.25 },
  heat_reduction: { label: "발열 감소", desc: "발열 10% 감소/레벨", baseMultiplier: 0.8, growth: 1.2 },
  tolerance: { label: "내열 증가", desc: "내열 +10/레벨", baseMultiplier: 0.9, growth: 1.2 },
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
  const [remainingTime, setRemainingTime] = useState(0);
  const [alertMessage, setAlertMessage] = useState('');
  const [confirmDemolish, setConfirmDemolish] = useState(false);

  const syncUserState = useStore(state => state.syncUserState);
  const removePlacedGenerator = useStore(state => state.removePlacedGenerator);
  const generatorTypesById = useStore(state => state.generatorTypesById);
  const updatePlacedGenerator = useStore(state => state.updatePlacedGenerator);
  const addGeneratorUpgradeToQueue = useStore(state => state.addGeneratorUpgradeToQueue);


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

  const handleDemolishClick = () => {
    setConfirmDemolish(true);
  };

  const handleDemolish = async () => {
    setConfirmDemolish(false);
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

      // Preserve current energy and money values (only update money for cost deduction)
      if (res.user) {
        const currentEnergy = useStore.getState().getEnergyValue();
        syncUserState({
          ...res.user,
          energy_data: currentEnergy.data,
          energy_high: currentEnergy.high,
        });
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
    
    // 즉시 로컬 상태 업데이트 (서버 호출 없이)
    // useAutosave가 2분마다 자동으로 서버에 저장합니다
    updateGeneratorEntry((prev) => ({
      ...prev,
      running: nextRunning,
    }));
  };

  const handleUpgrade = async (key) => {
    try {
      // 1. 비용 계산
      const cost = computeUpgradeCost(generator, key);
      const { compareMoneyWith, subtractFromMoney } = useStore.getState();

      // 2. 돈 체크
      if (compareMoneyWith(cost) < 0) {
        setAlertMessage('돈이 부족합니다.');
        return;
      }

      // 3. 즉시 로컬 상태 업데이트 (Optimistic Update)
      subtractFromMoney(cost);
      const currentLevel = generator.upgrades?.[key] || 0;
      const newUpgrades = {
        ...(generator.upgrades || {}),
        [key]: currentLevel + 1,
      };

      updateGeneratorEntry((prev) => ({
        ...prev,
        upgrades: newUpgrades,
      }));

      // 4. 업그레이드 큐에 추가
      addGeneratorUpgradeToQueue({
        generator_id: generator.generator_id,
        key,
        amount: 1,
      });


      // Tutorial: Detect generator production upgrade
      if (key === 'production') {
        dispatchTutorialEvent(TUTORIAL_EVENTS.UPGRADE_GENERATOR_PRODUCTION);
      }
    } catch (err) {
      setAlertMessage(err.message || '업그레이드 실패');
      // 실패 시 서버에서 올바른 상태를 받아오도록 페이지 새로고침 권장
      // 또는 여기서 상태 롤백 로직 추가 가능
    }

    // 🚨 튜토리얼 이벤트 발송 로직: Step 13에서 생산량 업그레이드(production)를 클릭해야 합니다.
    if (currentUser?.tutorial === 13 && key === 'production') {
      dispatchTutorialEvent(TUTORIAL_EVENTS.UPGRADE_GENERATOR_PRODUCTION);
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
  
  // Skip cost calculation using BigValue directly (matches backend logic)
  const skipCostValue = (() => {
    if (!generator.isDeveloping || !generator.buildCompleteTs) return fromPlainValue(0);
    const remainingSeconds = Math.max(0, Math.ceil((generator.buildCompleteTs - Date.now()) / 1000));
    const totalDurationSeconds = Math.max(1, typeInfo.install_seconds || Math.ceil((generator.buildDurationMs || generator.baseBuildDurationMs || 2000) / 1000));
    const costValue = valueFromServer(generator.cost_data || typeInfo.cost_data, generator.cost_high || typeInfo.cost_high, baseCost);

    // Calculate proportion and multiply BigValue using multiplyByFloat (same as backend)
    const proportion = remainingSeconds / totalDurationSeconds;
    let skipCost = multiplyByFloat(costValue, proportion);
    // Reduce cost by 10x (same as backend)
    skipCost = multiplyByFloat(skipCost, 0.1);

    // Ensure at least cost of 1
    if (skipCost.data === 0 && skipCost.high === 0) {
      return fromPlainValue(1);
    }

    return skipCost;
  })();
  const isRunning = generator.running !== false && !generator.isDeveloping;
  const statusColor = generator.isDeveloping ? '#4fa3ff' : isRunning ? '#f1c40f' : '#e74c3c';

  // Helper to get base production
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

  const computeProduction = (level) => {
    const base = getBaseProduction();
    const bonus = Number(currentUser?.production_bonus) || 0;
    const rebirthCount = Number(currentUser?.rebirth_count) || 0;
    const energyMultiplier = Number(currentUser?.energy_multiplier) || 0;
    const rebirthMultiplier = rebirthCount > 0 ? Math.pow(2, rebirthCount) : 1;
    const energyMult = energyMultiplier > 0 ? Math.pow(2, energyMultiplier) : 1;
    
    const upgraded = base * (1 + PRODUCTION_UPGRADE_FACTOR * level);
    return upgraded * (1 + 0.1 * bonus) * rebirthMultiplier * energyMult;
  };

  const computeHeatRate = (level, prodLevel) => {
    const baseHeat = Number(generator.heatRate) || 0; // 기본 발열
    // 생산량 업그레이드에 따른 발열 증가: +0.5 per level
    const productionHeat = Number(prodLevel) * 0.5;
    
    // 발열 감소 업그레이드: 10% 감소 per level (곱연산 적용: 0.9^level)
    const reductionMultiplier = Math.pow(0.9, Number(level));
    
    const userHeatReduction = Number(currentUser?.heat_reduction) || 0;
    
    // 기본 발열 + 생산 업그레이드 발열
    let totalHeat = baseHeat + productionHeat;
    
    // 발열 감소 적용
    totalHeat = totalHeat * reductionMultiplier;
    
    // 유저 보너스: 10% 감소 per level (max 90% reduction)
    const userMultiplier = Math.max(0.1, 1 - userHeatReduction * 0.1);
    totalHeat = totalHeat * userMultiplier;
    
    return Math.max(0, totalHeat);
  };

  const computeTolerance = (level) => {
    const base = generator.baseTolerance || 100;
    const userBonus = Number(currentUser?.tolerance_bonus) || 0;
    // 내열 증가: +10 per level
    return base + (level * 10) + (userBonus * 10);
  };

  const productionPerSec = computeProduction(generator.upgrades?.production || 0);
  
  // 현재 발열량 계산
  const currentHeatRate = computeHeatRate(
    generator.upgrades?.heat_reduction || 0,
    generator.upgrades?.production || 0
  );

  const renderUpgradeDesc = (key, currentLevel) => {
    if (key === 'production') {
      const curr = computeProduction(currentLevel);
      const next = computeProduction(currentLevel + 1);
      return (
        <div style={{ fontSize: '12px', color: '#9ba4b5' }}>
          생산량: <span style={{ color: '#f1c40f' }}>{formatResourceValue(fromPlainValue(curr))}</span>
          {' → '}
          <span style={{ color: '#2ecc71' }}>{formatResourceValue(fromPlainValue(next))}</span>
        </div>
      );
    }
    if (key === 'heat_reduction') {
      // 발열 감소는 생산량 레벨에 의존하므로 현재 생산량 레벨 사용
      const prodLevel = generator.upgrades?.production || 0;
      const curr = computeHeatRate(currentLevel, prodLevel);
      const next = computeHeatRate(currentLevel + 1, prodLevel);
      return (
        <div style={{ fontSize: '12px', color: '#9ba4b5' }}>
          발열: <span style={{ color: '#e74c3c' }}>{curr.toFixed(2)}/초</span>
          {' → '}
          <span style={{ color: '#2ecc71' }}>{next.toFixed(2)}/초</span>
        </div>
      );
    }
    if (key === 'tolerance') {
      const curr = computeTolerance(currentLevel);
      const next = computeTolerance(currentLevel + 1);
      return (
        <div style={{ fontSize: '12px', color: '#9ba4b5' }}>
          내열: <span style={{ color: '#f1c40f' }}>{curr}</span>
          {' → '}
          <span style={{ color: '#2ecc71' }}>{next}</span>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <AlertModal
        message={alertMessage}
        onClose={() => setAlertMessage('')}
      />
      {confirmDemolish && (
        <AlertModal
          message={`이 발전기를 철거하시겠습니까? 비용: ${formatResourceValue(fromPlainValue(demolishCostPlain))}`}
          onClose={() => setConfirmDemolish(false)}
          onConfirm={handleDemolish}
        />
      )}
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
          minWidth: '700px', // Split view requires more width
          maxWidth: '95vw',
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

        {/* Split View: Left (Info) / Right (Upgrades) */}
        <div style={{ display: 'flex', gap: '20px', flexDirection: 'row', flexWrap: 'wrap' }}>
          {/* Left Column: Generator Info */}
          <div style={{ flex: '1 1 280px' }}>
            <p style={{ margin: '4px 0 10px', color: '#9ba4b5', fontSize: '13px' }}>
              내열: {Math.round(buffedTolerance)} / 발열: {Math.round(generator.heat || 0)} 
              <span style={{ color: '#e74c3c', marginLeft: '6px' }}>(+{currentHeatRate.toFixed(2)}/초)</span>
            </p>

            <div style={{ marginBottom: '10px', color: '#9ba4b5' }}>
              철거 비용: <span style={{ color: '#f39c12' }}>{formatResourceValue(fromPlainValue(demolishCostPlain))}</span>
            </div>
            <div style={{ marginBottom: '10px', color: '#c8d1e5' }}>
              초당 생산량: <span style={{ color: '#f1c40f', fontWeight: 800 }}>{formatResourceValue(fromPlainValue(productionPerSec))} /초</span>
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
                onClick={handleDemolishClick}
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
          </div>

          {/* Right Column: Upgrades */}
          <div style={{ flex: '1 1 280px' }}>
            <h4 style={{ marginTop: 0, marginBottom: '12px', color: '#f6f8fa' }}>업그레이드</h4>
            {Object.entries(UPGRADE_CONFIG).map(([key, cfg]) => {
              const level = generator.upgrades?.[key] || 0;
              const cost = computeUpgradeCost(generator, key);

              // 🚨 Step 13 타겟 (생산량 업그레이드) 클래스 추가
              const isProductionUpgrade = key === 'production';
              const tutorialHighlightClass = (currentUser?.tutorial === 13 && isProductionUpgrade) 
                ? 'tutorial-upgrade-production' 
                : '';

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
                  <div style={{ fontWeight: '600', marginBottom: '4px' }}>{cfg.label}</div>
                  {renderUpgradeDesc(key, level)}
                  <div style={{ marginTop: '4px', fontSize: '13px' }}>레벨: {level}</div>
                  <div style={{ color: '#f1c40f', fontSize: '13px' }}>비용: {formatResourceValue(fromPlainValue(cost))}</div>
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
                    className={`upgrade-button ${tutorialHighlightClass}`}
                  >
                    업그레이드
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
