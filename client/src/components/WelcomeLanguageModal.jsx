import { useState } from 'react';
import { LANGUAGES } from '../config/languageConfig';
import './WelcomeLanguageModal.css';

function WelcomeLanguageModal({ onSelectLanguage, onSkip }) {
  const [selectedLanguage, setSelectedLanguage] = useState('english');

  const handleConfirm = () => {
    onSelectLanguage(selectedLanguage);
  };

  return (
    <div className="welcome-modal-overlay">
      <div className="welcome-modal">
        <div className="welcome-modal-header">
          <h2>Welcome to Mee-Mo! 🎉</h2>
          <p>Which language would you like to learn?</p>
        </div>

        <div className="language-grid">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              className={`language-card ${selectedLanguage === lang.code ? 'selected' : ''}`}
              onClick={() => setSelectedLanguage(lang.code)}
            >
              <span className="language-flag">{lang.flag}</span>
              <span className="language-name">{lang.name}</span>
              <span className="language-native">{lang.nativeName}</span>
            </button>
          ))}
        </div>

        <div className="welcome-modal-actions">
          <button className="btn-skip" onClick={onSkip}>
            Skip for now
          </button>
          <button className="btn-confirm" onClick={handleConfirm}>
            Start Learning {LANGUAGES.find(l => l.code === selectedLanguage)?.name}
          </button>
        </div>
      </div>
    </div>
  );
}

export default WelcomeLanguageModal;
