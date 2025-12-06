import { useEffect, useState } from 'react';
import { useStore, loadUserData, getAuthToken, ensureSessionStart, initTrapGuard, installTrapFetchGuard } from './store/useStore';
import { loadGeneratorTypes, loadProgress, setGlobalLoadingCallback } from './utils/apiClient';
import { useEnergyTimer } from './hooks/useEnergyTimer';
import { useAutosave } from './hooks/useAutosave';
import { useViewport } from './hooks/useViewport';
import { useRankUpdate } from './hooks/useRank';
import { usePlayTime } from './hooks/usePlayTime';
import { normalizeServerGenerators } from './utils/generatorHelpers';
import Header from './components/Header';
import Main from './components/Main';
import Footer from './components/Footer';
import GeneratorTab from './components/tabs/GeneratorTab';
import TradeTab from './components/tabs/TradeTab';
import UpgradeTab from './components/tabs/UpgradeTab';
import SpecialTab from './components/tabs/SpecialTab';
import InfoTab from './components/tabs/InfoTab';
import InquiryTab from './components/tabs/InquiryTab';
import TutorialOverlay from './components/TutorialOverlay';
import GlobalLoadingModal from './components/GlobalLoadingModal';
import Login from './pages/Login';
import AdminPage from './pages/AdminPage';
import './App.css';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAdminPage, setIsAdminPage] = useState(false);
  const contentMode = useStore(state => state.contentMode);
  const currentUser = useStore(state => state.currentUser);
  const syncUserState = useStore(state => state.syncUserState);
  const setGeneratorTypes = useStore(state => state.setGeneratorTypes);
  const setPlacedGenerators = useStore(state => state.setPlacedGenerators);
  const setGlobalLoading = useStore(state => state.setGlobalLoading);

  // Set up global loading callback for API client
  useEffect(() => {
    setGlobalLoadingCallback((isLoading, message) => {
      setGlobalLoading(isLoading, message);
    });
  }, [setGlobalLoading]);

  // Simple routing - check if URL hash is #admin
  useEffect(() => {
    const checkAdminRoute = () => {
      const isAdmin = window.location.hash === '#admin';
      console.log('Checking admin route:', window.location.hash, isAdmin);
      setIsAdminPage(isAdmin);
    };
    
    // Check immediately
    checkAdminRoute();
    
    // Listen for hash changes
    window.addEventListener('hashchange', checkAdminRoute);
    return () => window.removeEventListener('hashchange', checkAdminRoute);
  }, []);

  const fetchAndSyncProgress = async (user, token, typeMapById) => {
    if (!user?.user_id) {
      return;
    }
    
    const safeToken = token || getAuthToken();
    
    try {
      const res = await loadProgress(user.user_id, safeToken);
      
      if (res.user) {
        syncUserState(res.user);
      }
      if (res.generators) {
        const normalized = normalizeServerGenerators(
          res.generators,
          typeMapById || useStore.getState().generatorTypesById
        );
        setPlacedGenerators(normalized);
      }
    } catch (err) {
      console.error("Failed to load progress:", err);
      throw err; 
    }
  };

  // 에너지 타이머, 자동 저장, viewport, 랭킹 업데이트 활성화
  useEnergyTimer();
  useAutosave();
  useViewport();
  useRankUpdate();
  usePlayTime();

  useEffect(() => {
    const init = async () => {
      // 트랩 가드 초기화
      installTrapFetchGuard();
      initTrapGuard();

      // 발전기 타입 로드
      const state = {
        generatorTypeMap: {},
        generatorTypeInfoMap: {},
        generatorTypeIdToName: {},
        generatorTypesById: {},
      };

      // FIX: 발전기 타입을 먼저 완전히 로드 (Race Condition 방지)
      try {
        await loadGeneratorTypes(state);
        setGeneratorTypes(
          state.generatorTypeMap,
          state.generatorTypeInfoMap,
          state.generatorTypeIdToName,
          state.generatorTypesById
        );
      } catch (e) {
        console.error("Failed to load generator types:", e);
      }

      // 저장된 사용자 데이터 로드
      const stored = loadUserData();
      if (stored) {
        const token = getAuthToken();

        // Note: With HttpOnly cookies, token may be null but auth still works
        // Don't logout just because token is null, let API calls determine auth status

        syncUserState(stored);
        ensureSessionStart();

        // 진행도 로드 (generator types가 이미 로드됨)
        try {
          await fetchAndSyncProgress(stored, token, state.generatorTypesById);
        } catch (e) {
          // 401/403 에러인 경우 토큰 갱신 시도
          const isAuthError = e.message?.includes('401') || e.message?.includes('403') || 
                             e.message?.includes('Unauthorized') || e.message?.includes('인증');
          
          if (isAuthError) {
            console.log('Auth error detected, attempting token refresh...');
            
            // Refresh token으로 access token 갱신 시도
            const { refreshAccessToken } = await import('./utils/apiClient');
            const refreshed = await refreshAccessToken();
            
            if (refreshed) {
              console.log('Token refreshed successfully, retrying progress load...');
              try {
                // 토큰 갱신 성공 시 원래 요청 재시도
                await fetchAndSyncProgress(stored, getAuthToken(), state.generatorTypesById);
                return; // 성공하면 여기서 종료
              } catch (retryError) {
                console.error('Retry after refresh failed:', retryError);
              }
            } else {
              console.log('Token refresh failed - refresh token expired or invalid');
            }
          }
          
          // FIX: 토큰 갱신 실패 또는 다른 에러 시 로그아웃 처리
          console.error('Session expired or invalid:', e);
          localStorage.clear();
          sessionStorage.clear();
          useStore.getState().setCurrentUser(null);
          setIsLoading(false);
        }
      }
    };

    init().finally(() => setIsLoading(false));
  }, []);

  const renderTab = () => {
    switch (contentMode) {
      case 'generator':
        return <GeneratorTab />;
      case 'trade':
        return <TradeTab />;
      case 'upgrade':
        return <UpgradeTab />;
      case 'special':
        return <SpecialTab />;
      case 'info':
        return <InfoTab />;
      case 'inquiry':
        return <InquiryTab />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  // Admin Page Route
  if (isAdminPage) {
    return <AdminPage />;
  }

  if (!currentUser) {
    return (
      <Login
        onLoginSuccess={async (user, token) => {
          syncUserState(user, { token });
          ensureSessionStart();
          try {
            // Explicitly pass generatorTypesById from store
            const typesById = useStore.getState().generatorTypesById;
            await fetchAndSyncProgress(user, token, typesById);
          } catch (e) {
            console.error('login progress load failed', e);
          }
        }}
      />
    );
  }

  return (
    <>
      <Header />
      <Main />
      <Footer>
        {renderTab()}
      </Footer>
      <TutorialOverlay />
      <GlobalLoadingModal />
    </>
  );
}

export default App;
