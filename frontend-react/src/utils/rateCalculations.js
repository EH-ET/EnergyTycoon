import { generators } from './data';
import { valueFromServer, addValues, multiplyByFloat, normalizeValue, fromPlainValue, powerOf } from './bigValue';

function applyUpgradeEffects(baseValue, upgrades = {}, { type }) {
  // Now works with BigValue - returns BigValue
  const level = upgrades[type] || 0;
  if (!level) return baseValue;
  const factor = 1 + 0.1 * level;
  return multiplyByFloat(baseValue, factor);
}

export function computeEnergyPerSecond(placedGenerators, currentUser, deltaSeconds = 1) {
  // Returns BigValue for energy per second
  let baseTotalBV = normalizeValue({ data: 0, high: 0 });
  placedGenerators.forEach((pg) => {
    if (!pg || pg.isDeveloping || pg.running === false) return;
    if (pg.genIndex == null || pg.genIndex < 0) return;
    const g = generators[pg.genIndex];
    if (!g) return;
    const upgrades = pg.upgrades || {};
    const productionValue = valueFromServer(
      g["생산량(에너지수)"],
      g["생산량(에너지높이)"],
      g["생산량(에너지)"]
    );
    // Apply upgrade effects (returns BigValue)
    const producedBV = applyUpgradeEffects(productionValue, upgrades, { type: "production" });
    // Multiply by deltaSeconds
    const producedThisPeriod = multiplyByFloat(producedBV, deltaSeconds);
    baseTotalBV = addValues(baseTotalBV, producedThisPeriod);
  });
  if (!currentUser) return baseTotalBV;
  
  const {
    production_bonus = 0,
    rebirth_count = 0,
    energy_multiplier = 0,
    proton_energy_gain_upgrade = 0,
    sparkle_energy_multiplier_upgrade = 0,
  } = currentUser;

  let resultBV = baseTotalBV;

  // Apply production bonus
  resultBV = multiplyByFloat(resultBV, 1 + production_bonus * 0.1);

  // Apply rebirth multiplier: 2^n (using BigValue)
  if (rebirth_count > 0) {
    const rebirthMultiplierBV = powerOf(fromPlainValue(2), rebirth_count);
    resultBV = multiplyValues(resultBV, rebirthMultiplierBV);
  }

  // Apply energy multiplier from special upgrades: 2^n (using BigValue)
  if (energy_multiplier > 0) {
    const energyMultiplierBV = powerOf(fromPlainValue(2), energy_multiplier);
    resultBV = multiplyValues(resultBV, energyMultiplierBV);
  }

  // Apply proton energy gain: 1.5^n (using float multiplication)
  if (proton_energy_gain_upgrade > 0) {
    const protonMultiplier = Math.pow(1.5, proton_energy_gain_upgrade);
    resultBV = multiplyByFloat(resultBV, protonMultiplier);
  }
  
  // Apply sparkle energy multiplier: 1.5^n (using float multiplication)
  if (sparkle_energy_multiplier_upgrade > 0) {
    const sparkleMultiplier = Math.pow(1.5, sparkle_energy_multiplier_upgrade);
    resultBV = multiplyByFloat(resultBV, sparkleMultiplier);
  }

  return resultBV;
}

export function computeSparklePerSecond(placedGenerators, currentUser) {
  let totalSparkleRateBV = normalizeValue({ data: 0, high: 0 });

  if (!currentUser) return totalSparkleRateBV;

  const { 
    sparkle_chance_upgrade = 0, 
    sparkle_amount_upgrade = 0, 
    rebirth_sparkle_bonus_upgrade = 0, 
    money_sparkle_bonus_upgrade = 0,
    proton_sparkle_gain_upgrade = 0
  } = currentUser;

  const baseSparkleChance = 0.01;
  const finalSparkleChance = baseSparkleChance + (sparkle_chance_upgrade * 0.001);

  placedGenerators.forEach((pg) => {
    if (!pg || pg.isDeveloping || pg.running === false) return;
    
    let levelBV = fromPlainValue(pg.level || 1);
    
    if (sparkle_amount_upgrade > 0) {
      const power = Math.pow(2, sparkle_amount_upgrade); // This will always be an integer exponent
      levelBV = powerOf(levelBV, power);
    }
    
    let multiplier = 1.0;
    if (rebirth_sparkle_bonus_upgrade > 0) {
        multiplier *= Math.pow(2, rebirth_sparkle_bonus_upgrade);
    }
    if (money_sparkle_bonus_upgrade > 0) {
        multiplier *= Math.pow(1.5, money_sparkle_bonus_upgrade);
    }
    if (proton_sparkle_gain_upgrade > 0) {
        multiplier *= Math.pow(2, proton_sparkle_gain_upgrade);
    }

    let amountPerTickBV = multiplyByFloat(levelBV, multiplier);
    
    // Now, multiply by the chance
    const expectedSparklesBV = multiplyByFloat(amountPerTickBV, finalSparkleChance);
    
    totalSparkleRateBV = addValues(totalSparkleRateBV, expectedSparklesBV);
  });

  return totalSparkleRateBV;
}