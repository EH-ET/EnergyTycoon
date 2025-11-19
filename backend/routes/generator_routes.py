from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import GeneratorType

router = APIRouter()


@router.get("/generator_types")
async def generator_types(db: Session = Depends(get_db)):
    types = db.query(GeneratorType).all()
    payload = [
        {"id": t.generator_type_id, "name": t.name, "cost": t.cost, "description": t.description}
        for t in types
    ]
    # 프론트와 명세 모두 호환되도록 중복 키 제공
    return {"types": payload, "generator_types": [
        {
            "generator_type_id": t.generator_type_id,
            "name": t.name,
            "description": t.description,
            "cost": t.cost,
        }
        for t in types
    ]}
