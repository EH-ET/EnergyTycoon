from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import GeneratorType
from ..init_db import DEFAULT_GENERATOR_NAME_TO_INDEX, DEFAULT_GENERATOR_TYPES, sync_generator_types

DEFAULT_GENERATOR_SPEC_BY_NAME = {g["이름"]: g for g in DEFAULT_GENERATOR_TYPES}

router = APIRouter()


def _spec_cost(name: str, fallback: int) -> int:
    spec = DEFAULT_GENERATOR_SPEC_BY_NAME.get(name, {})
    base = spec.get("설치비용(수)") or spec.get("설치비용") or spec.get("cost") or 0
    high = spec.get("설치비용(높이)") or 0
    try:
        base_num = float(base)
    except (TypeError, ValueError):
        base_num = 0
    try:
        high_num = int(high)
    except (TypeError, ValueError):
        high_num = 0
    cost = max(0, base_num) * (10 ** max(0, high_num))
    return max(1, int(round(cost if cost > 0 else fallback or 1)))


@router.get("/generator_types")
async def generator_types(db: Session = Depends(get_db)):
    # 안전망: startup 훅이 돌지 않았거나 테이블이 비어있으면 기본 타입을 채운다.
    if db.query(GeneratorType).count() == 0:
        sync_generator_types(db)
    types = db.query(GeneratorType).all()
    payload = []
    for t in types:
        idx = DEFAULT_GENERATOR_NAME_TO_INDEX.get(t.name)
        spec = DEFAULT_GENERATOR_SPEC_BY_NAME.get(t.name, {})
        cost_val = _spec_cost(t.name, getattr(t, "cost", 1))
        payload.append({
            "id": t.generator_type_id,
            "name": t.name,
            "cost": cost_val,
            "description": t.description,
            "index": idx,
            "cost_data": spec.get("설치비용(수)"),
            "cost_high": spec.get("설치비용(높이)"),
            "energy_data": spec.get("생산량(에너지수)"),
            "energy_high": spec.get("생산량(에너지높이)"),
        })
    # 프론트와 명세 모두 호환되도록 중복 키 제공
    return {"types": payload, "generator_types": [
        {
            "generator_type_id": t.generator_type_id,
            "name": t.name,
            "description": t.description,
            "cost": _spec_cost(t.name, getattr(t, "cost", 1)),
            "index": DEFAULT_GENERATOR_NAME_TO_INDEX.get(t.name),
            "cost_data": DEFAULT_GENERATOR_SPEC_BY_NAME.get(t.name, {}).get("설치비용(수)"),
            "cost_high": DEFAULT_GENERATOR_SPEC_BY_NAME.get(t.name, {}).get("설치비용(높이)"),
            "energy_data": DEFAULT_GENERATOR_SPEC_BY_NAME.get(t.name, {}).get("생산량(에너지수)"),
            "energy_high": DEFAULT_GENERATOR_SPEC_BY_NAME.get(t.name, {}).get("생산량(에너지높이)"),
        }
        for t in types
    ]}
