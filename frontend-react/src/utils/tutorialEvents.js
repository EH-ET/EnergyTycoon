/**
 * Tutorial event system for tracking user actions
 */

export const TUTORIAL_EVENTS = {
  SCROLL: 'tutorial:scroll',
  PLACE_GENERATOR: 'tutorial:place-generator',
  HOVER_ENERGY: 'tutorial:hover-energy',
  HOVER_MONEY: 'tutorial:hover-money',
  CLICK_PROFILE: 'tutorial:click-profile',
  CLICK_EXCHANGE: 'tutorial:click-exchange',
  CLICK_SELL: 'tutorial:click-sell',
  CLICK_UPGRADE_TAB: 'tutorial:click-upgrade-tab',
  BUY_PRODUCTION_UPGRADE: 'tutorial:buy-production-upgrade',
  CLICK_GENERATOR: 'tutorial:click-generator',
  UPGRADE_GENERATOR_PRODUCTION: 'tutorial:upgrade-generator-production',
  CLICK_INFO_TAB: 'tutorial:click-info-tab',
  CLICK_SPECIAL_TAB: 'tutorial:click-special-tab',
  CLICK_INQUIRY_TAB: 'tutorial:click-inquiry-tab'
};

/**
 * Dispatch a tutorial event
 */
export function dispatchTutorialEvent(eventName, data = {}) {
  const event = new CustomEvent(eventName, { detail: data });
  document.dispatchEvent(event);
}

/**
 * Listen to a tutorial event
 */
export function onTutorialEvent(eventName, handler) {
  document.addEventListener(eventName, handler);
  return () => document.removeEventListener(eventName, handler);
}

/**
 * Check if tutorial action is required for current step
 */
export function getRequiredAction(step) {
  const actionMap = {
    1: TUTORIAL_EVENTS.SCROLL,
    3: TUTORIAL_EVENTS.PLACE_GENERATOR,
    5: TUTORIAL_EVENTS.HOVER_ENERGY,
    6: TUTORIAL_EVENTS.HOVER_MONEY,
    7: TUTORIAL_EVENTS.CLICK_PROFILE,
    8: TUTORIAL_EVENTS.CLICK_EXCHANGE,
    9: TUTORIAL_EVENTS.CLICK_SELL,
    10: TUTORIAL_EVENTS.CLICK_UPGRADE_TAB,
    11: TUTORIAL_EVENTS.BUY_PRODUCTION_UPGRADE,
    12: TUTORIAL_EVENTS.CLICK_GENERATOR,
    13: TUTORIAL_EVENTS.UPGRADE_GENERATOR_PRODUCTION,
    14: TUTORIAL_EVENTS.CLICK_INFO_TAB,
    16: TUTORIAL_EVENTS.CLICK_SPECIAL_TAB,
    19: TUTORIAL_EVENTS.CLICK_INQUIRY_TAB
  };
  
  return actionMap[step] || null;
}
