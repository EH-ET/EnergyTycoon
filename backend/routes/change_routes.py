from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..dependencies import get_user_and_db
from ..game_logic import current_market_rate, calculate_progressive_exchange, calculate_money_to_proton_rate
from ..schemas import ExchangeIn, UserOut
from ..models import User
from ..bigvalue import (
    BigValue,
    get_user_energy_value,
    set_user_energy_value,
    get_user_money_value,
    set_user_money_value,
    get_user_sold_energy_value,
    set_user_sold_energy_value,
    get_user_proton_value,
    set_user_proton_value,
    compare,
    subtract_values,
    add_values,
    multiply_values,
    from_plain,
    normalize,
    to_payload,
    normalize_value,
)

router = APIRouter()


def _ensure_same_user(user: User, target_user_id: str | None):
    if target_user_id and user.user_id != target_user_id:
        raise HTTPException(status_code=403, detail="User mismatch")


@router.post("/change/energy2money")
async def energy2money(payload: ExchangeIn, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    _ensure_same_user(user, payload.user_id)
    
    # Payload 처리: BigValue 필수
    if payload.amount_data is None or payload.amount_high is None:
        raise HTTPException(status_code=400, detail="Amount data and high must be provided")
        
    amount_bv = normalize(BigValue(payload.amount_data, payload.amount_high))
    
    if amount_bv.data <= 0 and amount_bv.high <= 0:
         raise HTTPException(status_code=400, detail="Invalid amount")

    energy_value = get_user_energy_value(user)
    
    # 잔액 확인
    # compare(left, right) -> 1, 0, -1
    if compare(energy_value, amount_bv) < 0:
        raise HTTPException(status_code=400, detail="Not enough energy")

    # 점진적 환율 적용하여 실제 획득량 계산 (BigValue 반환)
    gained_bv, avg_rate = calculate_progressive_exchange(user, amount_bv)
    # avg_rate is float, convert to BigValue (multiply by 1000 for DATA_SCALE)
    rate_bv = normalize_value(BigValue(int(max(avg_rate, 0) * 1000), 0))
    rate_payload = to_payload(rate_bv)

    # BigValue 연산으로 차감 및 지급
    energy_value = subtract_values(energy_value, amount_bv)
    money_value = add_values(get_user_money_value(user), gained_bv)

    set_user_energy_value(user, energy_value)
    set_user_money_value(user, money_value)

    # Update user's sold_energy (BigValue)
    sold_energy_value = get_user_sold_energy_value(user)
    new_sold_energy_value = add_values(sold_energy_value, amount_bv)
    set_user_sold_energy_value(user, new_sold_energy_value)

    db.commit()
    db.refresh(user)
    gained_payload = to_payload(gained_bv)
    return {
        "energy_data": user.energy_data,
        "energy_high": user.energy_high,
        "money_data": user.money_data,
        "money_high": user.money_high,
        "rate": avg_rate,
        "rate_data": rate_payload["data"],
        "rate_high": rate_payload["high"],
        "gained_data": gained_payload["data"],
        "gained_high": gained_payload["high"],
        "user": UserOut.model_validate(user),
    }


@router.get("/change/rate")
async def get_exchange_rate(auth=Depends(get_user_and_db)):
    user, _, _ = auth
    rate = current_market_rate(user)
    # rate is float, convert to BigValue (multiply by 1000 for DATA_SCALE)
    rate_bv = normalize_value(BigValue(int(max(rate, 0) * 1000), 0))
    rate_payload = to_payload(rate_bv)
    return {"rate": rate, "rate_data": rate_payload["data"], "rate_high": rate_payload["high"]}


@router.post("/change/money2proton")
async def money2proton(payload: ExchangeIn, auth=Depends(get_user_and_db)):
    try:
        user, db, _ = auth
        _ensure_same_user(user, payload.user_id)
        
        print(f"DEBUG: money2proton request from user={user.user_id}")
        
        # Payload 처리: BigValue 필수
        if payload.amount_data is None or payload.amount_high is None:
            raise HTTPException(status_code=400, detail="Amount data and high must be provided")
            
        amount_bv = normalize(BigValue(payload.amount_data, payload.amount_high))
        print(f"DEBUG: amount_bv = {amount_bv}")
        
        if amount_bv.data <= 0 and amount_bv.high <= 0:
             raise HTTPException(status_code=400, detail="Invalid amount")

        money_value = get_user_money_value(user)
        print(f"DEBUG: money_value = {money_value}")
        
        # 잔액 확인
        if compare(money_value, amount_bv) < 0:
            print("DEBUG: Not enough money")
            raise HTTPException(status_code=400, detail="돈이 부족합니다.")

        # 환율 계산 및 양성자 획득량 계산 (BigValue)
        print("DEBUG: calculating rate...")
        rate_bv = calculate_money_to_proton_rate(user)
        print(f"DEBUG: rate_bv = {rate_bv}")
        
        gained_bv = multiply_values(amount_bv, rate_bv)
        print(f"DEBUG: gained_bv = {gained_bv}")
        
        # BigValue 연산으로 차감 및 지급
        money_value = subtract_values(money_value, amount_bv)
        
        print("DEBUG: accessing proton value...")
        proton_value = add_values(get_user_proton_value(user), gained_bv)
        print(f"DEBUG: new proton_value = {proton_value}")

        set_user_money_value(user, money_value)
        set_user_proton_value(user, proton_value)

        print("DEBUG: commiting...")
        db.commit()
        db.refresh(user)
        
        gained_payload = to_payload(gained_bv)
        rate_payload = to_payload(rate_bv)
        
        print("DEBUG: returning response...")
        return {
            "money_data": user.money_data,
            "money_high": user.money_high,
            "proton_data": user.proton_data,
            "proton_high": user.proton_high,
            "rate_data": rate_payload["data"],
            "rate_high": rate_payload["high"],
            "gained_data": gained_payload["data"],
            "gained_high": gained_payload["high"],
            "user": UserOut.model_validate(user),
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"DEBUG: money2proton EXCEPTION: {e}")
        raise HTTPException(status_code=500, detail=f"Server Error: {str(e)}")


@router.get("/change/proton_rate")
async def get_proton_rate(auth=Depends(get_user_and_db)):
    user, _, _ = auth
    rate_bv = calculate_money_to_proton_rate(user)
    rate_payload = to_payload(rate_bv)
    return {"rate_data": rate_payload["data"], "rate_high": rate_payload["high"]}
