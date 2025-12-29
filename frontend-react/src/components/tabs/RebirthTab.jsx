import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { performRebirth, autosaveProgress } from '../../utils/apiClient';
import { fromPlainValue, multiplyByPlain, formatResourceValue, compareValues, powerOf, multiplyValues } from '../../utils/bigValue';
import { readStoredPlayTime } from '../../utils/playTime';
import './RebirthTab.css';

// 환생 공식 상수
const BASE_REBIRTH_COST = 15_000_000; // 15M

// 환생 비용 계산: 15M × 8^n (BigValue)
function calculateRebirthCost(rebirthCount) {
  const baseCost = fromPlainValue(BASE_REBIRTH_COST);
  const multiplier = powerOf(fromPlainValue(8), rebirthCount);
  return multiplyValues(baseCost, multiplier); // BigValue 간 곱셈
}

// 환생 배수 계산: 2^n (BigValue)
function calculateRebirthMultiplier(rebirthCount) {
  return powerOf(fromPlainValue(2), rebirthCount);
}

// 환생 시작 자금 계산: 10 × 10^level (BigValue)
function calculateRebirthStartMoney(level) {
  const base = fromPlainValue(10);
  const multiplier = powerOf(fromPlainValue(10), level);
  return multiplyValues(base, multiplier); // BigValue 간 곱셈
}

export default function RebirthTab() {
  const currentUser = useStore(state => state.currentUser);
  const syncUserState = useStore(state => state.syncUserState);
  const setPlacedGenerators = useStore(state => state.setPlacedGenerators);
  const getMoneyValue = useStore(state => state.getMoneyValue);
  const setSaveStatus = useStore(state => state.setSaveStatus);
  const lockAutosave = useStore(state => state.lockAutosave);
  const unlockAutosave = useStore(state => state.unlockAutosave);

  const [performing, setPerforming] = useState(false);

  if (!currentUser) {
    return <div className="rebirth-tab">로그인이 필요합니다</div>;
  }

  // 프론트엔드에서 환생 정보 계산
  const rebirthCount = currentUser.rebirth_count || 0;
  const maxChain = Math.max(1, 1 + (currentUser.rebirth_chain_upgrade || 0));
  const rebirthStartMoneyLevel = currentUser.rebirth_start_money_upgrade || 0;

  const nextCost = calculateRebirthCost(rebirthCount);
  const chainCost = calculateRebirthCost(rebirthCount + maxChain - 1);
  const currentMultiplier = calculateRebirthMultiplier(rebirthCount);
  const nextMultiplier = calculateRebirthMultiplier(rebirthCount + 1);
  const startMoney = calculateRebirthStartMoney(rebirthStartMoneyLevel);

  const moneyValue = getMoneyValue();
  const canAfford = compareValues(moneyValue, nextCost) >= 0;

  const handleRebirth = async () => {
    if (!canAfford) {
      alert('돈이 부족합니다.');
      return;
    }

    const confirmMessage =
      `환생하시겠습니까?\n\n` +
      `비용: ${formatResourceValue(nextCost)}\n` +
      `새 배율: ${nextMultiplier}x\n\n` +
      `⚠️ 모든 발전기와 업그레이드가 초기화됩니다!`;

    if (!confirm(confirmMessage)) {
      return;
    }

    lockAutosave(); // Autosave lock before critical operation
    try {
      setPerforming(true);

      // 환생 수행 (1회)
      const result = await performRebirth(1);

      // 사용자 상태 업데이트 및 발전기 초기화
      if (result.user) {
        syncUserState(result.user);
      }
      setPlacedGenerators([]);

      // 환생 후 올바른 상태를 저장 (syncUserState 후에 호출해야 새로운 값을 가져옴)
      // 서버에서 받은 새로운 상태로 autosave
      const { toEnergyServerPayload, toMoneyServerPayload } = useStore.getState();
      const energyPayload = toEnergyServerPayload();
      const moneyPayload = toMoneyServerPayload();
      const playTimeMs = readStoredPlayTime();

      await autosaveProgress({
        energy_data: energyPayload.data,
        energy_high: energyPayload.high,
        money_data: moneyPayload.data,
        money_high: moneyPayload.high,
        play_time_ms: playTimeMs,
        // supercoin은 서버에서 관리하므로 보내지 않음
      });

      setSaveStatus('success'); // 저장 성공 알림

      alert(result.message || '환생 성공!');
    } catch (err) {
      setSaveStatus('error'); // 저장 실패 알림
      alert(err.message || '환생에 실패했습니다');
    } finally {
      setPerforming(false);
      unlockAutosave(); // Unlock autosave after operation completes
    }
  };

  return (
    <div className="rebirth-tab">
      <h2>🌟 환생 (Rebirth)</h2>

      <div className="rebirth-info">
        <div className="info-row">
          <span className="label">현재 환생 횟수:</span>
          <span className="value">{rebirthCount}</span>
        </div>

        <div className="info-row">
          <span className="label">현재 배율:</span>
          <span className="value multiplier">{formatResourceValue(currentMultiplier)}x</span>
        </div>

        <div className="info-row">
          <span className="label">다음 환생 비용:</span>
          <span className={`value ${canAfford ? 'can-afford' : 'cannot-afford'}`}>
            {formatResourceValue(nextCost)}
          </span>
        </div>

        <div className="info-row">
          <span className="label">다음 배율:</span>
          <span className="value multiplier">{formatResourceValue(nextMultiplier)}x</span>
        </div>

        <div className="info-row">
          <span className="label">현재 돈:</span>
          <span className="value">{formatResourceValue(moneyValue)}</span>
        </div>

        <div className="info-row">
          <span className="label">환생 시작 자금:</span>
          <span className="value">{formatResourceValue(startMoney)}</span>
        </div>

        <div className="info-row">
          <span className="label">연속 환생 한도:</span>
          <span className="value">{maxChain}회</span>
        </div>
      </div>

      <div className="rebirth-description">
        <h3>환생 효과</h3>
        <ul>
          <li>✨ 에너지 생산량 배율: 2^n</li>
          <li>💰 환율 배율: 2^n</li>
          <li>⚠️ 모든 발전기 삭제</li>
          <li>⚠️ 에너지 0으로 초기화</li>
          <li>⚠️ 모든 업그레이드 초기화</li>
        </ul>
      </div>

      <button
        className="rebirth-button"
        onClick={handleRebirth}
        disabled={!canAfford || performing}
      >
        {performing ? '환생 중...' : canAfford ? '환생하기' : '돈이 부족합니다'}
      </button>
    </div>
  );
}
