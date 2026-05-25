import React, { useState } from 'react';
import { Copy, Download, Check, Sparkles, AlignLeft, List, FileText } from 'lucide-react';

export default function SummaryView({ summary, method, currentStyle, onStyleChange, isUpdating, videoTitle }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!summary) return;
    navigator.clipboard.writeText(summary).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    if (!summary) return;
    const header = `${videoTitle || 'YouTube Video'} - AI Summary\n========================================\n\n`;
    const blob = new Blob([header + summary], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(videoTitle || 'summary').substring(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase()}_summary.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    if (!summary) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to export PDF.');
      return;
    }
    
    const styledHtml = `
      <html>
        <head>
          <title>${videoTitle || 'Summary'}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              color: #1a202c;
              line-height: 1.6;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
            }
            h1 {
              font-size: 26px;
              color: #2b6cb0;
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 12px;
              margin-bottom: 6px;
            }
            .meta {
              font-size: 14px;
              color: #718096;
              margin-bottom: 28px;
            }
            h3 {
              font-size: 18px;
              color: #2d3748;
              margin-top: 24px;
              margin-bottom: 10px;
              border-left: 4px solid #3182ce;
              padding-left: 10px;
            }
            p, li {
              font-size: 15px;
              color: #4a5568;
            }
            ul, ol {
              padding-left: 20px;
              margin-bottom: 16px;
            }
            li {
              margin-bottom: 6px;
            }
            strong {
              color: #1a202c;
            }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h1>YouTube Video Summary</h1>
          <div class="meta">
            <strong>Video Title:</strong> ${videoTitle || 'N/A'}<br/>
            <strong>Date Generated:</strong> ${new Date().toLocaleDateString()}<br/>
            <strong>Method:</strong> ${method === 'gemini' ? 'Gemini AI' : method === 'claude' ? 'Claude AI' : 'Extractive Fallback'}
          </div>
          <div class="summary-content">
            ${formatMarkdown(summary)}
          </div>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(styledHtml);
    printWindow.document.close();
  };

  // Safe custom markdown text renderer for AI summaries
  const formatMarkdown = (text) => {
    if (!text) return '';
    
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Headings (e.g., ### **Overview** or ### Overview)
    html = html.replace(/^###\s*\*\*(.*?)\*\*/gm, '<h3>$1</h3>');
    html = html.replace(/^###\s*(.*?)$/gm, '<h3>$1</h3>');

    // Bold text (e.g., **text**)
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Lists (e.g., • Item or - Item)
    html = html.replace(/^•\s*(.*?)$/gm, '<li>$1</li>');
    html = html.replace(/^-\s*(.*?)$/gm, '<li>$1</li>');

    // Line breaks
    html = html.replace(/\n\n/g, '<br/><br/>');
    html = html.replace(/\n/g, '<br/>');

    return html;
  };

  // Get display name & styling class for AI model pill
  const getMethodBadge = (m) => {
    switch (m) {
      case 'gemini':
        return { text: '✦ Gemini 1.5 Flash', cls: 'badge-gemini' };
      case 'claude':
        return { text: '✦ Claude 3.5 Sonnet', cls: 'badge-claude' };
      case 'fallback':
        return { text: '⚙ Extractive Fallback', cls: 'badge-fallback' };
      case 'fallback_error':
        return { text: '⚙ API Fallback (Error)', cls: 'badge-fallback' };
      default:
        return { text: 'AI Summarizer', cls: 'badge-gemini' };
    }
  };

  const badgeInfo = getMethodBadge(method);

  return (
    <div className="summary-container">
      {/* Style selector row */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button
          className={`style-btn ${currentStyle === 'brief' ? 'active' : ''}`}
          onClick={() => onStyleChange('brief')}
          disabled={isUpdating}
        >
          <AlignLeft size={13} />
          <span>Brief</span>
        </button>
        <button
          className={`style-btn ${currentStyle === 'detailed' ? 'active' : ''}`}
          onClick={() => onStyleChange('detailed')}
          disabled={isUpdating}
        >
          <FileText size={13} />
          <span>Detailed</span>
        </button>
        <button
          className={`style-btn ${currentStyle === 'bullets' ? 'active' : ''}`}
          onClick={() => onStyleChange('bullets')}
          disabled={isUpdating}
        >
          <List size={13} />
          <span>Bullet Points</span>
        </button>
      </div>

      {/* Summary Toolbar */}
      <div className="summary-toolbar">
        <span className={`summary-type-badge ${badgeInfo.cls}`}>
          {badgeInfo.text}
        </span>
        <div className="summary-actions-row">
          <button className={`action-icon-btn ${copied ? 'copied' : ''}`} onClick={handleCopy}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
          <button className="action-icon-btn" onClick={handleDownload}>
            <Download size={13} />
            <span>Download</span>
          </button>
          <button className="action-icon-btn" onClick={handleExportPDF}>
            <FileText size={13} />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Summary Body text */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
        {isUpdating ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '150px', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ width: '28px', height: '28px', borderWidth: '2px', marginBottom: '10px' }}></div>
            <p style={{ fontSize: '0.78rem' }}>Generating new summary style...</p>
          </div>
        ) : (
          <div
            className="markdown-body summary-text"
            dangerouslySetInnerHTML={{ __html: formatMarkdown(summary) }}
          />
        )}
      </div>
    </div>
  );
}
