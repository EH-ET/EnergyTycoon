import { useEffect, useState } from 'react';
import { useStore, getAuthToken } from '../store/useStore';
import { getTutorialStep } from '../utils/tutorialSteps';
import { updateTutorialProgress, skipTutorial } from '../utils/apiClient';
import { getRequiredAction, onTutorialEvent } from '../utils/tutorialEvents';
import './TutorialOverlay.css';

export default function TutorialOverlay() {
  const currentUser = useStore(state => state.currentUser);
  const syncUserState = useStore(state => state.syncUserState);
  const [currentStep, setCurrentStep] = useState(null);
  const [highlightedElement, setHighlightedElement] = useState(null);

  useEffect(() => {
    if (!currentUser || !currentUser.tutorial) return;
    
    const tutorialStep = currentUser.tutorial;
    
    // Tutorial completed or skipped
    if (tutorialStep === 0 || tutorialStep > 11) {
      setCurrentStep(null);
      return;
    }

    const step = getTutorialStep(tutorialStep);
    if (step) {
      setCurrentStep(step);
      
      // Find and highlight element
      if (step.highlightSelector) {
        setTimeout(() => {
          const element = document.querySelector(step.highlightSelector);
          setHighlightedElement(element);
        }, 100);
      }
    }
  }, [currentUser]);

  // Listen for required actions
  useEffect(() => {
    if (!currentStep || !currentUser) return;
    
    const requiredAction = getRequiredAction(currentStep.id);
    if (!requiredAction) return;
    
    const handleActionComplete = () => {
      // Automatically advance to next step when action is completed
      handleNext();
    };
    
    const cleanup = onTutorialEvent(requiredAction, handleActionComplete);
    return cleanup;
  }, [currentStep, currentUser]);

  const handleNext = async () => {
    if (!currentStep || !currentUser) return;
    
    try {
      const nextStep = currentStep.id + 1;
      const data = await updateTutorialProgress(nextStep > 11 ? 0 : nextStep, getAuthToken());
      
      // Update user state
      syncUserState({ ...currentUser, tutorial: data.tutorial });
    } catch (error) {
      console.error('Failed to update tutorial:', error);
    }
  };

  const handleSkip = async () => {
    if (!currentUser) return;
    
    if (!window.confirm('튜토리얼을 건너뛰시겠습니까?')) return;
    
    try {
      const data = await skipTutorial(getAuthToken());
      syncUserState({ ...currentUser, tutorial: data.tutorial });
    } catch (error) {
      console.error('Failed to skip tutorial:', error);
    }
  };

  if (!currentStep || !currentUser || currentUser.tutorial === 0) {
    return null;
  }

  // Calculate position for tooltip
  const getTooltipPosition = () => {
    if (!highlightedElement) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    
    const rect = highlightedElement.getBoundingClientRect();
    const position = currentStep.position || 'bottom';
    
    switch (position) {
      case 'top':
        return {
          top: `${rect.top - 20}px`,
          left: `${rect.left + rect.width / 2}px`,
          transform: 'translate(-50%, -100%)'
        };
      case 'bottom':
        return {
          top: `${rect.bottom + 20}px`,
          left: `${rect.left + rect.width / 2}px`,
          transform: 'translate(-50%, 0)'
        };
      case 'left':
        return {
          top: `${rect.top + rect.height / 2}px`,
          left: `${rect.left - 20}px`,
          transform: 'translate(-100%, -50%)'
        };
      case 'right':
        return {
          top: `${rect.top + rect.height / 2}px`,
          left: `${rect.right + 20}px`,
          transform: 'translate(0, -50%)'
        };
      case 'center':
      default:
        return {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        };
    }
  };

  return (
    <>
      {/* Progress Indicator at top center */}
      <div className="tutorial-progress-indicator">
        튜토리얼 진행 중: {currentStep.id} / 11
      </div>
      
      {/* Dark overlay */}
      <div className="tutorial-overlay" onClick={(e) => {
        if (e.target === e.currentTarget) {
          // Clicked on overlay, do nothing
        }
      }} />
      
      {/* Highlighted element cutout */}
      {highlightedElement && (
        <div 
          className="tutorial-highlight"
          style={{
            top: `${highlightedElement.getBoundingClientRect().top - 4}px`,
            left: `${highlightedElement.getBoundingClientRect().left - 4}px`,
            width: `${highlightedElement.getBoundingClientRect().width + 8}px`,
            height: `${highlightedElement.getBoundingClientRect().height + 8}px`,
          }}
        />
      )}
      
      {/* Tutorial tooltip */}
      <div 
        className="tutorial-tooltip"
        style={getTooltipPosition()}
      >
        <div className="tutorial-step-number">
          Step {currentStep.id} / 11
        </div>
        <h3 className="tutorial-title">{currentStep.title}</h3>
        <p className="tutorial-content">{currentStep.content}</p>
        <div className="tutorial-actions">
          <button 
            className="tutorial-btn tutorial-btn-skip"
            onClick={handleSkip}
          >
            건너뛰기
          </button>
          <button 
            className="tutorial-btn tutorial-btn-next"
            onClick={handleNext}
          >
            {currentStep.id === 11 ? '완료' : '다음'}
          </button>
        </div>
      </div>
    </>
  );
}
