from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import time
from typing import List

from ..dependencies import get_user_and_db
from ..models import User, Inquiry
from ..schemas import InquiryCreate, InquiryOut

router = APIRouter()

# Admin user ID - only this user can access admin functions
ADMIN_USER_ID = "2ebc9ede-8865-46f6-b02c-aa7ee731c787"


def check_admin(user: User):
    """Check if user is admin. Raises HTTPException if not."""
    if user.user_id != ADMIN_USER_ID:
        raise HTTPException(status_code=403, detail="Admin access required")


@router.post("/inquiries", response_model=InquiryOut)
async def create_inquiry(inquiry: InquiryCreate, auth=Depends(get_user_and_db)):
    """Create a new inquiry."""
    user, db, _ = auth
    
    # Validate inquiry type
    valid_types = ["bug", "vulnerability", "proposal", "other"]
    if inquiry.type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid inquiry type. Must be one of: {valid_types}")
    
    new_inquiry = Inquiry(
        user_id=user.user_id,
        type=inquiry.type,
        content=inquiry.content,
        created_at=int(time.time() * 1000)
    )
    db.add(new_inquiry)
    db.commit()
    db.refresh(new_inquiry)
    
    # Return with username
    result = InquiryOut(
        inquiry_id=new_inquiry.inquiry_id,
        user_id=new_inquiry.user_id,
        username=user.username,
        type=new_inquiry.type,
        content=new_inquiry.content,
        created_at=new_inquiry.created_at
    )
    
    return result


@router.get("/inquiries", response_model=List[InquiryOut])
async def get_inquiries(auth=Depends(get_user_and_db)):
    """Get all inquiries (for admin page)."""
    user, db, _ = auth
    
    # Check if user is admin
    check_admin(user)
    
    inquiries = db.query(Inquiry).order_by(Inquiry.created_at.desc()).all()
    
    # Join with User to get username
    result = []
    for inquiry in inquiries:
        u = db.query(User).filter(User.user_id == inquiry.user_id).first()
        username = u.username if u else "Unknown"
        
        i_out = InquiryOut(
            inquiry_id=inquiry.inquiry_id,
            user_id=inquiry.user_id,
            username=username,
            type=inquiry.type,
            content=inquiry.content,
            created_at=inquiry.created_at
        )
        result.append(i_out)
        
    return result


@router.post("/inquiries/{inquiry_id}/accept")
async def accept_inquiry(inquiry_id: str, auth=Depends(get_user_and_db)):
    """Accept an inquiry - give user +1 supercoin and delete inquiry."""
    user, db, _ = auth
    
    # Check if user is admin
    check_admin(user)
    
    inquiry = db.query(Inquiry).filter(Inquiry.inquiry_id == inquiry_id).first()
    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    
    # Give supercoin to user
    submitter = db.query(User).filter(User.user_id == inquiry.user_id).first()
    if submitter:
        submitter.supercoin += 1
        db.add(submitter)
    
    # Delete inquiry
    db.delete(inquiry)
    db.commit()
    
    return {"status": "accepted", "user_id": inquiry.user_id}


@router.post("/inquiries/{inquiry_id}/reject")
async def reject_inquiry(inquiry_id: str, auth=Depends(get_user_and_db)):
    """Reject an inquiry - just delete it."""
    user, db, _ = auth
    
    # Check if user is admin
    check_admin(user)
    
    inquiry = db.query(Inquiry).filter(Inquiry.inquiry_id == inquiry_id).first()
    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    
    # Just delete inquiry
    user_id = inquiry.user_id
    db.delete(inquiry)
    db.commit()
    
    return {"status": "rejected", "user_id": user_id}
