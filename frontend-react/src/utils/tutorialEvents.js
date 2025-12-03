/**
 * Tutorial event system for tracking user actions
 */

export const TUTORIAL_EVENTS = {
  SCROLL: 'tutorial:scroll',
  BUY_GENERATOR: 'tutorial:buy-generator',
  HOVER_ENERGY: 'tutorial:hover-energy',
  HOVER_MONEY: 'tutorial:hover-money',
  CLICK_PROFILE: 'tutorial:click-profile',
  BUY_UPGRADE: 'tutorial:buy-upgrade',
  CLICK_GENERATOR: 'tutorial:click-generator',
  UPGRADE_GENERATOR: 'tutorial:upgrade-generator'
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
    2: TUTORIAL_EVENTS.BUY_GENERATOR,
    4: TUTORIAL_EVENTS.HOVER_ENERGY,
    5: TUTORIAL_EVENTS.HOVER_MONEY,
    6: TUTORIAL_EVENTS.CLICK_PROFILE,
    8: TUTORIAL_EVENTS.BUY_UPGRADE,
    9: TUTORIAL_EVENTS.CLICK_GENERATOR,
    10: TUTORIAL_EVENTS.UPGRADE_GENERATOR
  };
  
  return actionMap[step] || null;
}
