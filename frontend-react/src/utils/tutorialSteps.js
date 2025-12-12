/**
 * Tutorial step definitions
 * Each step has: id, title, content, targetSelector, position, requiredAction
 */

export const TUTORIAL_STEPS = {
  1: {
    id: 1,
    title: "🎮 게임 시작하기",
    content: "환영합니다! 이 화면은 좌우로 스크롤할 수 있습니다. 발전기를 설치할 공간이 많아요! 좌우로 스크롤해보세요.",
    highlightSelector: ".main",
    position: "center",
    requiredAction: "scroll"
  },
  2: {
    id: 2,
    title: "⚡ 첫 발전기",
    content: "하단의 '발전기' 탭에서 첫 번째 발전기를 확인하세요.",
    highlightSelector: ".generator-grid .generator-item:first-child",
    position: "top"
  },
  3: {
    id: 3,
    title: "🏗️ 발전기 설치",
    content: "발전기를 드래그하여 메인 화면에 설치해보세요!",
    highlightSelector: [".generator-item:first-child", ".main"],
    position: "center",
    requiredAction: "place-generator",
    tooltips: [
      { title: "👆 여기서 드래그", content: "첫 번째 발전기를 드래그하세요", highlightIndex: 0, position: "right" },
      { title: "📍 여기에 설치", content: "메인 화면에 드롭하세요", highlightIndex: 1, position: "center" }
    ]
  },
  4: {
    id: 4,
    title: "📊 상단 정보",
    content: "상단 헤더에서 보유 자원을 확인할 수 있습니다.",
    highlightSelector: ".header",
    position: "bottom"
  },
  5: {
    id: 5,
    title: "⚡ 초당 생산량",
    content: "에너지 아이콘에 마우스를 올려보세요.",
    highlightSelector: ".energy-icon",
    position: "bottom",
    requiredAction: "hover-energy"
  },
  6: {
    id: 6,
    title: "💱 환율 확인",
    content: "돈 아이콘에 마우스를 올려 환율을 확인하세요.",
    highlightSelector: ".money-icon",
    position: "bottom",
    requiredAction: "hover-money"
  },
  7: {
    id: 7,
    title: "⚙️ 프로필",
    content: "프로필 버튼을 클릭해보세요.",
    highlightSelector: ".profile-trigger",
    position: "bottom",
    requiredAction: "click-profile"
  },
  8: {
    id: 8,
    title: "💰 교환소",
    content: "하단의 '거래' 탭을 클릭하세요.",
    highlightSelector: ".build-bar .bbtn:nth-child(2)",
    position: "top",
    requiredAction: "click-exchange"
  },
  9: {
    id: 9,
    title: "💵 판매하기",
    content: "에너지를 돈으로 교환하려면 '판매' 버튼을 클릭하세요.",
    highlightSelector: ".exchange-sell-btn",
    position: "top",
    requiredAction: "click-sell"
  },
  10: {
    id: 10,
    title: "🔧 업그레이드",
    content: "'업그레이드' 탭을 클릭하세요.",
    highlightSelector: ".build-bar .bbtn:nth-child(3)",
    position: "top",
    requiredAction: "click-upgrade-tab"
  },
  11: {
    id: 11,
    title: "📈 전체 생산량 증가",
    content: "'전체 생산량 증가' 업그레이드를 구매해보세요!",
    highlightSelector: ".upgrade-grid .upgrade-card:first-child",
    position: "top",
    requiredAction: "buy-production-upgrade"
  },
  12: {
    id: 12,
    title: "🔍 발전기 관리",
    content: "설치된 발전기를 클릭하세요.",
    highlightSelector: ".main-content .placed-generator:first-of-type",
    position: "top",
    requiredAction: "click-generator"
  },
  13: {
    id: 13,
    title: "⬆️ 발전기 업그레이드",
    content: "발전기의 '생산량 증가' 업그레이드를 클릭하세요!",
    highlightSelector: ".main-content .placed-generator:first-of-type",
    position: "top",
    requiredAction: "upgrade-generator-production"
  },
  14: {
    id: 14,
    title: "📈 정보 탭",
    content: "하단의 'Info' 탭을 클릭하세요.",
    highlightSelector: ".build-bar .bbtn:nth-child(4)",
    position: "top",
    requiredAction: "click-info-tab"
  },
  15: {
    id: 15,
    title: "🏆 랭킹 시스템",
    content: "랭킹 기준에 따라 다른 플레이어들과 순위를 비교할 수 있습니다!",
    highlightSelector: ".info-tab",
    position: "center"
  },
  16: {
    id: 16,
    title: "✨ 특수 업그레이드",
    content: "'특수' 탭을 클릭하세요.",
    highlightSelector: ".build-bar .bbtn:nth-child(5)",
    position: "top",
    requiredAction: "click-special-tab"
  },
  17: {
    id: 17,
    title: "🪙 슈퍼코인",
    content: "슈퍼코인으로 강력한 특수 업그레이드를 구매할 수 있습니다!",
    highlightSelector: ".special-tab",
    position: "center"
  },
  18: {
    id: 18,
    title: "🔮 환생",
    content: "환생을 하면 모든 진행도가 초기화되지만, 생산량이 2배씩 증가합니다!",
    highlightSelector: ".rebirth-trigger",
    position: "bottom"
  },
  19: {
    id: 19,
    title: "📝 문의",
    content: "하단의 '문의' 탭을 클릭하세요.",
    highlightSelector: ".build-bar .bbtn:nth-child(6)",
    position: "top",
    requiredAction: "click-inquiry-tab"
  },
  20: {
    id: 20,
    title: "🎉 튜토리얼 완료!",
    content: "문의 탭에서 버그 리포트나 건의사항을 보낼 수 있습니다. 튜토리얼을 완료했습니다!",
    highlightSelector: ".inquiry-tab",
    position: "center"
  }
};

export const getTutorialStep = (stepNumber) => {
  return TUTORIAL_STEPS[stepNumber] || null;
};

export const isTutorialComplete = (stepNumber) => {
  return stepNumber === 0 || stepNumber > 20;
};

export const shouldShowTutorial = (stepNumber) => {
  return stepNumber >= 1 && stepNumber <= 20;
};
