import React, { useState, useEffect, useRef } from 'react';
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
  } = useAudioPlayer(playlist);

  const progressBarRef = useRef(null);

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
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: '280px',
      background: 'rgba(0, 0, 0, 0.7)',
      borderRadius: '10px',
      padding: '15px',
      color: '#fff',
      fontFamily: 'Arial, sans-serif',
      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
      zIndex: 1000,
      backdropFilter: 'blur(5px)',
      border: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
      <h4 style={{ margin: '0 0 10px', fontSize: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {currentTrack.title}
      </h4>
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
      </div>
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
