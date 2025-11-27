import { useEffect } from 'react';
import { useStore } from '../store/useStore';

export const KEY_STEP = 80;
export const BG_FALLBACK_WIDTH = 4000;
export const SCROLL_RANGE = 4000; // 사용자 정의 좌우 이동 한계

export function clampOffset(nextOffset, backgroundWidth, viewWidth) {
  const bgWidth = backgroundWidth || BG_FALLBACK_WIDTH;
  const maxShift = Math.max(0, bgWidth - viewWidth);
  const minOffset = -maxShift;
  const maxOffset = 0;
  return Math.min(maxOffset, Math.max(minOffset, nextOffset));
}

export function useViewport() {
  const setUserOffsetX = useStore(state => state.setUserOffsetX);

  useEffect(() => {
    const mainArea = document.querySelector('.main');
    if (!mainArea) return;

    const getViewWidth = () => mainArea.clientWidth || 0;

    const clampAndSet = (value) => {
      const viewWidth = getViewWidth();
      // 배경 폭 정보가 없을 때는 사용자 정의 범위를 사용
      const bgWidth = useStore.getState().backgroundWidth || SCROLL_RANGE;
      const clamped = clampOffset(value, bgWidth, viewWidth);
      setUserOffsetX(clamped);
    };

    const handleKey = (event) => {
      const tag = event.target && event.target.tagName;
      if (tag && ["INPUT", "TEXTAREA", "SELECT"].includes(tag.toUpperCase())) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const current = useStore.getState().userOffsetX || 0;
        const delta = event.key === "ArrowLeft" ? -KEY_STEP : KEY_STEP;
        clampAndSet(current + delta);
      }
    };

    const handleResize = () => {
      clampAndSet(useStore.getState().userOffsetX || 0);
    };

    document.addEventListener("keydown", handleKey);
    window.addEventListener("resize", handleResize);
    // 초기 한 번 클램프
    clampAndSet(useStore.getState().userOffsetX || 0);

    return () => {
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", handleResize);
    };
  }, [setUserOffsetX]);
}
