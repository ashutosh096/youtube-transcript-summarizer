import React, { useState, useEffect, useRef } from 'react';
import { Search, X, MessageSquareCode, Anchor } from 'lucide-react';

export default function TranscriptView({ segments, onSeek, searchQuery, onSearchQueryChange, currentTime }) {
  const [localQuery, setLocalQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef(null);

  const query = searchQuery !== undefined ? searchQuery : localQuery;
  const setQuery = onSearchQueryChange !== undefined ? onSearchQueryChange : setLocalQuery;

  // Helper to format seconds (e.g., 125 -> "02:05")
  const formatTime = (seconds) => {
    if (seconds === undefined || seconds === null) return '00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const pad = (num) => num.toString().padStart(2, '0');

    if (hrs > 0) {
      return `${hrs}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

  const filteredSegments = segments.filter((seg) =>
    seg.text.toLowerCase().includes(query.toLowerCase())
  );

  // Calculate active index based on currentTime
  const activeIndex = segments.findIndex((seg, idx) => {
    const nextSeg = segments[idx + 1];
    return currentTime >= seg.start && (!nextSeg || currentTime < nextSeg.start);
  });

  // Smooth scroll container to the active element
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      const activeEl = containerRef.current.querySelector('.transcript-item.active');
      if (activeEl) {
        activeEl.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        });
      }
    }
  }, [activeIndex, autoScroll]);

  // Helper to highlight matching search query text
  const highlightText = (text, highlight) => {
    if (!highlight.trim()) return text;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={i} style={{ backgroundColor: 'rgba(99, 179, 237, 0.35)', color: '#fff', borderRadius: '2px', padding: '0 2px' }}>
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  return (
    <div className="summary-container">
      {/* Search & Sync Header */}
      <div className="transcript-search-header">
        <div className="transcript-search-box">
          <Search size={16} />
          <input
            type="text"
            className="search-input"
            placeholder="Search transcript keywords..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <X size={16} />
            </button>
          )}
        </div>
        <button
          className={`autoscroll-toggle-btn ${autoScroll ? 'active' : ''}`}
          onClick={() => setAutoScroll(!autoScroll)}
          title="Toggle transcript auto-scroll during video playback"
        >
          <Anchor size={13} />
          <span>Sync</span>
        </button>
      </div>

      {/* Transcript Scroll Area */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }} ref={containerRef}>
        {filteredSegments.length > 0 ? (
          <div className="transcript-list">
            {filteredSegments.map((seg, idx) => {
              const isSegActive = activeIndex !== -1 && segments[activeIndex]?.start === seg.start;
              return (
                <div
                  key={idx}
                  className={`transcript-item ${isSegActive ? 'active' : ''}`}
                  onClick={() => onSeek(seg.start)}
                  title="Click to jump video to this time"
                >
                  <span className="transcript-time">{formatTime(seg.start)}</span>
                  <span className="transcript-text">
                    {highlightText(seg.text, query)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="no-segments">
            <MessageSquareCode size={36} style={{ color: 'var(--text-muted)', marginBottom: '10px' }} />
            <p>
              {segments.length === 0
                ? 'No transcript segments available.'
                : 'No segments match your search query.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
