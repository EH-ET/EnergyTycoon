import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { getTutorialStep } from '../utils/tutorialSteps';
import { updateTutorialProgress, skipTutorial } from '../utils/apiClient';
import { getRequiredAction, onTutorialEvent } from '../utils/tutorialEvents';
import './TutorialOverlay.css';

export default function TutorialOverlay() {
  const currentUser = useStore(state => state.currentUser);
  const syncUserState = useStore(state => state.syncUserState);
  const [currentStep, setCurrentStep] = useState(null);
  const [highlightedElement, setHighlightedElement] = useState(null);
  const [highlightedElements, setHighlightedElements] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    const tutorialStep = currentUser.tutorial;

    // Tutorial not started, completed, or skipped
    if (!tutorialStep || tutorialStep === 0 || tutorialStep > 20) {
      setCurrentStep(null);
      setHighlightedElement(null);
      setHighlightedElements([]);
      return;
    }

    const step = getTutorialStep(tutorialStep);
    if (step) {
      setCurrentStep(step);

      // Find and highlight element(s)
      if (step.highlightSelector) {
        setTimeout(() => {
          if (Array.isArray(step.highlightSelector)) {
            // Multiple selectors
            const elements = step.highlightSelector
              .map(selector => document.querySelector(selector))
              .filter(el => el !== null);
            
            // Boost z-index of highlighted elements
            elements.forEach(el => {
              el.style.position = 'relative';
              el.style.zIndex = '10000';
            });
            
            setHighlightedElements(elements);
            setHighlightedElement(elements[0] || null);
          } else {
            // Single selector
            const element = document.querySelector(step.highlightSelector);
            if (element) {
              element.style.position = 'relative';
              element.style.zIndex = '10000';
            }
            setHighlightedElement(element);
            setHighlightedElements(element ? [element] : []);
          }
        }, 100);
      }
    }
    
    // Cleanup: reset z-index when step changes
    return () => {
      document.querySelectorAll('[style*="z-index: 10000"]').forEach(el => {
        el.style.zIndex = '';
        if (el.style.position === 'relative' && !el.className.includes('positioned')) {
          el.style.position = '';
        }
      });
    };
  }, [currentUser?.tutorial]);

  // Listen for drag events on highlighted elements
  useEffect(() => {
    if (highlightedElements.length === 0) return;

    const handleDragStart = () => {
      setIsDragging(true);
    };

    const handleDragEnd = () => {
      setIsDragging(false);
    };

    highlightedElements.forEach(element => {
      element.addEventListener('dragstart', handleDragStart);
      element.addEventListener('dragend', handleDragEnd);
    });
    document.addEventListener('drop', handleDragEnd);

    return () => {
      highlightedElements.forEach(element => {
        element.removeEventListener('dragstart', handleDragStart);
        element.removeEventListener('dragend', handleDragEnd);
      });
      document.removeEventListener('drop', handleDragEnd);
    };
  }, [highlightedElements]);

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
      const data = await updateTutorialProgress(nextStep > 20 ? 0 : nextStep);

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
      const data = await skipTutorial();
      syncUserState({ ...currentUser, tutorial: data.tutorial });
    } catch (error) {
      console.error('Failed to skip tutorial:', error);
    }
  };

  if (!currentStep || !currentUser || currentUser.tutorial === 0) {
    return null;
  }

  // Calculate position for tooltip
  // Calculate position for tooltip
  const getTooltipPosition = () => {
    if (!highlightedElement) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    
    const rect = highlightedElement.getBoundingClientRect();
    const position = currentStep.position || 'bottom';
    const screenWidth = window.innerWidth;
    
    // Check if element is near edges
    const isNearRightEdge = rect.left > screenWidth * 0.7;
    const isNearLeftEdge = rect.right < screenWidth * 0.3;
    
    let style = {};
    
    switch (position) {
      case 'top':
        style.top = `${rect.top - 15}px`;
        if (isNearRightEdge) {
          style.right = '20px';
          style.transform = 'translate(0, -100%)';
        } else if (isNearLeftEdge) {
          style.left = '20px';
          style.transform = 'translate(0, -100%)';
        } else {
          style.left = `${rect.left + rect.width / 2}px`;
          style.transform = 'translate(-50%, -100%)';
        }
        break;

      case 'bottom':
        style.top = `${rect.bottom + 15}px`;
        if (isNearRightEdge) {
          style.right = '20px';
          style.transform = 'translate(0, 0)';
        } else if (isNearLeftEdge) {
          style.left = '20px';
          style.transform = 'translate(0, 0)';
        } else {
          style.left = `${rect.left + rect.width / 2}px`;
          style.transform = 'translate(-50%, 0)';
        }
        break;

      case 'left':
        style.top = `${rect.top + rect.height / 2}px`;
        style.left = `${rect.left - 15}px`;
        style.transform = 'translate(-100%, -50%)';
        break;

      case 'right':
        style.top = `${rect.top + rect.height / 2}px`;
        style.left = `${rect.right + 15}px`;
        style.transform = 'translate(0, -50%)';
        break;

      case 'center':
      default:
        style.top = '50%';
        style.left = '50%';
        style.transform = 'translate(-50%, -50%)';
        break;
    }
    
    return style;
  };

  return (
    <>
      {/* Progress Indicator at top center */}
      <div className="tutorial-progress-indicator">
        튜토리얼 진행 중: {currentStep.id} / 20
      </div>
      
      {/* Overlay with cutouts for highlighted elements */}
      {!isDragging && (
        <>
          {/* Full overlay */}
          <div className="tutorial-overlay" />
          
          {/* Transparent cutouts over highlighted elements */}
          {highlightedElements.map((el, index) => {
            const rect = el.getBoundingClientRect();
            return (
              <React.Fragment key={index}>
                {/* Transparent area to allow interaction */}
                <div
                  style={{
                    position: 'fixed',
                    top: `${rect.top}px`,
                    left: `${rect.left}px`,
                    width: `${rect.width}px`,
                    height: `${rect.height}px`,
                    zIndex: 9999,
                    background: 'transparent',
                    pointerEvents: 'none'
                  }}
                />
                {/* Highlight border */}
                <div 
                  className="tutorial-highlight"
                  style={{
                    top: `${rect.top - 4}px`,
                    left: `${rect.left - 4}px`,
                    width: `${rect.width + 8}px`,
                    height: `${rect.height + 8}px`,
                  }}
                />
              </React.Fragment>
            );
          })}
        </>
      )}
      
      {/* Tutorial tooltip */}
      <div 
        className="tutorial-tooltip"
        style={getTooltipPosition()}
      >
        <div className="tutorial-step-number">
          Step {currentStep.id} / 20
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
          {!currentStep.requiredAction && (
            <button 
              className="tutorial-btn tutorial-btn-next"
              onClick={handleNext}
            >
              {currentStep.id === 20 ? '완료' : '다음으로'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
