"""
Tutorial progress management routes.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..database import get_db
from ..models import User
from ..auth_utils import get_current_user

router = APIRouter()


class TutorialProgressIn(BaseModel):
    step: int


@router.put("/progress")
def update_tutorial_progress(
    data: TutorialProgressIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update tutorial progress for the current user."""
    if not 0 <= data.step <= 11:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tutorial step must be between 0 and 11"
        )
    
    current_user.tutorial = data.step
    db.commit()
    db.refresh(current_user)
    
    return {"tutorial": current_user.tutorial, "message": "Tutorial progress updated"}


@router.post("/skip")
def skip_tutorial(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Skip tutorial (set to 0)."""
    current_user.tutorial = 0
    db.commit()
    db.refresh(current_user)
    
    return {"tutorial": current_user.tutorial, "message": "Tutorial skipped"}


@router.get("/status")
def get_tutorial_status(
    current_user: User = Depends(get_current_user)
):
    """Get current tutorial status."""
    return {"tutorial": current_user.tutorial}
