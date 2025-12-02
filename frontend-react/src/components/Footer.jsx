import { useStore } from '../store/useStore';

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
            onClick={() => setContentMode('trade')}
          >
            교환소
          </button>
          <button
            className={`upgrade-btn bbtn ${contentMode === 'upgrade' ? 'active' : ''}`}
            onClick={() => setContentMode('upgrade')}
          >
            업그레이드
          </button>
          <button
            className={`info-btn bbtn ${contentMode === 'info' ? 'active' : ''}`}
            onClick={() => setContentMode('info')}
          >
            정보
          </button>
          <button
            className={`rebirth-btn bbtn ${contentMode === 'rebirth' ? 'active' : ''}`}
            onClick={() => setContentMode('rebirth')}
          >
            환생
          </button>
        </div>
        <div className="content-area">
          {children}
        </div>
      </div>
    </footer>
  );
}
