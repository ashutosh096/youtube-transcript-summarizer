import React, { useState } from 'react';
import { X, Key, Eye, EyeOff, CheckCircle } from 'lucide-react';

export default function SettingsModal({ isOpen, onClose, apiKeys, onSave }) {
  const [geminiKey, setGeminiKey] = useState(apiKeys.gemini || '');
  const [claudeKey, setClaudeKey] = useState(apiKeys.claude || '');
  const [showGemini, setShowGemini] = useState(false);
  const [showClaude, setShowClaude] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({ gemini: geminiKey, claude: claudeKey });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={18} className="text-accent" />
            <span>API Settings</span>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <p className="settings-help" style={{ marginBottom: '10px' }}>
            Configure your AI credentials below. These keys are stored <strong>locally in your browser</strong> and are only used for API calls from your computer.
          </p>

          {/* Gemini Settings */}
          <div className="settings-group">
            <label className="settings-label">
              <span>Google Gemini API Key</span>
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showGemini ? 'text' : 'password'}
                className="settings-input"
                style={{ width: '100%', paddingRight: '40px' }}
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIzaSy..."
              />
              <button
                type="button"
                onClick={() => setShowGemini(!showGemini)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                {showGemini ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="settings-help">
              Gemini is free for developers. Get a key at the{' '}
              <a
                href="https://aistudio.google.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google AI Studio
              </a>.
            </p>
          </div>

          {/* Claude Settings */}
          <div className="settings-group" style={{ marginTop: '10px' }}>
            <label className="settings-label">
              <span>Anthropic Claude API Key</span>
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showClaude ? 'text' : 'password'}
                className="settings-input"
                style={{ width: '100%', paddingRight: '40px' }}
                value={claudeKey}
                onChange={(e) => setClaudeKey(e.target.value)}
                placeholder="sk-ant-..."
              />
              <button
                type="button"
                onClick={() => setShowClaude(!showClaude)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                {showClaude ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="settings-help">
              Requires a valid paid account. Get a key at the{' '}
              <a
                href="https://console.anthropic.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Anthropic Console
              </a>.
            </p>
          </div>
        </div>

        <div className="modal-footer">
          {saved ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: 'var(--accent-green)',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                paddingRight: '12px',
              }}
            >
              <CheckCircle size={16} />
              Saved successfully!
            </div>
          ) : (
            <button className="save-btn" onClick={handleSave}>
              Save Settings
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
