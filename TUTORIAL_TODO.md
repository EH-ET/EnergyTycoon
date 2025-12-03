# Tutorial System TODO

## Backend
- [ ] Add `tutorial` column to User model (Integer, default=0)
- [ ] Add database migration function to add tutorial column
- [ ] Create API endpoint to update tutorial progress (PUT /api/tutorial/progress)
- [ ] Update signup to initialize tutorial=1 for new users

## Frontend
- [ ] Create TutorialOverlay component
- [ ] Create tutorial store/context for managing tutorial state
- [ ] Implement tutorial step logic and content
- [ ] Add tutorial progression tracking
- [ ] Add tutorial skip/complete functionality
- [ ] Integrate tutorial with existing components:
  - Main scrolling (step 1)
  - Footer generator purchase (step 2)
  - Header introduction (step 3)
  - Header energy production hover (step 4)
  - Header exchange rate hover (step 5)
  - Profile settings access (step 6)
  - Trade tab explanation (step 7)
  - Global upgrade purchase (step 8)
  - Generator modal explanation (step 9)
  - Generator upgrade purchase (step 10)
  - Info tab explanation (step 11)

## Testing
- [ ] Test tutorial flow from step 1 to 11
- [ ] Test tutorial resume after logout/login
- [ ] Test tutorial skip functionality
- [ ] Test tutorial doesn't show when tutorial=0 or tutorial>11
