import React, { useRef, useEffect, useState } from 'react';
import { Send, MessageSquare, Trash2, HelpCircle } from 'lucide-react';

const SUGGESTIONS = [
  "Summarize the key takeaways",
  "What is the main topic?",
  "List the core arguments",
  "Summarize the conclusion"
];

export default function QAPanel({ messages, isLoading, onSendMessage, onClearChat }) {
  const [inputValue, setInputValue] = useState('');
  const chatBodyRef = useRef(null);

  // Auto-scroll to bottom of chat when new messages arrive
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    onSendMessage(inputValue.trim());
    setInputValue('');
  };

  return (
    <div className="glass-card qa-card">
      {/* QA Header */}
      <div className="qa-header">
        <div className="qa-header-title">
          <MessageSquare size={16} className="text-accent" />
          <span>Chat with Video</span>
        </div>
        {messages.length > 1 && (
          <button
            onClick={onClearChat}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.7rem',
            }}
            title="Clear Chat History"
          >
            <Trash2 size={13} />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Chat Messages Body */}
      <div className="qa-body" ref={chatBodyRef}>
        {messages.map((msg, index) => (
          <div key={index} className={`chat-bubble ${msg.role}`}>
            {msg.role === 'assistant' ? (
              // Format newlines to <br/> and bold tags simple conversion
              <span
                dangerouslySetInnerHTML={{
                  __html: msg.content
                    .replace(/\n/g, '<br/>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
                }}
              />
            ) : (
              msg.content
            )}
          </div>
        ))}

        {/* Dynamic Quick Question Chips */}
        {messages.length === 1 && !isLoading && (
          <div className="chat-suggestions-container">
            <span className="suggestions-title">Live Presentation Actions:</span>
            <div className="suggestions-grid">
              {SUGGESTIONS.map((sug, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="suggestion-chip"
                  onClick={() => onSendMessage(sug)}
                  disabled={isLoading}
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading Indicator Bubble */}
        {isLoading && (
          <div className="chat-bubble loading-bubble">
            <span>AI is searching transcript</span>
            <span className="dot-pulse">
              <span></span>
              <span></span>
              <span></span>
            </span>
          </div>
        )}
      </div>

      {/* QA Footer Form */}
      <form className="qa-footer" onSubmit={handleSubmit}>
        <div className="chat-input-row">
          <input
            type="text"
            className="chat-input"
            placeholder="Ask a question about the video..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            className="chat-send-btn"
            disabled={!inputValue.trim() || isLoading}
          >
            <Send size={15} />
          </button>
        </div>
      </form>
    </div>
  );
}
