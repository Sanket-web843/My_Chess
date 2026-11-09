import { useState, useRef, useEffect } from 'react';
import MoveHistory from './MoveHistory.jsx';
import './OnlineChat.css';

const QUICK_PRESETS = [
  '👋 Hello!',
  '👍 Good luck!',
  '👏 Great move!',
  '⏳ 1 min please',
  '🤝 Good game!',
  'Thanks!',
];

export default function OnlineChat({
  messages = [],
  myColor = 'white',
  onSendMessage,
  onClose,
  isMobileDrawer = false,
  history = [],
}) {
  const [inputText, setInputText] = useState('');
  const [mobileTab, setMobileTab] = useState('chat'); // 'chat' | 'moves'
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (mobileTab === 'chat') {
      scrollToBottom();
    }
  }, [messages.length, mobileTab]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const clean = inputText.trim();
    if (!clean) return;
    onSendMessage(clean);
    setInputText('');
    // Automatically close on mobile so the board view is immediately restored
    if (isMobileDrawer && onClose) {
      onClose();
    }
  };

  const handleQuickPreset = (preset) => {
    onSendMessage(preset);
    // Instant reply & auto-dismiss on mobile
    if (isMobileDrawer && onClose) {
      onClose();
    }
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const content = (
    <div
      className={`online-chat-box ${isMobileDrawer ? 'online-chat-box--drawer' : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      {isMobileDrawer && (
        <div className="online-chat-header">
          <div className="mobile-chat-tabs">
            <button
              type="button"
              className={`mobile-chat-tab ${mobileTab === 'chat' ? 'mobile-chat-tab--active' : ''}`}
              onClick={() => setMobileTab('chat')}
            >
              💬 Chat
            </button>
            <button
              type="button"
              className={`mobile-chat-tab ${mobileTab === 'moves' ? 'mobile-chat-tab--active' : ''}`}
              onClick={() => setMobileTab('moves')}
            >
              ♟ Moves ({history.length})
            </button>
          </div>
          <button
            type="button"
            className="online-chat-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ✕ Close
          </button>
        </div>
      )}

      {isMobileDrawer && mobileTab === 'moves' ? (
        <div className="online-chat-moves-wrap">
          <MoveHistory history={history} />
        </div>
      ) : (
        <>
          <div className="online-chat-messages" role="log" aria-live="polite">
            {messages.length === 0 ? (
              <div className="online-chat-empty">
                <span>💬</span>
                <p>No messages yet.<br />Use quick replies or type below!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender === myColor;
                return (
                  <div
                    key={msg.id}
                    className={`chat-bubble-wrap ${isMe ? 'chat-bubble-wrap--me' : 'chat-bubble-wrap--them'}`}
                  >
                    <div className={`chat-bubble ${isMe ? 'chat-bubble--me' : 'chat-bubble--them'}`}>
                      <div className="chat-bubble-sender">
                        {isMe ? 'You' : `Opponent (${msg.sender})`}
                      </div>
                      <div className="chat-bubble-text">{msg.text}</div>
                      <div className="chat-bubble-time">{formatTime(msg.timestamp)}</div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Reaction Chips for 1-tap instant response on mobile */}
          <div className="online-chat-chips">
            {QUICK_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className="chat-chip-btn"
                onClick={() => handleQuickPreset(preset)}
              >
                {preset}
              </button>
            ))}
          </div>

          <form className="online-chat-input-row" onSubmit={handleSubmit}>
            <input
              type="text"
              className="online-chat-input"
              placeholder="Type message (max 150 chars)..."
              value={inputText}
              maxLength={150}
              onChange={(e) => setInputText(e.target.value)}
              autoComplete="off"
            />
            <button
              type="submit"
              className="online-chat-send-btn"
              disabled={!inputText.trim()}
              title="Send and return to board"
              aria-label="Send message"
            >
              Send
            </button>
          </form>
        </>
      )}
    </div>
  );

  if (isMobileDrawer) {
    return (
      <div className="mobile-chat-backdrop" onClick={onClose}>
        {content}
      </div>
    );
  }

  return content;
}
