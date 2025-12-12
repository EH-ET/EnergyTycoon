"""
Tutorial progress management routes.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..dependencies import get_user_and_db
from ..models import User

router = APIRouter()


class TutorialProgressIn(BaseModel):
    step: int


@router.post("/progress", include_in_schema=False)
def update_tutorial_progress(
    data: TutorialProgressIn,
    user_and_db: tuple = Depends(get_user_and_db)
):
    """Update tutorial progress for the current user."""
    current_user, db, _ = user_and_db
    
    if not 0 <= data.step <= 20:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tutorial step must be between 0 and 20"
        )
    
    current_user.tutorial = data.step
    db.commit()
    db.refresh(current_user)
    
    return {"tutorial": current_user.tutorial, "message": "Tutorial progress updated"}


@router.post("/skip", include_in_schema=False)
def skip_tutorial(
    user_and_db: tuple = Depends(get_user_and_db)
):
    """Skip tutorial (set to 0)."""
    current_user, db, _ = user_and_db
    
    current_user.tutorial = 0
    db.commit()
    db.refresh(current_user)
    
    return {"tutorial": current_user.tutorial, "message": "Tutorial skipped"}


@router.get("/status", include_in_schema=False)
def get_tutorial_status(
    user_and_db: tuple = Depends(get_user_and_db)
):
    """Get current tutorial status."""
    current_user, db, _ = user_and_db
    return {"tutorial": current_user.tutorial}
