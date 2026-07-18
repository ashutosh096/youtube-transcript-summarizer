import React, { useState, useEffect } from 'react';
import { Settings, Play, ArrowRight, Video, Sparkles, MessageSquare, ListCollapse, CheckCircle, Info } from 'lucide-react';
import SettingsModal from './components/SettingsModal';
import YoutubePlayer from './components/YoutubePlayer';
import SummaryView from './components/SummaryView';
import TranscriptView from './components/TranscriptView';
import QAPanel from './components/QAPanel';
import './App.css';

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8000/api'
  : '/api';

const extractKeywords = (text) => {
  if (!text) return [];
  const stopWords = new Set([
    'the', 'and', 'a', 'of', 'to', 'in', 'is', 'that', 'it', 'you', 'i', 'this', 'on', 'with', 'for', 'as', 'are', 'was', 'but', 'be', 'or', 'at', 'an', 'your', 'my', 'have', 'from', 'we', 'they', 'he', 'she', 'so', 'just', 'like', 'about', 'how', 'what', 'if', 'can', 'out', 'up', 'all', 'there', 'one', 'would', 'their', 'them', 'who', 'get', 'go', 'me', 'him', 'her', 'know', 'think', 'see', 'make', 'some', 'than', 'then', 'now', 'its', 'also', 'has', 'will', 'very', 'us', 'our', 'more', 'into', 'other', 'here', 'when', 'time', 'been', 'were', 'use', 'do', 'does', 'did', 'actually', 'mean', 'want', 'going', 'would', 'could', 'should', 'people', 'really', 'something', 'right', 'well', 'much', 'many', 'good'
  ]);
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/);
  
  const freq = {};
  words.forEach(w => {
    if (w.length > 4 && !stopWords.has(w)) {
      freq[w] = (freq[w] || 0) + 1;
    }
  });
  
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(entry => entry[0]);
};

