import React, { useState, useEffect, useRef } from 'react';
import useAudioPlayer from '../hooks/useAudioPlayer';

const MusicPlayerModal = ({ playlist }) => {
  console.log("MusicPlayerModal: Attempting to render simple red box.");
  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: '100px',
      height: '100px',
      background: 'red',
      zIndex: 99999,
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '10px',
      boxShadow: '0 0 10px rgba(0,0,0,0.5)'
    }}>
      TEST
    </div>
  );
};

const buttonStyle = { // Keep buttonStyle for now, might be used later
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
