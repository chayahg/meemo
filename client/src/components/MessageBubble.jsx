function MessageBubble({ message, showCorrections, accentColor, isSelected, onSelect, onPlayTTS, isSpeaking }) {
  const isUser = message.sender === 'user';
  const hasCorrection = isUser && message.hadChanges && message.corrected;
  const isTeachingBubble = !isUser && message.isTeachingMode;
  const hasEnglishCorrection = isUser && message.englishCorrection;
  const hasTargetLangCorrection = isUser && message.targetLangCorrection;

  const handleBubbleClick = () => {
    onSelect(message.id);
  };

  const handleTTSClick = (e) => {
    e.stopPropagation();
    onPlayTTS(message);
  };

  return (
    <div className="message-container">
      <div 
        className={`message-bubble ${isUser ? 'user-message' : 'meemo-message'} ${message.isError ? 'error-message' : ''}`}
        onClick={handleBubbleClick}
      >
        <div className="message-content" style={isUser ? { '--user-accent': accentColor } : {}}>
          {isUser && (hasEnglishCorrection || hasTargetLangCorrection) ? (
            /* === Teaching mode: inline corrections on user message === */
            <div className="message-with-inline-correction">
              <p>{message.text}</p>
              {hasEnglishCorrection && (
                <div className="inline-english-correction">
                  <span className="correction-right">✅ {message.englishCorrection.corrected}</span>
                </div>
              )}
              {hasTargetLangCorrection && (
                <div className="inline-target-correction">
                  <span className="correction-right">✅ {message.targetLangCorrection.corrected}</span>
                </div>
              )}
            </div>
          ) : hasCorrection && showCorrections ? (
            /* === English mode: grammar correction on user message === */
            <div className="message-with-correction">
              <p>{message.text}</p>
              <div className="corrected-text">
                <span>✅ {message.corrected}</span>
              </div>
            </div>
          ) : isTeachingBubble ? (
            /* === Teaching mode: AI response with native + romanization + meaning === */
            <div className="message-with-teaching">
              <p className="native-script-text">{message.text}</p>
              {message.romanization && (
                <p className="romanization-text">{message.romanization}</p>
              )}
              {message.meaning && (
                <p className="meaning-text">{message.meaning}</p>
              )}
            </div>
          ) : (
            <p>{message.text}</p>
          )}
          <span className="message-time">{message.timestamp}</span>
        </div>
      </div>
      
      {isSelected && (
        <button 
          className={`tts-icon-btn ${isUser ? 'user-side' : 'ai-side'} ${isSpeaking ? 'speaking' : ''}`}
          onClick={handleTTSClick}
          title={isSpeaking ? 'Stop speaking' : 'Play audio'}
        >
          {isSpeaking ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            </svg>
          )}
        </button>
      )}
    </div>
  );
}

export default MessageBubble;