export default function App() {
  const [url, setUrl] = useState('');
  const [videoData, setVideoData] = useState(null);
  const [currentStyle, setCurrentStyle] = useState('detailed');
  const [summaryData, setSummaryData] = useState(null);
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: "Hi! Ask me anything about the video, and I'll find it in the transcript." }
  ]);
  const [seekToTime, setSeekToTime] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');
  const [apiKeys, setApiKeys] = useState({ gemini: '', claude: '' });

  // UI States
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [loadingStep, setLoadingStep] = useState(1);
  const [error, setError] = useState('');

  // Sourced Sync States
  const [currentTime, setCurrentTime] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [keywords, setKeywords] = useState([]);

  // Extract top keywords on video load
  useEffect(() => {
    if (videoData && videoData.text) {
      setKeywords(extractKeywords(videoData.text));
    } else {
      setKeywords([]);
    }
  }, [videoData]);

  // Load API keys from local storage on mount
  useEffect(() => {
    const savedKeys = localStorage.getItem('yt_summarizer_keys');
    if (savedKeys) {
      try {
        setApiKeys(JSON.parse(savedKeys));
      } catch (e) {
        console.error("Error parsing stored API keys", e);
      }
    }
  }, []);

  const handleSaveKeys = (keys) => {
    setApiKeys(keys);
    localStorage.setItem('yt_summarizer_keys', JSON.stringify(keys));
  };

  const handleSeek = (time) => {
    setSeekToTime(time);
    // Reset seek to time shortly after so clicks on the same timestamp trigger updates
    setTimeout(() => setSeekToTime(null), 100);
  };

  const handleSummarize = async () => {
    if (!url.trim()) {
      setError('Please paste a YouTube URL first.');
      return;
    }

    setError('');
    setVideoData(null);
    setSummaryData(null);
    setChatMessages([
      { role: 'assistant', content: "Hi! Ask me anything about the video, and I'll find it in the transcript." }
    ]);
    setSearchQuery('');
    setCurrentTime(0);
    setIsLoadingVideo(true);
    setLoadingStep(1);

    try {
      // Step 1: Validate URL and Fetch Transcript
      const transcriptRes = await fetch(`${API_BASE}/transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() })
      });

      if (!transcriptRes.ok) {
        const errData = await transcriptRes.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to fetch transcript. Caption may be disabled or URL invalid.');
      }

      setLoadingStep(2);
      const data = await transcriptRes.json();
      setVideoData(data);

      // Step 2: Request Summary
      setLoadingStep(3);
      setIsLoadingSummary(true);
      
      const summaryRes = await fetch(`${API_BASE}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: data.text,
          style: currentStyle,
          gemini_key: apiKeys.gemini,
          claude_key: apiKeys.claude
        })
      });

      if (!summaryRes.ok) {
        throw new Error('Failed to generate summary.');
      }

      const sData = await summaryRes.json();
      setSummaryData(sData);
      setIsLoadingSummary(false);
      setIsLoadingVideo(false);

    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
      setIsLoadingVideo(false);
      setIsLoadingSummary(false);
    }
  };

  // Called when user switches summary style in SummaryView
  const handleStyleChange = async (newStyle) => {
    if (!videoData) return;
    setCurrentStyle(newStyle);
    setIsLoadingSummary(true);

    try {
      const summaryRes = await fetch(`${API_BASE}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: videoData.text,
          style: newStyle,
          gemini_key: apiKeys.gemini,
          claude_key: apiKeys.claude
        })
      });

      if (!summaryRes.ok) throw new Error('Failed to generate new summary.');
      const sData = await summaryRes.json();
      setSummaryData(sData);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingSummary(false);
    }
  };

  // Chat Q&A Submit handler
  const handleSendMessage = async (text) => {
    if (!videoData) return;
    
    const newUserMsg = { role: 'user', content: text };
    setChatMessages((prev) => [...prev, newUserMsg]);
    setIsLoadingChat(true);

    try {
      const chatRes = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: videoData.text,
          question: text,
          history: chatMessages.slice(1), // Exclude introductory greeting
          gemini_key: apiKeys.gemini,
          claude_key: apiKeys.claude
        })
      });

      if (!chatRes.ok) throw new Error('Failed to get answer.');
      const data = await chatRes.json();

      setChatMessages((prev) => [...prev, { role: 'assistant', content: data.answer }]);
    } catch (err) {
      setChatMessages((prev) => [...prev, { role: 'error', content: `Error: ${err.message}` }]);
    } finally {
      setIsLoadingChat(false);
    }
  };

  const handleClearChat = () => {
    setChatMessages([
      { role: 'assistant', content: "Hi! Ask me anything about the video, and I'll find it in the transcript." }
    ]);
  };

  return (
    <div className="app-container">
      {/* Glow effects */}
      <div className="bg-mesh"></div>
      <div className="grid-lines"></div>
      <div className="orb orb-1"></div>
      <div className="orb orb-2"></div>

      {/* Navigation */}
      <nav className="navbar">
        <div className="nav-inner">
          <div className="logo-group" onClick={() => window.location.reload()}>
            <div className="logo-box">
              <Play size={16} fill="#ffffff" color="#ffffff" style={{ marginLeft: '2px' }} />
            </div>
            <span className="logo-text">TranscriptAI</span>
          </div>
          <div className="nav-actions">
            <span className="badge">COLLEGE EDITION</span>
            <button className="settings-btn" onClick={() => setIsSettingsOpen(true)} title="Settings">
              <Settings size={18} />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Pane */}
      <main className="main-content">
        {/* Hero Section */}
        <section className="hero-section">
          <div className="hero-badge">
            <div className="hero-badge-dot"></div>
            <span>AI-Powered · Interactive Playback · Free</span>
          </div>
          <h1 className="hero-title">
            Summarize YouTube <span>Captions</span> Instantly
          </h1>
          <p className="hero-subtitle">
            Skip hours of viewing. Retrieve transcripts, generate styled AI summaries, and converse with video content in real-time.
          </p>
        </section>

        {/* Search URL Form */}
        <div className="input-card">
          <div className="input-label">
            <Video size={13} />
            <span>YouTube Video Link</span>
          </div>
          <div className="input-row">
            <input
              type="text"
              className="url-input"
              placeholder="Paste link here (e.g. https://www.youtube.com/watch?v=...)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSummarize()}
              disabled={isLoadingVideo}
            />
            <button
              className="submit-btn"
              onClick={handleSummarize}
              disabled={isLoadingVideo || !url.trim()}
            >
              <span>Summarize</span>
              <ArrowRight size={15} />
            </button>
          </div>
          <div className="hint-text">
            ✦ Compatible with youtube.com/watch?v=, youtu.be/, and shorts/ links
          </div>
        </div>

        {/* Global Error Display */}
        {error && (
          <div className="error-box">
            <Info size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Loading State with steps */}
        {isLoadingVideo && (
          <div className="loading-box">
            <div className="spinner"></div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Analyzing video contents...
            </div>
            <div className="loading-steps">
              <div className={`step-row ${loadingStep === 1 ? 'active' : 'done'}`}>
                <CheckCircle size={14} style={{ opacity: loadingStep > 1 ? 1 : 0.4 }} />
                <span>1. Fetching YouTube captions</span>
              </div>
              <div className={`step-row ${loadingStep === 2 ? 'active' : loadingStep > 2 ? 'done' : ''}`}>
                <CheckCircle size={14} style={{ opacity: loadingStep > 2 ? 1 : 0.4 }} />
                <span>2. Extracting core transcript text</span>
              </div>
              <div className={`step-row ${loadingStep === 3 ? 'active' : ''}`}>
                <Sparkles size={14} />
                <span>3. Generating AI summary</span>
              </div>
            </div>
          </div>
        )}

        {/* Interactive Workspace (Displayed when Video Data is Loaded) */}
        {!isLoadingVideo && videoData && (
          <div className="workspace-grid">
            {/* Left Column (Player & Chat) */}
            <div className="column">
              <YoutubePlayer
                videoId={videoData.video_id}
                seekToTime={seekToTime}
                title={videoData.title}
                channel={videoData.channel}
                wordCount={videoData.word_count}
                readTime={videoData.read_time}
                onTimeUpdate={setCurrentTime}
                keywords={keywords}
                onKeywordClick={(kw) => {
                  setSearchQuery(kw);
                  setActiveTab('transcript');
                }}
              />
              
              <QAPanel
                messages={chatMessages}
                isLoading={isLoadingChat}
                onSendMessage={handleSendMessage}
                onClearChat={handleClearChat}
              />
            </div>

            {/* Right Column (Tabs: Summary / Transcript) */}
            <div className="column">
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Tabs bar */}
                <div className="workspace-tabs">
                  <button
                    className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
                    onClick={() => setActiveTab('summary')}
                  >
                    <Sparkles size={14} />
                    <span>AI Summary</span>
                  </button>
                  <button
                    className={`tab-btn ${activeTab === 'transcript' ? 'active' : ''}`}
                    onClick={() => setActiveTab('transcript')}
                  >
                    <ListCollapse size={14} />
                    <span>Interactive Transcript</span>
                  </button>
                </div>

                {/* Tab content panel */}
                <div className="tab-pane">
                  {activeTab === 'summary' ? (
                    <SummaryView
                      summary={summaryData?.summary}
                      method={summaryData?.method}
                      currentStyle={currentStyle}
                      onStyleChange={handleStyleChange}
                      isUpdating={isLoadingSummary}
                      videoTitle={videoData.title}
                    />
                  ) : (
                    <TranscriptView
                      segments={videoData.segments}
                      onSeek={handleSeek}
                      searchQuery={searchQuery}
                      onSearchQueryChange={setSearchQuery}
                      currentTime={currentTime}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Static Feature Intro (Displayed when no video is loaded) */}
        {!isLoadingVideo && !videoData && (
          <div className="features-grid">
            <div className="feature-box">
              <div className="feature-icon-wrapper">
                <Sparkles size={20} />
              </div>
              <h4>Triple Summary Modes</h4>
              <p>Choose Brief, Detailed, or Bullet Points. Tailor findings to your studying style instantly.</p>
            </div>
            <div className="feature-box">
              <div className="feature-icon-wrapper">
                <Play size={20} style={{ marginLeft: '2px' }} />
              </div>
              <h4>Synchronized Playback</h4>
              <p>Click any line in the transcript to seek the video player. Target and watch specific segments instantly.</p>
            </div>
            <div className="feature-box">
              <div className="feature-icon-wrapper">
                <MessageSquare size={20} />
              </div>
              <h4>Context-Aware Chat</h4>
              <p>Ask clarifying questions. The AI references the exact transcript to provide fast, sourced answers.</p>
            </div>
          </div>
        )}
      </main>

      {/* Footer banner */}
      <footer className="footer-text">
        TranscriptAI &copy; {new Date().getFullYear()} &middot; Built with React + FastAPI + Gemini/Claude AI &middot; Perfect for College Presenting
      </footer>

      {/* API Configuration Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKeys={apiKeys}
        onSave={handleSaveKeys}
      />
    </div>
  );
}
