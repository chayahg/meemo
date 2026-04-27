import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useToast } from '../contexts/ToastContext';
import { LANGUAGES, getLanguageByCode } from '../config/languageConfig';
import './SettingsPage.css';
import './SettingsPageStats.css';

function SettingsPage() {
  const { user, loading, updateUserData, logout, switchLanguage } = useUser();
  const { showToast, showConfirm } = useToast();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [switchingLanguage, setSwitchingLanguage] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  const characters = [
    { id: 'mentor', name: 'Mentor Mee-Mo', tagline: 'Wise guide who explains things step-by-step.', avatar: '/characters/mentor.png' },
    { id: 'vibe', name: 'Vibe Mee-Mo', tagline: 'Chill companion who matches your vibe and keeps learning fun.', avatar: '/characters/vibe.png' },
    { id: 'bro', name: 'Bro Mee-Mo', tagline: 'Your friendly bro who chats casually and keeps you motivated.', avatar: '/characters/bro.png' },
    { id: 'luna', name: 'Luna Mee-Mo', tagline: 'Creative soft-girl vibe partner who inspires ideas and positivity.', avatar: '/characters/luna.png' }
  ];

  const currentCharacterIndex = characters.findIndex(char => char.id === formData?.profile?.preferredCharacter);
  const [sliderIndex, setSliderIndex] = useState(currentCharacterIndex >= 0 ? currentCharacterIndex : 0);

  const nextCharacter = () => setSliderIndex((prev) => (prev + 1) % characters.length);
  const prevCharacter = () => setSliderIndex((prev) => (prev - 1 + characters.length) % characters.length);

  useEffect(() => {
    if (!loading && !user) navigate('/');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      setFormData({
        profile: { ...user.profile },
        settings: { ...user.settings },
        stats: { ...user.stats }
      });
    }
  }, [user]);

  useEffect(() => {
    if (user && formData) {
      const hasChanges = 
        JSON.stringify(formData.profile) !== JSON.stringify(user.profile) ||
        JSON.stringify(formData.settings) !== JSON.stringify(user.settings);
      setHasUnsavedChanges(hasChanges);
    }
  }, [formData, user]);

  const handleSaveChanges = async () => {
    if (!formData.profile.displayName.trim()) {
      showToast('Display name cannot be empty', 'error');
      return;
    }
    setSaving(true);
    try {
      await updateUserData({ profile: formData.profile, settings: formData.settings });
      setHasUnsavedChanges(false);
      const saveBar = document.querySelector('.save-bar');
      if (saveBar) {
        saveBar.style.background = '#10b981';
        setTimeout(() => { saveBar.style.background = ''; }, 1000);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      showToast('Failed to save settings. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    showConfirm('Reset to last saved settings?', () => {
      if (user) {
        setFormData({
          profile: { ...user.profile },
          settings: { ...user.settings },
          stats: { ...user.stats }
        });
      }
      setHasUnsavedChanges(false);
    });
  };

  const handleCharacterSelect = (characterId) => {
    updateNestedField('profile', 'preferredCharacter', characterId);
    const selectedChar = characters.find(c => c.id === characterId);
    if (selectedChar) {
      updateNestedField('profile', 'avatarUrl', selectedChar.avatar);
      setSliderIndex(characters.findIndex(char => char.id === characterId));
    }
  };

  const handleClearHistory = () => {
    showConfirm('This will permanently delete all your local practice history. Continue?', () => {
      localStorage.removeItem('meemo_chat_history');
      showToast('Practice history cleared!', 'success');
    });
  };

  const handleDeleteAllHistory = () => {
    showConfirm('This will DELETE ALL your history and data. This cannot be undone! Continue?', () => {
      localStorage.removeItem('meemo_chat_history');
      localStorage.removeItem('meemo_settings');
      showToast('All history deleted. Reloading...', 'success');
      setTimeout(() => window.location.reload(), 1500);
    });
  };

  const handleDownloadData = () => {
    showToast('Download data feature coming soon!', 'info');
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/', { replace: true });
      // Hard fallback so users never need a second action if router state lags.
      window.location.replace('/');
    } catch (error) {
      console.error('Error logging out:', error);
      showToast('Failed to log out. Please try again.', 'error');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleLanguageChange = async (newLanguageCode) => {
    if (newLanguageCode === formData.profile.targetLanguage) return;
    const newLang = getLanguageByCode(newLanguageCode);
    const currentLang = getLanguageByCode(formData.profile.targetLanguage);
    
    showConfirm(`Switch from ${currentLang.name} to ${newLang.name}?\nYour progress in ${currentLang.name} will be saved, and you'll load your ${newLang.name} progress.`, async () => {
      setSwitchingLanguage(true);
      try {
        await switchLanguage(newLanguageCode);
        showToast(`Switched to ${newLang.name}! Start practicing now.`, 'success');
      } catch (error) {
        console.error('Error switching language:', error);
        showToast('Failed to switch language. Please try again.', 'error');
      } finally {
        setSwitchingLanguage(false);
      }
    });
  };

  const updateNestedField = (section, field, value) => {
    setFormData(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: value }
    }));
  };

  if (loading || !formData) {
    return (
      <div className="sp">
        <div className="sp-wrap">
          <div className="sp-hero">
            <h1 className="sp-title">Settings</h1>
            <p className="sp-subtitle">Loading your settings...</p>
          </div>
        </div>
      </div>
    );
  }

  const currentLang = getLanguageByCode(formData.profile.targetLanguage);
  const currentChar = characters.find(c => c.id === formData.profile.preferredCharacter);

  return (
    <div className="sp">
      <div className="sp-wrap">

        {/* ── Hero Header ── */}
        <div className="sp-hero">
          <h1 className="sp-title">Settings</h1>
          <p className="sp-subtitle">Customize your Mee-Mo learning experience</p>
        </div>

        {/* ── Tab Navigation ── */}
                <nav className="sp-tabs">
          {[
            { id: 'profile', label: 'Profile', icon: 'P' },
            { id: 'preferences', label: 'Preferences', icon: 'S' },
            { id: 'account', label: 'Account', icon: 'A' },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`sp-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="sp-tab-icon">{tab.icon}</span>
              <span className="sp-tab-label">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* ═══════ PROFILE TAB ═══════ */}
        {activeTab === 'profile' && (
          <div className="sp-content">

            {/* Profile Card */}
            <section className="sp-card sp-profile-card">
              <div className="sp-profile-top">
                <div className="sp-avatar-wrap">
                  <img
                    src={formData.profile.avatarUrl || currentChar?.avatar}
                    alt="Avatar"
                    className="sp-avatar-img"
                  />
                  <span className="sp-avatar-badge">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  </span>
                </div>
                <div className="sp-profile-info">
                  <h2 className="sp-profile-name">{formData.profile.displayName || 'Learner'}</h2>
                  <p className="sp-profile-email">{formData.profile.email}</p>
                  <div className="sp-profile-badges">
                    <span className="sp-badge">{currentLang.flag} {currentLang.name}</span>
                    <span className="sp-badge">{currentChar?.name || 'No character'}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Progress & Stats Tracker */}
            <section className="sp-card sp-stats-card">
              <div className="sp-card-head">
                <h3 className="sp-card-title">Learning Progress</h3>
                <p className="sp-card-desc">Track your interactions and daily streaks</p>
              </div>
              <div className="sp-stats-grid">
                <div className="sp-stat-item">
                  <div className="sp-stat-icon level">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                  </div>
                  <div className="sp-stat-info">
                    <span className="sp-stat-value">Level {formData.stats?.level || 1}</span>
                    <span className="sp-stat-label">{formData.stats?.xp || 0} XP</span>
                  </div>
                </div>

                <div className="sp-stat-item">
                  <div className="sp-stat-icon streak">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"></path></svg>
                  </div>
                  <div className="sp-stat-info">
                    <span className="sp-stat-value">{formData.stats?.dailyStreak || 0}</span>
                    <span className="sp-stat-label">Day Streak</span>
                  </div>
                </div>

                <div className="sp-stat-item">
                  <div className="sp-stat-icon messages">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                  </div>
                  <div className="sp-stat-info">
                    <span className="sp-stat-value">{formData.stats?.correctMessages || 0}</span>
                    <span className="sp-stat-label">Perfect Messages</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Personal Info */}
            <section className="sp-card">
              <div className="sp-card-head">
                <h3 className="sp-card-title">Personal Information</h3>
                <p className="sp-card-desc">Update your display name and region</p>
              </div>
              <div className="sp-form-grid">
                <div className="sp-field">
                  <label className="sp-label">Display name</label>
                  <input
                    type="text"
                    value={formData.profile.displayName}
                    onChange={(e) => updateNestedField('profile', 'displayName', e.target.value)}
                    className="sp-input"
                    placeholder="Your name"
                  />
                </div>
                <div className="sp-field">
                  <label className="sp-label">Email</label>
                  <input
                    type="email"
                    value={formData.profile.email}
                    className="sp-input sp-readonly"
                    readOnly
                  />
                </div>
                <div className="sp-field">
                  <label className="sp-label">Country</label>
                  <select
                    value={formData.profile.country}
                    onChange={(e) => updateNestedField('profile', 'country', e.target.value)}
                    className="sp-select"
                  >
                    <option value="United States">United States</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="Canada">Canada</option>
                    <option value="Australia">Australia</option>
                    <option value="India">India</option>
                    <option value="Philippines">Philippines</option>
                    <option value="Singapore">Singapore</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="sp-field">
                  <label className="sp-label">English level</label>
                  <select
                    value={formData.profile.preferredLevel}
                    onChange={(e) => updateNestedField('profile', 'preferredLevel', e.target.value)}
                    className="sp-select"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Character Selection */}
            <section className="sp-card">
              <div className="sp-card-head">
                <h3 className="sp-card-title">Mee-Mo Character</h3>
                <p className="sp-card-desc">Choose who you'd like to learn with</p>
              </div>
              <div className="sp-char-picker">
                <button className="sp-char-arrow" onClick={prevCharacter} type="button">&lt;</button>
                <div
                  className={`sp-char-card ${formData.profile.preferredCharacter === characters[sliderIndex].id ? 'active' : ''}`}
                  onClick={() => handleCharacterSelect(characters[sliderIndex].id)}
                >
                  <img src={characters[sliderIndex].avatar} alt={characters[sliderIndex].name} className="sp-char-img" />
                  <div className="sp-char-info">
                    <h4 className="sp-char-name">{characters[sliderIndex].name}</h4>
                    <p className="sp-char-tagline">{characters[sliderIndex].tagline}</p>
                  </div>
                  {formData.profile.preferredCharacter === characters[sliderIndex].id && (
                    <span className="sp-char-active-tag">Active</span>
                  )}
                </div>
                <button className="sp-char-arrow" onClick={nextCharacter} type="button">&gt;</button>
              </div>
              <div className="sp-char-dots">
                {characters.map((char, i) => (
                  <span key={char.id} className={`sp-dot ${i === sliderIndex ? 'active' : ''}`} onClick={() => setSliderIndex(i)} />
                ))}
              </div>
            </section>

            {/* Language Selection */}
            <section className="sp-card">
              <div className="sp-card-head">
                <h3 className="sp-card-title">Learning Language</h3>
                <p className="sp-card-desc">Switch the language you're practicing</p>
              </div>
              <div className="sp-lang-current">
                <span className="sp-lang-flag">{currentLang.flag}</span>
                <div className="sp-lang-info">
                  <span className="sp-lang-name">{currentLang.name}</span>
                  <span className="sp-lang-native">{currentLang.nativeName}</span>
                </div>
                <span className="sp-lang-badge">Active</span>
              </div>
              <div className="sp-lang-grid">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    className={`sp-lang-opt ${formData.profile.targetLanguage === lang.code ? 'active' : ''}`}
                    onClick={() => handleLanguageChange(lang.code)}
                    disabled={switchingLanguage || formData.profile.targetLanguage === lang.code}
                  >
                    <span className="sp-lang-opt-flag">{lang.flag}</span>
                    <span className="sp-lang-opt-name">{lang.name}</span>
                    {formData.profile.targetLanguage === lang.code && <span className="sp-lang-check">OK</span>}
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ═══════ PREFERENCES TAB ═══════ */}
        {activeTab === 'preferences' && (
          <div className="sp-content">

            {/* Chat & Feedback */}
            <section className="sp-card">
              <div className="sp-card-head">
                <h3 className="sp-card-title">Chat & Feedback</h3>
                <p className="sp-card-desc">Control how Mee-Mo responds and corrects you</p>
              </div>

              <div className="sp-toggle-list">
                <div className="sp-toggle-item">
                  <div className="sp-toggle-text">
                    <span className="sp-toggle-title">Grammar corrections</span>
                    <span className="sp-toggle-desc">Show corrections next to your messages</span>
                  </div>
                  <label className="sp-switch">
                    <input type="checkbox" checked={formData.settings.showGrammar} onChange={(e) => updateNestedField('settings', 'showGrammar', e.target.checked)} />
                    <span className="sp-switch-track"></span>
                  </label>
                </div>

                <div className="sp-toggle-item">
                  <div className="sp-toggle-text">
                    <span className="sp-toggle-title">Detailed grammar rules</span>
                    <span className="sp-toggle-desc">Get extra tips and rule explanations</span>
                  </div>
                  <label className="sp-switch">
                    <input type="checkbox" checked={formData.settings.showDetailedRules} onChange={(e) => updateNestedField('settings', 'showDetailedRules', e.target.checked)} />
                    <span className="sp-switch-track"></span>
                  </label>
                </div>

                <div className="sp-toggle-item">
                  <div className="sp-toggle-text">
                    <span className="sp-toggle-title">Auto-translate</span>
                    <span className="sp-toggle-desc">Suggest improved versions of your text</span>
                  </div>
                  <label className="sp-switch">
                    <input type="checkbox" checked={formData.settings.autoTranslate} onChange={(e) => updateNestedField('settings', 'autoTranslate', e.target.checked)} />
                    <span className="sp-switch-track"></span>
                  </label>
                </div>
              </div>

              <div className="sp-field" style={{marginTop: '0.5rem'}}>
                <label className="sp-label">Reply style</label>
                <select
                  value={formData.settings.replyStyle}
                  onChange={(e) => updateNestedField('settings', 'replyStyle', e.target.value)}
                  className="sp-select"
                >
                  <option value="short">Short & casual</option>
                  <option value="normal">Normal</option>
                  <option value="detailed">Detailed when needed</option>
                </select>
              </div>
            </section>

            {/* Voice & Speaking */}
            <section className="sp-card">
              <div className="sp-card-head">
                <h3 className="sp-card-title">Voice & Speaking</h3>
                <p className="sp-card-desc">Adjust speech recognition and playback settings</p>
              </div>
              <div className="sp-form-grid">
                <div className="sp-field">
                  <label className="sp-label">Recognition language</label>
                  <select
                    value={formData.settings.recognitionLanguage}
                    onChange={(e) => updateNestedField('settings', 'recognitionLanguage', e.target.value)}
                    className="sp-select"
                  >
                    <option value="English only">English only</option>
                    <option value="Native + English">Native + English</option>
                  </select>
                </div>
                <div className="sp-field">
                  <label className="sp-label">Speaking mode</label>
                  <select
                    value={formData.settings.speakingMode}
                    onChange={(e) => updateNestedField('settings', 'speakingMode', e.target.value)}
                    className="sp-select"
                  >
                    <option value="press-to-talk">Press to talk</option>
                    <option value="continuous">Continuous (future)</option>
                  </select>
                </div>
              </div>
              <div className="sp-field">
                <label className="sp-label">Speaking speed</label>
                <div className="sp-slider-row">
                  <span className="sp-slider-label">Slow</span>
                  <input
                    type="range" min="0.75" max="1.5" step="0.05"
                    value={formData.settings.speechSpeed}
                    onChange={(e) => updateNestedField('settings', 'speechSpeed', parseFloat(e.target.value))}
                    className="sp-slider"
                  />
                  <span className="sp-slider-label">Fast</span>
                  <span className="sp-slider-value">{formData.settings.speechSpeed.toFixed(2)}x</span>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ═══════ ACCOUNT TAB ═══════ */}
        {activeTab === 'account' && (
          <div className="sp-content">

            {/* Data Management */}
            <section className="sp-card">
              <div className="sp-card-head">
                <h3 className="sp-card-title">Data Management</h3>
                <p className="sp-card-desc">Export, clear, or delete your data</p>
              </div>

              <div className="sp-data-list">
                <div className="sp-data-item sp-data-download">
                  <div className="sp-data-icon download">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  </div>
                  <div className="sp-data-info">
                    <h4>Download My Data</h4>
                    <p>Export all your learning progress and history</p>
                  </div>
                  <button className="sp-data-btn accent" onClick={handleDownloadData}>Download</button>
                </div>

                <div className="sp-data-item sp-data-warn">
                  <div className="sp-data-icon warn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </div>
                  <div className="sp-data-info">
                    <h4>Clear Practice History</h4>
                    <p>Remove local chat history from this device</p>
                  </div>
                  <button className="sp-data-btn warn" onClick={handleClearHistory}>Clear</button>
                </div>

                <div className="sp-data-item sp-data-danger">
                  <div className="sp-data-icon danger">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                  </div>
                  <div className="sp-data-info">
                    <h4>Delete All Data</h4>
                    <p>Permanently remove all history and settings</p>
                    <span className="sp-danger-tag">This action cannot be undone</span>
                  </div>
                  <button className="sp-data-btn danger" onClick={handleDeleteAllHistory}>Delete All</button>
                </div>
              </div>
            </section>

            {/* Logout */}
            <section className="sp-card sp-logout-card">
              <button className="sp-logout-btn" onClick={handleLogout} disabled={isLoggingOut}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                {isLoggingOut ? 'Logging Out...' : 'Log Out'}
              </button>
            </section>
          </div>
        )}
      </div>

      {/* ── Sticky Save Bar ── */}
      {hasUnsavedChanges && (
        <div className="save-bar">
          <div className="save-bar-content">
            <span className="unsaved-indicator">
              <span className="unsaved-dot"></span>
              Unsaved changes
            </span>
            <div className="save-bar-actions">
              <button className="save-bar-btn secondary" onClick={handleReset} disabled={saving}>Reset</button>
              <button className="save-bar-btn primary" onClick={handleSaveChanges} disabled={saving}>
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsPage;
