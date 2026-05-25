import React, { useState } from 'react';
import { Search, X, MessageSquareCode } from 'lucide-react';

export default function TranscriptView({ segments, onSeek }) {
  const [searchQuery, setSearchQuery] = useState('');

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
    seg.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Helper to highlight matching text
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
      {/* Search Box */}
      <div className="transcript-search-box">
        <Search size={16} />
        <input
          type="text"
          className="search-input"
          placeholder="Search transcript keywords..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Transcript Scroll Area */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
        {filteredSegments.length > 0 ? (
          <div className="transcript-list">
            {filteredSegments.map((seg, idx) => (
              <div
                key={idx}
                className="transcript-item"
                onClick={() => onSeek(seg.start)}
                title="Click to jump video to this time"
              >
                <span className="transcript-time">{formatTime(seg.start)}</span>
                <span className="transcript-text">
                  {highlightText(seg.text, searchQuery)}
                </span>
              </div>
            ))}
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
