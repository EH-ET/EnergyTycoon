import { useState, useEffect, useRef, useCallback } from 'react';

const useAudioPlayer = (playlist) => {
  const audioRef = useRef(new Audio());
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 1
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const currentTrack = playlist[currentTrackIndex];

  useEffect(() => {
    const audio = audioRef.current;

    const setAudioSource = () => {
      if (currentTrack) {
        audio.src = currentTrack.src;
        audio.load();
        if (isPlaying) {
          audio.play().catch(e => console.error("Error playing audio:", e));
        }
      }
    };

    setAudioSource();

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      setProgress(audio.currentTime / audio.duration);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      playRandomTrack(); // Use playRandomTrack here
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [currentTrackIndex, playlist, isPlaying, currentTrack, playRandomTrack]); // Added playRandomTrack to dependencies

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

  // Removed the duplicate useEffect for handleEnded to play random track
  // The logic is now directly in the first useEffect's handleEnded

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
  };
};

export default useAudioPlayer;
