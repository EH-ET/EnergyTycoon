from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import GeneratorType
from ..init_db import DEFAULT_GENERATOR_NAME_TO_INDEX, DEFAULT_GENERATOR_TYPES

DEFAULT_GENERATOR_SPEC_BY_NAME = {g["이름"]: g for g in DEFAULT_GENERATOR_TYPES}

router = APIRouter()


@router.get("/generator_types")
async def generator_types(db: Session = Depends(get_db)):
    try:
        types = db.query(GeneratorType).all()
        payload = []
        for t in types:
            idx = DEFAULT_GENERATOR_NAME_TO_INDEX.get(t.name)
            spec = DEFAULT_GENERATOR_SPEC_BY_NAME.get(t.name, {})
            payload.append({
                "id": t.generator_type_id,
                "name": t.name or "",
                "cost_data": t.cost_data if hasattr(t, 'cost_data') else 0,
                "cost_high": t.cost_high if hasattr(t, 'cost_high') else 0,
                "description": t.description or "",
                "index": idx,
                "energy_data": spec.get("생산량(에너지수)", 0),
                "energy_high": spec.get("생산량(에너지높이)", 0),
            })
        # 프론트와 명세 모두 호환되도록 중복 키 제공
        return {"types": payload, "generator_types": [
            {
                "generator_type_id": t.generator_type_id,
                "name": t.name or "",
                "description": t.description or "",
                "cost_data": t.cost_data if hasattr(t, 'cost_data') else 0,
                "cost_high": t.cost_high if hasattr(t, 'cost_high') else 0,
                "index": DEFAULT_GENERATOR_NAME_TO_INDEX.get(t.name),
                "energy_data": DEFAULT_GENERATOR_SPEC_BY_NAME.get(t.name, {}).get("생산량(에너지수)", 0),
                "energy_high": DEFAULT_GENERATOR_SPEC_BY_NAME.get(t.name, {}).get("생산량(에너지높이)", 0),
            }
            for t in types
        ]}
    except Exception as e:
        import logging
        logging.error(f"Error in generator_types endpoint: {e}")
        # Return empty lists to prevent frontend crash
        return {"types": [], "generator_types": []}

