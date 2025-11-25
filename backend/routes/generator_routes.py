from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import GeneratorType
from ..init_db import DEFAULT_GENERATOR_NAME_TO_INDEX, DEFAULT_GENERATOR_TYPES

DEFAULT_GENERATOR_SPEC_BY_NAME = {g["이름"]: g for g in DEFAULT_GENERATOR_TYPES}

router = APIRouter()


@router.get("/generator_types")
async def generator_types(db: Session = Depends(get_db)):
    types = db.query(GeneratorType).all()
    payload = []
    for t in types:
        idx = DEFAULT_GENERATOR_NAME_TO_INDEX.get(t.name)
        spec = DEFAULT_GENERATOR_SPEC_BY_NAME.get(t.name, {})
        payload.append({
            "id": t.generator_type_id,
            "name": t.name,
            "cost": t.cost,
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
            "cost": t.cost,
            "index": DEFAULT_GENERATOR_NAME_TO_INDEX.get(t.name),
            "cost_data": DEFAULT_GENERATOR_SPEC_BY_NAME.get(t.name, {}).get("설치비용(수)"),
            "cost_high": DEFAULT_GENERATOR_SPEC_BY_NAME.get(t.name, {}).get("설치비용(높이)"),
            "energy_data": DEFAULT_GENERATOR_SPEC_BY_NAME.get(t.name, {}).get("생산량(에너지수)"),
            "energy_high": DEFAULT_GENERATOR_SPEC_BY_NAME.get(t.name, {}).get("생산량(에너지높이)"),
        }
        for t in types
    ]}
