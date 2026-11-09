import { useState, useRef, useEffect } from 'react';
import './OnlineChat.css';

export default function OnlineChat({
  messages = [],
  myColor = 'white',
  onSendMessage,
  onClose,
  isMobileDrawer = false,
}) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const clean = inputText.trim();
    if (!clean) return;
    onSendMessage(clean);
    setInputText('');
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`online-chat-box ${isMobileDrawer ? 'online-chat-box--drawer' : ''}`}>
      {isMobileDrawer && (
        <div className="online-chat-header">
          <span className="online-chat-title">💬 Live Match Chat</span>
          <button
            type="button"
            className="online-chat-close-btn"
            onClick={onClose}
            aria-label="Close chat"
          >
            ✕
          </button>
        </div>
      )}

      <div className="online-chat-messages" role="log" aria-live="polite">
        {messages.length === 0 ? (
          <div className="online-chat-empty">
            <span>💬</span>
            <p>No messages yet.<br />Say hello or good luck!</p>
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
          title="Send message"
          aria-label="Send message"
        >
          Send
        </button>
      </form>
    </div>
  );
}
