"""
Tutorial progress management routes.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from .. import schemas
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
    
    # Auto-grant money for specific tutorial steps
    if data.step == 11:
        # Step 11: Grant 18 money for production upgrade
        current_user.money_data += 18000
    elif data.step == 13:
        # Step 13: Grant 30 money for generator upgrade
        current_user.money_data += 30000
    
    current_user.tutorial = data.step
    db.commit()
    db.refresh(current_user)
    
    return {
        "tutorial": current_user.tutorial,
        "user": schemas.UserOut.model_validate(current_user),
        "message": "Tutorial progress updated"
    }


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
