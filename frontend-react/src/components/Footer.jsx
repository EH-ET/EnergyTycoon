import { useStore } from '../store/useStore';
import { dispatchTutorialEvent, TUTORIAL_EVENTS } from '../utils/tutorialEvents';
import { useEffect } from 'react';

export default function Footer({ children }) {
  const contentMode = useStore(state => state.contentMode);
  const setContentMode = useStore(state => state.setContentMode);
  const currentUser = useStore(state => state.currentUser);

  // 🚨 튜토리얼 단계에 따라 contentMode를 강제 설정하는 훅 추가
  useEffect(() => {
    const tutorialStep = currentUser?.tutorial;

    // Step 8 & 9: 교환소(Trade) 탭이 열려 있어야 합니다.
    if (tutorialStep === 8 || tutorialStep === 9) {
      if (contentMode !== 'trade') {
        setContentMode('trade');
      }
    } 
    // Step 10, 11, 12: 업그레이드(Upgrade) 탭이 열려 있어야 합니다.
    else if (tutorialStep >= 10 && tutorialStep <= 12) {
      if (contentMode !== 'upgrade') {
        setContentMode('upgrade');
      }
    }
    // Step 14, 15: 정보(Info) 탭이 열려 있어야 합니다.
    else if (tutorialStep >= 14 && tutorialStep <= 15) {
      if (contentMode !== 'info') {
        setContentMode('info');
      }
    }
    // Step 16, 17: 특수(Special) 탭이 열려 있어야 합니다.
    else if (tutorialStep >= 16 && tutorialStep <= 17) {
      if (contentMode !== 'special') {
        setContentMode('special');
      }
    }
  }, [currentUser?.tutorial, contentMode, setContentMode]); // 튜토리얼 단계 및 contentMode 변경 시 실행
  
  return (
    <footer>
      <div className="build-bar">
        <div className="btn-bar">
          <button
            className={`generator-btn bbtn ${contentMode === 'generator' ? 'active' : ''}`}
            onClick={() => setContentMode('generator')}
          >
            발전기
          </button>
          <button
            className={`trade-btn bbtn ${contentMode === 'trade' ? 'active' : ''}`}
            onClick={() => {
              setContentMode('trade');
              dispatchTutorialEvent(TUTORIAL_EVENTS.CLICK_EXCHANGE);
            }}
          >
            교환소
          </button>
          <button
            className={`upgrade-btn bbtn ${contentMode === 'upgrade' ? 'active' : ''}`}
            onClick={() => {
              setContentMode('upgrade');
              dispatchTutorialEvent(TUTORIAL_EVENTS.CLICK_UPGRADE_TAB);
            }}
          >
            업그레이드
          </button>
          <button
            className={`special-btn bbtn ${contentMode === 'special' ? 'active' : ''}`}
            onClick={() => {
              setContentMode('special');
              dispatchTutorialEvent(TUTORIAL_EVENTS.CLICK_SPECIAL_TAB);
            }}
          >
            특수
          </button>
          <button
            className={`info-btn bbtn ${contentMode === 'info' ? 'active' : ''}`}
            onClick={() => {
              setContentMode('info');
              dispatchTutorialEvent(TUTORIAL_EVENTS.CLICK_INFO_TAB);
            }}
          >
            정보
          </button>
          <button
            className={`inquiry-btn bbtn ${contentMode === 'inquiry' ? 'active' : ''}`}
            onClick={() => {
              setContentMode('inquiry');
              dispatchTutorialEvent(TUTORIAL_EVENTS.CLICK_INQUIRY_TAB);
            }}
          >
            문의하기
          </button>
        </div>
        <div className="content-area">
          {children}
        </div>
      </div>
    </footer>
  );
}
