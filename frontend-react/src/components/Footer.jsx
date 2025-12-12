import { useStore } from '../store/useStore';
import { dispatchTutorialEvent, TUTORIAL_EVENTS } from '../utils/tutorialEvents';

export default function Footer({ children }) {
  const contentMode = useStore(state => state.contentMode);
  const setContentMode = useStore(state => state.setContentMode);

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
