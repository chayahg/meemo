import { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

const DEFAULT_SETTINGS = {
  // Profile & Learning Goals
  profile: {
    displayName: 'User',
    email: 'user@example.com',
    country: 'Other',
    preferredLevel: 'intermediate',
    preferredCharacter: 'mentor',
    learningGoal: 'I want to improve my English speaking and writing skills.',
    avatarUrl: null // For future avatar upload
  },
  
  // Chat & Feedback Preferences
  chat: {
    showCorrections: true,
    showExplanation: false,
    replyStyle: 'normal', // 'short', 'normal', 'detailed'
    highlightMistakes: true,
    autoTranslate: false
  },
  
  // Voice & Speaking
  voice: {
    recognitionLanguage: 'en', // 'en' or 'en+native'
    speakingMode: 'press', // 'press' or 'always'
    speakingSpeed: 1.0
  },
  
  // Progress & Stats (view-only for now)
  stats: {
    overallScore: 0,
    grammarScore: 0,
    speakingFluency: 0,
    pronunciation: 0,
    listening: 0,
    vocabulary: 0,
    dailyStreak: 0,
    xpEarned: 0,
    currentLevel: 1
  },
  
  // Data & Privacy
  privacy: {
    saveHistory: true,
    improveWithData: false
  }
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    // Load from localStorage on init
    const saved = localStorage.getItem('meemo_settings');
    if (saved) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch (e) {
        console.error('Failed to parse saved settings:', e);
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  // Save to localStorage whenever settings change
  useEffect(() => {
    localStorage.setItem('meemo_settings', JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (newSettings) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const resetSettings = () => {
    const saved = localStorage.getItem('meemo_settings');
    if (saved) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      } catch (e) {
        setSettings(DEFAULT_SETTINGS);
      }
    } else {
      setSettings(DEFAULT_SETTINGS);
    }
  };

  const saveSettings = (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('meemo_settings', JSON.stringify(newSettings));
    
    // TODO: When Firebase is integrated, sync these settings to Firestore collections:
    // - user_profile: profile data (displayName, email, country, preferredLevel, etc.)
    // - scores: stats data (overallScore, grammarScore, etc.)
    // - streaks: dailyStreak, xpEarned, currentLevel
    // - achievements: future achievements data
    // - chat_history: conversation history (if privacy.saveHistory is true)
    // - exercises_history: practice exercises completed
    // - settings: all user preferences (chat, voice, privacy settings)
    // - translation_history: past translations
    // - speaking_history: speaking practice sessions
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings, saveSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
