import { useState, useEffect, useRef, useCallback } from 'react';

const useAudioPlayer = (playlist) => {
  const audioRef = useRef(new Audio());
  audioRef.current.muted = true; // Start muted
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 1
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(true); // New state for mute status

  const currentTrack = playlist[currentTrackIndex];

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
  }, []);

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

  // Effect to trigger initial autoplay for the first track
  useEffect(() => {
    if (!isPlaying && currentTrack) {
      play();
    }
  }, [currentTrack, isPlaying, play]);

  // Effect to unmute on first user interaction
  useEffect(() => {
    const handleUserInteraction = () => {
      if (isMuted) {
        toggleMute();
      }
      // Remove listener after first interaction
      window.removeEventListener('mousedown', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
    };

    // Add listeners
    window.addEventListener('mousedown', handleUserInteraction);
    window.addEventListener('keydown', handleUserInteraction);
    window.addEventListener('touchstart', handleUserInteraction);

    return () => {
      // Clean up listeners if component unmounts before interaction
      window.removeEventListener('mousedown', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
    };
  }, [isMuted, toggleMute]);

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
  };
};

export default useAudioPlayer;
