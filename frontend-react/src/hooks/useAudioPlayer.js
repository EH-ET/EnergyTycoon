import { useState, useEffect, useRef, useCallback } from 'react';

const useAudioPlayer = (playlist) => {
  const audioRef = useRef(new Audio());
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 1
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false); // Start unmuted
  const [isStart, setIsStart] = useState(false); // New state for first interaction

  const play = useCallback(() => {
    audioRef.current.play().catch(e => console.error("Error playing audio:", e));
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    audioRef.current.pause();
    setIsPlaying(false);
  }, []);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      audioRef.current.muted = !prev;
      return !prev;
    });
  }, []);

  const seek = useCallback((time) => {
    audioRef.current.currentTime = time;
    setCurrentTime(time);
    setProgress(time / audioRef.current.duration);
  }, [seek]);

  const seekByProgress = useCallback((newProgress) => {
    const newTime = newProgress * audioRef.current.duration;
    seek(newTime);
  }, [seek]);

  const playNextTrack = useCallback(() => {
    const nextIndex = (currentTrackIndex + 1) % playlist.length;
    setCurrentTrackIndex(nextIndex);
    setIsPlaying(true); // Keep playing
  }, [currentTrackIndex, playlist.length]);

  const playPreviousTrack = useCallback(() => {
    const prevIndex = (currentTrackIndex - 1 + playlist.length) % playlist.length;
    setCurrentTrackIndex(prevIndex);
    setIsPlaying(true); // Keep playing
  }, [currentTrackIndex, playlist.length]);

  const playRandomTrack = useCallback(() => {
    let randomIndex = Math.floor(Math.random() * playlist.length);
    while (randomIndex === currentTrackIndex && playlist.length > 1) {
      randomIndex = Math.floor(Math.random() * playlist.length);
    }
    setCurrentTrackIndex(randomIndex);
    setIsPlaying(true); // Keep playing
  }, [currentTrackIndex, playlist.length]);

  const currentTrack = playlist[currentTrackIndex];

  // Effect to trigger initial play when isStart becomes true
  useEffect(() => {
    if (isStart && !isPlaying && currentTrack) {
      play();
    }
  }, [isStart, currentTrack, play]); // Removed isPlaying from dependencies

  // Effect to set isStart to true on first user interaction
  useEffect(() => {
    const handleUserInteraction = () => {
      setIsStart(true);
      // Remove listener after first interaction
      window.removeEventListener('mousedown', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
      window.removeEventListener('mousemove', handleUserInteraction); // Add mousemove
    };

    if (!isStart) { // Only add listeners if not started yet
      window.addEventListener('mousedown', handleUserInteraction);
      window.addEventListener('keydown', handleUserInteraction);
      window.addEventListener('touchstart', handleUserInteraction);
      window.addEventListener('mousemove', handleUserInteraction); // Add mousemove
    }

    return () => {
      // Clean up listeners if component unmounts or isStart becomes true
      window.removeEventListener('mousedown', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
      window.removeEventListener('mousemove', handleUserInteraction);
    };
  }, [isStart, setIsStart]); // Dependencies for this effect

  return {
    currentTrack: currentTrack ? { ...currentTrack, title: currentTrack.title || currentTrack.src.split('/').pop().replace('.mp3', '') } : null,
    isPlaying,
    progress,
    duration,
    currentTime,
    play,
    pause,
    togglePlayPause,
    seek,
    seekByProgress,
    playNextTrack,
    playPreviousTrack,
    playRandomTrack,
    isMuted, // Expose mute state
    toggleMute, // Expose mute toggle function
    isStart, // Expose isStart state
  };
};

export default useAudioPlayer;