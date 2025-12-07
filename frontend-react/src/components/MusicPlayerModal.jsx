import React, { useState, useEffect, useRef, useCallback } from 'react';
import useAudioPlayer from '../hooks/useAudioPlayer';

const MusicPlayerModal = ({ playlist }) => {
  const {
    currentTrack,
    isPlaying,
    progress,
    duration,
    currentTime,
    togglePlayPause,
    seekByProgress,
    playNextTrack,
    playPreviousTrack,
    isMuted, // Get mute state
    toggleMute, // Get mute toggle function
  } = useAudioPlayer(playlist);

  const progressBarRef = useRef(null);
  const modalRef = useRef(null);

  // State for dragging
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 }); // Relative to initial fixed position
  const [startPos, setStartPos] = useState({ x: 0, y: 0 }); // Mouse start position
  const [isMinimized, setIsMinimized] = useState(false);

  // Initialize position based on fixed CSS
  useEffect(() => {
    if (modalRef.current) {
      // Calculate initial position relative to viewport bottom-right
      // This is a bit tricky with fixed positioning and transform.
      // Let's just set initial transform to 0,0 and let CSS handle fixed.
      // Dragging will then apply transform.
      setPosition({ x: 0, y: 0 });
    }
  }, []);

  const handleMouseDown = useCallback((e) => {
    setIsDragging(true);
    setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
  }, [position]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    const newX = e.clientX - startPos.x;
    const newY = e.clientY - startPos.y;
    setPosition({ x: newX, y: newY });
  }, [isDragging, startPos]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add global mouseup listener to stop dragging even if mouse leaves modal
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);


  const formatTime = (seconds) => {
    if (isNaN(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleProgressClick = (e) => {
    const progressBar = progressBarRef.current;
    if (progressBar) {
      const rect = progressBar.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const newProgress = clickX / rect.width;
      seekByProgress(newProgress);
    }
  };

  if (!currentTrack) return null;

  return (
    <div
      ref={modalRef}
      style={{
        position: 'fixed',
        bottom: '100px',
        right: '20px',
        width: '280px',
        background: 'rgba(0, 0, 0, 0.7)',
        borderRadius: '10px',
        padding: isMinimized ? '5px 15px' : '15px', // Smaller padding when minimized
        color: '#fff',
        fontFamily: 'Arial, sans-serif',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
        zIndex: 1000,
        backdropFilter: 'blur(5px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        cursor: isDragging ? 'grabbing' : 'default', // Cursor only changes when dragging is active
        transform: `translate(${position.x}px, ${position.y}px)`,
        height: isMinimized ? '40px' : 'auto', // Minimized height
        overflow: 'hidden', // Hide content when minimized
        transition: 'height 0.2s ease-out', // Smooth transition for height
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'grab', // Header is draggable
          marginBottom: isMinimized ? '0' : '10px',
        }}
        onMouseDown={handleMouseDown}
      >
        <h4 style={{ margin: '0', fontSize: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {isMinimized ? 'Music Player' : currentTrack.title}
        </h4>
        <button
          onClick={() => setIsMinimized(!isMinimized)}
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '0 5px',
            lineHeight: '1',
          }}
        >
          {isMinimized ? '□' : '−'} {/* Use '−' for minimize, '□' for restore */}
        </button>
      </div>

      {!isMinimized && (
        <>
          <div
            ref={progressBarRef}
            style={{
              width: '100%',
              height: '8px',
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '4px',
              cursor: 'pointer',
              marginBottom: '8px',
              position: 'relative'
            }}
            onClick={handleProgressClick}
          >
            <div style={{
              width: `${progress * 100}%`,
              height: '100%',
              background: '#2ecc71',
              borderRadius: '4px',
            }}></div>
            <div style={{
              position: 'absolute',
              left: `${progress * 100}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#2ecc71',
              boxShadow: '0 0 5px rgba(46, 204, 113, 0.5)'
            }}></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '15px' }}>
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
            <button onClick={playPreviousTrack} style={buttonStyle}>
              {'<<'}
            </button>
            <button onClick={togglePlayPause} style={buttonStyle}>
              {isPlaying ? '❚❚' : '▶'}
            </button>
            <button onClick={playNextTrack} style={buttonStyle}>
              {'>>'}
            </button>
            <button onClick={toggleMute} style={buttonStyle}>
              {isMuted ? '🔇' : '🔊'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const buttonStyle = {
  background: '#2ecc71',
  border: 'none',
  borderRadius: '5px',
  color: '#fff',
  fontSize: '18px',
  padding: '8px 12px',
  cursor: 'pointer',
  transition: 'background 0.2s',
};

export default MusicPlayerModal;
