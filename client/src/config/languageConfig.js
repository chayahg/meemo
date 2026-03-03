// Language configuration for Mee-Mo multi-language support
// Top 10 most popular languages for learning

export const LANGUAGES = [
  {
    code: 'english',
    name: 'English',
    nativeName: 'English',
    flag: '🇬🇧',
    speechCode: 'en-US',
    geminiCode: 'English',
    voiceFilter: (v) => v.lang.startsWith('en'),
    rtl: false
  },
  {
    code: 'spanish',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    speechCode: 'es-ES',
    geminiCode: 'Spanish',
    voiceFilter: (v) => v.lang.startsWith('es'),
    rtl: false
  },
  {
    code: 'french',
    name: 'French',
    nativeName: 'Français',
    flag: '🇫🇷',
    speechCode: 'fr-FR',
    geminiCode: 'French',
    voiceFilter: (v) => v.lang.startsWith('fr'),
    rtl: false
  },
  {
    code: 'german',
    name: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    speechCode: 'de-DE',
    geminiCode: 'German',
    voiceFilter: (v) => v.lang.startsWith('de'),
    rtl: false
  },
  {
    code: 'japanese',
    name: 'Japanese',
    nativeName: '日本語',
    flag: '🇯🇵',
    speechCode: 'ja-JP',
    geminiCode: 'Japanese',
    voiceFilter: (v) => v.lang.startsWith('ja'),
    rtl: false
  },
  {
    code: 'korean',
    name: 'Korean',
    nativeName: '한국어',
    flag: '🇰🇷',
    speechCode: 'ko-KR',
    geminiCode: 'Korean',
    voiceFilter: (v) => v.lang.startsWith('ko'),
    rtl: false
  },
  {
    code: 'italian',
    name: 'Italian',
    nativeName: 'Italiano',
    flag: '🇮🇹',
    speechCode: 'it-IT',
    geminiCode: 'Italian',
    voiceFilter: (v) => v.lang.startsWith('it'),
    rtl: false
  },
  {
    code: 'portuguese',
    name: 'Portuguese',
    nativeName: 'Português',
    flag: '🇧🇷',
    speechCode: 'pt-BR',
    geminiCode: 'Portuguese',
    voiceFilter: (v) => v.lang.startsWith('pt'),
    rtl: false
  },
  {
    code: 'chinese',
    name: 'Chinese',
    nativeName: '中文',
    flag: '🇨🇳',
    speechCode: 'zh-CN',
    geminiCode: 'Chinese (Mandarin)',
    voiceFilter: (v) => v.lang.startsWith('zh'),
    rtl: false
  },
  {
    code: 'arabic',
    name: 'Arabic',
    nativeName: 'العربية',
    flag: '🇸🇦',
    speechCode: 'ar-SA',
    geminiCode: 'Arabic',
    voiceFilter: (v) => v.lang.startsWith('ar'),
    rtl: true
  }
];

// Helper function to get language by code
export const getLanguageByCode = (code) => {
  return LANGUAGES.find(lang => lang.code === code) || LANGUAGES[0];
};

// Helper function to get speech code for a language
export const getSpeechCode = (languageCode) => {
  const lang = getLanguageByCode(languageCode);
  return lang.speechCode;
};

// Helper function to get Gemini language name
export const getGeminiLanguage = (languageCode) => {
  const lang = getLanguageByCode(languageCode);
  return lang.geminiCode;
};

// Default language
export const DEFAULT_LANGUAGE = 'english';
