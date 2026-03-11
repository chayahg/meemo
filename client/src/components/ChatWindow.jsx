import { useState, useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';

function ChatWindow({
  character,
  characters,
  messages,
  showCorrections,
  showGrammarTips,
  onCharacterChange,
  onToggleCorrections,
  onToggleGrammarTips,
  onSendMessage,
  onSTT,
  onTTS,
  isTTSEnabled,
  isListening,
  recognitionSupported,
  speechSynthesisSupported,
  onReplayAudio,
  selectedMessageId,
  onPlayMessageTTS,
  speakingMessageId,
  isMuted,
  onToggleMute,
  isTyping
}) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText);
      setInputText('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInput = (e) => {
    setInputText(e.target.value);
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  return (
    <div className="chat-window" style={{ '--accent-color': character.accentColor }}>
      <div className="chat-header">
        <div className="character-info">
          <img 
            src={character.avatar} 
            alt={character.name}
            className="character-avatar-small"
            onError={(e) => {
              e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="40" fill="%238b5cf6"/%3E%3C/svg%3E';
            }}
          />
          <div>
            <h2>{character.name}</h2>
            <p className="character-role">{character.role}</p>
          </div>
        </div>

        <div className="chat-mode-toggle">
          <button
            className={`toggle-option ${!showCorrections ? 'active' : ''}`}
            onClick={() => onToggleCorrections(false)}
          >
            Chat only
          </button>
          <button
            className={`toggle-option ${showCorrections ? 'active' : ''}`}
            onClick={() => onToggleCorrections(true)}
          >
            Chat + corrections
          </button>
        </div>
      </div>

      <div className="character-selector">
        {characters.map((char) => (
          <button
            key={char.id}
            className={`character-chip ${character.id === char.id ? 'active' : ''}`}
            onClick={() => onCharacterChange(char)}
            style={{ '--chip-color': char.accentColor }}
          >
            {char.name.replace(' Mee-Mo', '')}
          </button>
        ))}
      </div>

      <div className="messages-area">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            showCorrections={showCorrections}
            accentColor={character.accentColor}
            isSelected={selectedMessageId === message.id}
            onSelect={onSelectMessage}
            onPlayTTS={onPlayMessageTTS}
            isSpeaking={speakingMessageId === message.id}
          />
        ))}
        {isTyping && (
          <div className={`message-bubble meemo typing-bubble`} style={{ '--accent-color': character.accentColor }}>
            <div className="avatar-wrapper hide-on-mobile">
              <img 
                src={character.avatar} 
                alt={character.name}
                className="message-avatar"
              />
            </div>
            <div className="message-content">
              <div className="message-text typing-indicator">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <form onSubmit={handleSubmit} className="message-input-form">
          <div className="input-wrapper">
            <textarea
              value={inputText}
              onChange={handleInput}
              onKeyPress={handleKeyPress}
              placeholder={isListening ? "Listening..." : "Message Mee-Mo..."}
              className="message-input"
              disabled={isListening}
              rows="1"
            />

            <div className="input-actions">
              {speechSynthesisSupported && (
                <button 
                  type="button" 
                  className={`input-icon-btn ${isMuted ? 'muted' : ''}`}
                  onClick={onToggleMute} 
                  title={isMuted ? "Unmute voice" : "Mute voice"}
                >
                  {isMuted ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                      <line x1="23" y1="9" x2="17" y2="15"></line>
                      <line x1="17" y1="9" x2="23" y2="15"></line>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    </svg>
                  )}
                </button>
              )}
              
              {recognitionSupported && (
                <button 
                  type="button" 
                  className={`input-icon-btn ${isListening ? 'listening' : ''}`}
                  onClick={onSTT} 
                  title={isListening ? "Listening..." : "Voice input"}
                  disabled={isListening}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="23"></line>
                    <line x1="8" y1="23" x2="16" y2="23"></line>
                  </svg>
                </button>
              )}

              <button type="submit" className="send-btn" disabled={!inputText.trim() || isListening}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
                </svg>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ChatWindow;
