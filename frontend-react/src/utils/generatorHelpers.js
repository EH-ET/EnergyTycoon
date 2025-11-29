import { generators } from './data';

export function getBuildDurationMs(meta) {
  const seconds = Number(meta?.["설치시간(초)"]);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.max(1000, seconds * 1000);
  }
  return 2000;
}

export function makeImageSrcByIndex(idx) {
  const num = Number(idx);
  if (Number.isNaN(num)) return placeholderDataUrl();
  return `/generator/${num + 1}.png`;
}

export function findGeneratorIndexByName(name) {
  return generators.findIndex((g) => g && g.이름 === name);
}

export function placeholderDataUrl() {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='180'><rect width='100%' height='100%' fill='%23e0e0e0'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='20' fill='%23666'>이미지 없음</text></svg>`;
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

export function computeSkipCost(entry) {
  if (!entry || !entry.isDeveloping) return 0;
  const remainingSeconds = Math.max(0, Math.ceil(((entry.buildCompleteTs || Date.now()) - Date.now()) / 1000));
  const baseCost = entry.baseCost || 0;
  const totalDurationSeconds = Math.max(
    1,
    Math.ceil((entry.buildDurationMs || entry.baseBuildDurationMs || 2000) / 1000),
  );
  return Math.max(1, Math.ceil((remainingSeconds / totalDurationSeconds) * baseCost));
}

export function computeMaxGenerators(user) {
  if (!user) return 10;
  return 10 + (Number(user.max_generators_bonus) || 0);
}

export function normalizeServerGenerators(serverGenerators = [], typesById = {}) {
  return serverGenerators.map((g) => {
    const typeIdNum = Number(g.generator_type_id);
    const typeInfo = typesById[g.generator_type_id] || typesById[typeIdNum] || {};
    const serverIndex = Number.isInteger(typeInfo.index) ? typeInfo.index : null;
    const fallbackIndex = Number.isInteger(typeIdNum) ? typeIdNum : null;
    const genIndex = serverIndex != null ? serverIndex : fallbackIndex;
    const meta = genIndex != null && genIndex >= 0 && genIndex < generators.length
      ? generators[genIndex]
      : null;
    const name = typeInfo.name || g.type || meta?.이름 || `발전기 ${g.generator_type_id}`;
    const tolerance = Number(meta?.내열한계) || 100;
    const heatRate = Number(meta?.발열) || 0;
    const baseCost = typeof g.cost === 'number'
      ? g.cost
      : (typeof typeInfo.cost === 'number'
        ? typeInfo.cost
        : (meta ? meta['설치비용'] : 0));

    return {
      x: typeof g.x_position === 'number' ? g.x_position : 0,
      x_position: typeof g.x_position === 'number' ? g.x_position : 0,
      world_position: g.world_position ?? 0,
      name,
      genIndex,
      generator_id: g.generator_id,
      generator_type_id: g.generator_type_id,
      level: g.level || 1,
      baseCost,
      cost_data: g.cost_data,
      cost_high: g.cost_high,
      isDeveloping: Boolean(g.isdeveloping),
      buildCompleteTs: g.build_complete_ts ? g.build_complete_ts * 1000 : null,
      running: g.running !== false,
      heat: typeof g.heat === 'number' ? g.heat : 0,
      tolerance,
      baseTolerance: tolerance,
      heatRate,
      upgrades: g.upgrades || { production: 0, heat_reduction: 0, tolerance: 0 },
    };
  });
}
