import React from 'react';
import './TypingIndicator.css';

function TypingIndicator() {
  return (
    <div className="message-container meemo-message typing">
      <div className="message-bubble typing-bubble">
        <div className="typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  );
}

export default TypingIndicator;
