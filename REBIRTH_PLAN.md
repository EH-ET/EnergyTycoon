# Rebirth Feature Implementation Summary

## Overview
Implemented the Rebirth system that allows players to reset their progress in exchange for permanent multipliers. The system uses **BigValue** for handling large rebirth costs.

## Key Features

### Rebirth Mechanics
- **Cost Formula**: `1T × 8^n` (where n = current rebirth count)
- **Production Multiplier**: `2^n` 
- **Exchange Rate Multiplier**: `2^n`
- **Reset on Rebirth**:
  - All Generators deleted
  - Energy reset to 0
  - Money deducted by rebirth cost
  - All upgrades reset to 0

### BigValue Integration
The rebirth cost uses the BigValue system to handle extremely large numbers:
- Backend: `from_plain()`, `compare()`, `subtract_values()`, `to_payload()`
- Frontend: `valueFromServer()`, `toPlainValue()` for display and comparisons

## Files Changed

### Backend
1. **models.py**: Added `Rebirth` model with relationship to `User`
2. **schemas.py**: Added `RebirthOut` schema and `rebirth_count` to `UserOut`
3. **routes/rebirth_routes.py** (NEW): 
   - `GET /rebirth/info` - Get rebirth stats
   - `POST /rebirth` - Perform rebirth
4. **main.py**: Registered `rebirth_routes` router
5. **game_logic.py**: Added rebirth multiplier to exchange rate calculation

### Frontend
1. **utils/apiClient.js**: Added `fetchRebirthInfo()` and `performRebirth()`
2. **components/tabs/RebirthTab.jsx** (NEW): UI for rebirth system
3. **components/Footer.jsx**: Added "환생" button
4. **App.jsx**: Imported and rendered `RebirthTab`
5. **hooks/useEnergyTimer.js**: Applied rebirth multiplier to energy production

## Testing Instructions

1. **Get Money**: Accumulate 1T money (1,000,000,000,000)
   - Use gameplay or modify DB directly for testing
   
2. **Open Rebirth Tab**: Click "환생" button in footer

3. **Check Info**:
   - Current rebirth count: 0
   - Cost: 1,000,000,000,000
   - Multiplier: 1

4. **Perform Rebirth**: Click "환생하기"
   - Confirm dialog
   - Verify generators cleared
   - Verify money deducted
   - Verify rebirth count = 1

5. **Check Multipliers**:
   - Build generator → energy production should be 2x base
   - Trade energy → exchange rate should be 2x base

6. **Second Rebirth**:
   - Cost: 8T (8,000,000,000,000)
   - Multiplier: 4x after second rebirth

## Balance Notes
- First rebirth: 1T cost → 2x multiplier
- Second rebirth: 8T cost → 4x multiplier  
- Third rebirth: 64T cost → 8x multiplier
- Growth is exponential on both cost and reward