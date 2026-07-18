import React, { useEffect, useRef, useState } from 'react';
import { Play, Tv, FileText, Clock } from 'lucide-react';

export default function YoutubePlayer({ videoId, seekToTime, title, channel, wordCount, readTime, onTimeUpdate, keywords, onKeywordClick }) {
  const playerRef = useRef(null);
  const containerId = 'yt-player-element';
  const [apiReady, setApiReady] = useState(false);
  const timeUpdateInterval = useRef(null);

  const startTimeTracking = () => {
    if (timeUpdateInterval.current) clearInterval(timeUpdateInterval.current);
    timeUpdateInterval.current = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        const time = playerRef.current.getCurrentTime();
        if (typeof onTimeUpdate === 'function') {
          onTimeUpdate(time);
        }
      }
    }, 250);
  };

  const stopTimeTracking = () => {
    if (timeUpdateInterval.current) {
      clearInterval(timeUpdateInterval.current);
      timeUpdateInterval.current = null;
    }
  };

  useEffect(() => {
    // 1. Load YouTube Iframe API if not loaded
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      // Callback when API is ready
      window.onYouTubeIframeAPIReady = () => {
        setApiReady(true);
      };
    } else {
      setApiReady(true);
    }

    return () => {
      stopTimeTracking();
    };
  }, []);

  useEffect(() => {
    // 2. Initialize or update the player when videoId or apiReady changes
    if (!apiReady || !videoId) return;

    if (playerRef.current) {
      // If player exists, load the new video
      try {
        playerRef.current.loadVideoById(videoId);
      } catch (e) {
        console.error("Failed to load video on existing player", e);
      }
    } else {
      // Create new player
      playerRef.current = new window.YT.Player(containerId, {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
          playsinline: 1,
          rel: 0,
        },
        events: {
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              startTimeTracking();
            } else {
              stopTimeTracking();
            }
          }
        }
      });
    }

    return () => {
      // Don't destroy immediately to prevent flashing during fast swaps,
      // but clean up on unmount.
    };
  }, [videoId, apiReady]);

  // 3. React to seekToTime updates
  useEffect(() => {
    if (seekToTime !== null && playerRef.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(seekToTime, true);
      // Optional: automatically play
      try {
        playerRef.current.playVideo();
      } catch (e) {}
    }
  }, [seekToTime]);

  return (
    <div className="glass-card">
      <div className="video-player-container">
        {/* The YouTube player element */}
        <div id={containerId}></div>
      </div>
      <div className="video-details">
        <h3 className="video-title-text">{title || 'Loading Video Title...'}</h3>
        <div className="video-channel-text" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Tv size={14} />
          <span>{channel || 'Loading Creator Info...'}</span>
        </div>
        <div className="video-stats-bar">
          <div className="stat-pill">
            <FileText size={12} />
            <span>{wordCount ? `${wordCount.toLocaleString()} words` : '— words'}</span>
          </div>
          <div className="stat-pill">
            <Clock size={12} />
            <span>{readTime ? `~${readTime} min read` : '— min read'}</span>
          </div>
        </div>
        {keywords && keywords.length > 0 && (
          <div className="video-keywords-row">
            <span className="keywords-label">Concepts:</span>
            <div className="keywords-list">
              {keywords.map((kw, idx) => (
                <button
                  key={idx}
                  className="keyword-pill"
                  onClick={() => onKeywordClick && onKeywordClick(kw)}
                  title={`Search "${kw}" in transcript`}
                >
                  #{kw}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
