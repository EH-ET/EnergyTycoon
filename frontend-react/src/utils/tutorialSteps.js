/**
 * Tutorial step definitions
 * Each step has: id, title, content, targetSelector, position, action
 */

export const TUTORIAL_STEPS = {
  1: {
    id: 1,
    title: "🎮 게임 시작하기",
    content: "환영합니다! 이 화면은 좌우로 스크롤할 수 있습니다. 발전기를 설치할 공간이 많아요!",
    highlightSelector: ".main",
    position: "center",
    nextAction: "scroll" // 스크롤하면 자동으로 다음 단계
  },
  2: {
    id: 2,
    title: "⚡ 첫 발전기 구매하기",
    content: "하단의 '발전기' 탭에서 첫 번째 발전기를 구매해보세요. 발전기를 드래그하여 메인 화면에 설치할 수 있습니다.",
    highlightSelector: ".generator-grid .generator-item:first-child",
    position: "top",
    requiredAction: "buy-generator" // 발전기 구매 시 다음 단계
  },
  3: {
    id: 3,
    title: "📊 상단 정보 확인",
    content: "상단 헤더에서 보유 자원과 환율을 확인할 수 있습니다.",
    highlightSelector: ".header",
    position: "bottom"
  },
  4: {
    id: 4,
    title: "⚡ 초당 생산량 확인",
    content: "에너지 아이콘에 마우스를 올리면 초당 생산량을 확인할 수 있습니다.",
    highlightSelector: ".energy-icon",
    position: "bottom",
    requiredAction: "hover-energy"
  },
  5: {
    id: 5,
    title: "💱 환율 확인",
    content: "돈 아이콘에 마우스를 올리면 현재 환율을 확인할 수 있습니다.",
    highlightSelector: ".money-icon",
    position: "bottom",
    requiredAction: "hover-money"
  },
  6: {
    id: 6,
    title: "⚙️ 설정 메뉴",
    content: "프로필 버튼을 클릭하면 설정과 계정 관리를 할 수 있습니다.",
    highlightSelector: ".profile-trigger",
    position: "bottom",
    requiredAction: "click-profile"
  },
  7: {
    id: 7,
    title: "💰 거래소 이용하기",
    content: "하단의 '거래' 탭에서 에너지를 돈으로 교환할 수 있습니다. 주의: 많이 팔면 에너지 가치가 떨어지므로 수요를 증가시켜야 합니다!",
    highlightSelector: ".build-bar .bbtn:nth-child(2)",
    position: "top"
  },
  8: {
    id: 8,
    title: "🔧 전역 업그레이드",
    content: "돈을 모아서 '업그레이드' 탭에서 전체 생산량을 증가시키세요!",
    highlightSelector: ".build-bar .bbtn:nth-child(3)",
    position: "top",
    requiredAction: "buy-upgrade"
  },
  9: {
    id: 9,
    title: "🔍 발전기 관리",
    content: "설치된 발전기를 클릭하면 상세 정보와 업그레이드 옵션을 볼 수 있습니다.",
    highlightSelector: ".placed-generator:first-child",
    position: "top",
    requiredAction: "click-generator"
  },
  10: {
    id: 10,
    title: "⬆️ 발전기 업그레이드",
    content: "에너지를 모아 돈으로 교환한 후, 발전기를 업그레이드하세요!",
    highlightSelector: ".generator-modal",
    position: "center",
    requiredAction: "upgrade-generator"
  },
  11: {
    id: 11,
    title: "📈 정보 확인",
    content: "하단의 'Info' 탭에서 플레이 시간, 통계, 랭킹을 확인할 수 있습니다. 튜토리얼 완료!",
    highlightSelector: ".build-bar .bbtn:nth-child(4)",
    position: "top"
  }
};

export const getTutorialStep = (stepNumber) => {
  return TUTORIAL_STEPS[stepNumber] || null;
};

export const isTutorialComplete = (stepNumber) => {
  return stepNumber === 0 || stepNumber > 11;
};

export const shouldShowTutorial = (stepNumber) => {
  return stepNumber >= 1 && stepNumber <= 11;
};
