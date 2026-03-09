import { useState, useEffect, useRef } from 'react';
import { useUser } from '../contexts/UserContext';
import ChatSidebar from '../components/ChatSidebar';
import ChatWindow from '../components/ChatWindow';
import CorrectionPanel from '../components/CorrectionPanel';
import {
  createSession,
  loadAllCharacterSessions,
  loadCharacterSessions,
  loadSessionMessages,
  appendMessageToSession,
  generateSessionTitle,
  updateSessionTitle,
  getRelativeTime,
  getCurrentUserId
} from '../services/chatHistoryService';
import { db } from '../firebaseConfig';
import { doc, deleteDoc } from 'firebase/firestore';
import { getGeminiLanguage, getLanguageByCode, getSpeechCode } from '../config/languageConfig';
import './ChatPage.css';

const CHARACTERS = [
  {
    id: 'mentor',
    name: 'Mentor Mee-Mo',
    role: 'Wise guide: explains things step-by-step.',
    accentColor: '#14b8a6',
    avatar: '/characters/mentor.png'
  },
  {
    id: 'vibe',
    name: 'Vibe Mee-Mo',
    role: 'Matches your vibe: relaxed, supportive chat.',
    accentColor: '#d946ef',
    avatar: '/characters/vibe.png'
  },
  {
    id: 'bro',
    name: 'Bro Mee-Mo',
    role: 'Best-friend energy: honest, casual English practice.',
    accentColor: '#06b6d4',
    avatar: '/characters/bro.png'
  },
  {
    id: 'luna',
    name: 'Luna Mee-Mo',
    role: 'Soft, friendly chats with a gentle tone.',
    accentColor: '#ec4899',
    avatar: '/characters/luna.png'
  }
];



function ChatPage() {
  const { user } = useUser();
  const [selectedCharacter, setSelectedCharacter] = useState(CHARACTERS[0]);
  const [characterSessions, setCharacterSessions] = useState({}); // { mentor: [...sessions], vibe: [...sessions], ... }
  const [currentSessionId, _setCurrentSessionId] = useState(null);
  const [expandedCharacter, setExpandedCharacter] = useState(null); // Which character card is expanded
  const [messages, setMessages] = useState([]);
  const [corrections, setCorrections] = useState([]);
  // Mode: 'chat_only' or 'chat_corrections'
  const [mode, setMode] = useState('chat_corrections');
  const [showCorrections, setShowCorrections] = useState(true);
  const [showGrammarTips, setShowGrammarTips] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= 1024);
  const [isCorrectionPanelOpen, setIsCorrectionPanelOpen] = useState(() => window.innerWidth >= 1024);
  const [isTTSEnabled, setIsTTSEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognitionSupported, setRecognitionSupported] = useState(true);
  const [speechSynthesisSupported, setSpeechSynthesisSupported] = useState(true);
  const [voices, setVoices] = useState([]);
  const [characterVoices, setCharacterVoices] = useState({});
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [speakingMessageId, setSpeakingMessageId] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const skipNextAutoLoadRef = useRef(false); // Prevents useEffect from overriding handleNewChat

  // Refs that ALWAYS hold the latest values — updated SYNCHRONOUSLY so async
  // handlers never see stale closures (unlike useState which only updates after render)
  const userRef = useRef(null);
  const sessionIdRef = useRef(null);

  // Wrapper: updates BOTH state AND ref simultaneously (ref is instant, state triggers re-render)
  const setCurrentSessionId = (id) => {
    sessionIdRef.current = id;
    _setCurrentSessionId(id);
  };

  // Character voice presets - each has unique speaking style
  const CHARACTER_VOICE_PRESETS = {
    mentor: {
      rate: 0.95,      // Calm, measured pace
      pitch: 1.0,      // Neutral, clear tone
      volume: 1.0,
      voiceFilter: (voices) => voices.find(v => 
        v.name.includes('David') || 
        v.name.includes('Daniel') ||
        (v.name.toLowerCase().includes('male') && !v.name.toLowerCase().includes('female'))
      ) || voices[0]
    },
    vibe: {
      rate: 0.88,      // Relaxed, slower pace
      pitch: 0.95,     // Slightly lower, laid-back tone
      volume: 0.95,
      voiceFilter: (voices) => voices.find(v => 
        v.name.includes('Mark') ||
        v.name.includes('Ryan') ||
        (v.name.toLowerCase().includes('male') && !v.name.toLowerCase().includes('female'))
      ) || voices[1] || voices[0]
    },
    bro: {
      rate: 1.08,      // Energetic, faster pace
      pitch: 1.05,     // Slightly higher, friendly tone
      volume: 1.0,
      voiceFilter: (voices) => voices.find(v => 
        v.name.includes('James') ||
        v.name.includes('Alex') ||
        (v.name.toLowerCase().includes('male') && !v.name.toLowerCase().includes('female'))
      ) || voices[2] || voices[0]
    },
    luna: {
      rate: 0.93,      // Gentle, medium pace
      pitch: 1.15,     // Warm female tone
      volume: 0.98,
      voiceFilter: (voices) => {
        // Try known female voice names first
        const femaleNames = ['Zira', 'Samantha', 'Hazel', 'Susan', 'Jenny', 'Aria', 'Sara', 'Catherine', 'Helena', 'Tracy', 'Linda', 'Heera', 'Heather', 'Michelle', 'Emily', 'Salli', 'Joanna', 'Ivy', 'Kendra', 'Amy'];
        const femaleVoice = voices.find(v => femaleNames.some(name => v.name.includes(name)));
        if (femaleVoice) return femaleVoice;
        // Try any voice with 'female' in name
        const genderVoice = voices.find(v => v.name.toLowerCase().includes('female'));
        if (genderVoice) return genderVoice;
        // Try Google Female voices
        const googleFemale = voices.find(v => v.name.includes('Google') && v.name.includes('Female'));
        if (googleFemale) return googleFemale;
        // Exclude known male voice names, pick first remaining English voice
        const maleNames = ['David', 'Daniel', 'Mark', 'James', 'Alex', 'Ryan', 'George', 'Sean', 'Ravi', 'Richard', 'Guy', 'Roger', 'Fred'];
        const nonMaleVoice = voices.find(v => v.lang.startsWith('en') && !maleNames.some(name => v.name.includes(name)));
        if (nonMaleVoice) return nonMaleVoice;
        // Last resort: first available voice
        return voices[0];
      }
    }
  };

  // Load available voices for TTS
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices);
        // Initialize character-specific voices using presets
        const voiceMap = initializeCharacterVoices(availableVoices);
        setCharacterVoices(voiceMap);
      }
    };

    // Load voices immediately
    loadVoices();

    // Also listen for voiceschanged event (some browsers need this)
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, []);

  // Helper function to initialize character voices using presets
  const initializeCharacterVoices = (availableVoices) => {
    if (availableVoices.length === 0) return {};

    // Get the target language speech code
    const targetLangCode = user?.profile?.targetLanguage || 'english';
    const langConfig = getLanguageByCode(targetLangCode);
    const isEnglish = targetLangCode === 'english';

    // For English: use English voices with character personality presets
    // For foreign languages: find voices matching the target language
    let voicesToUse;
    if (isEnglish) {
      const englishVoices = availableVoices.filter(v => v.lang.startsWith('en'));
      voicesToUse = englishVoices.length > 0 ? englishVoices : availableVoices;
    } else {
      // Find voices for the target language
      const targetVoices = availableVoices.filter(v => langConfig.voiceFilter(v));
      voicesToUse = targetVoices.length > 0 ? targetVoices : availableVoices;
    }

    // Apply voice filter from each character's preset
    const voiceMap = {};

    // Known female voice names across languages (Microsoft Online Natural voices)
    const KNOWN_FEMALE_VOICES = [
      // English
      'Zira', 'Samantha', 'Hazel', 'Susan', 'Jenny', 'Aria', 'Sara', 'Catherine',
      'Helena', 'Tracy', 'Linda', 'Heera', 'Heather', 'Michelle', 'Emily', 'Salli',
      'Joanna', 'Ivy', 'Kendra', 'Amy', 'Emma', 'Libby', 'Sonia',
      // Japanese
      'Nanami', 'Ayumi', 'Haruka', 'Mayu', 'Shiori',
      // Korean
      'SunHi', 'Sun-Hi', 'Yuna', 'JiYun',
      // Spanish
      'Elvira', 'Sabina', 'Lucia', 'Abril', 'Helena', 'Dalia', 'Nuria', 'Lola',
      // French
      'Denise', 'Caroline', 'Sylvie', 'Eloise', 'Julie',
      // German
      'Katja', 'Hedda', 'Amala', 'Louisa',
      // Italian
      'Elsa', 'Isabella', 'Cosimo',
      // Portuguese
      'Francisca', 'Maria', 'Brenda', 'Leila', 'Fernanda', 'Thalita',
      // Chinese
      'Xiaoxiao', 'Xiaoyi', 'Xiaomo', 'Huihui', 'Yaoyao', 'Lili',
      // Arabic
      'Salma', 'Amina', 'Zariyah', 'Hala', 'Fatima',
      // Google
      'Google Female', 'Google UK English Female',
    ];

    // Helper: check if a voice is likely female
    const isFemaleVoice = (voice) => {
      const name = voice.name;
      // Check against known female names
      if (KNOWN_FEMALE_VOICES.some(fn => name.includes(fn))) return true;
      // Check for gender keywords in the voice name
      if (name.toLowerCase().includes('female')) return true;
      // Exclude known male names to narrow it down
      const knownMale = ['David', 'Daniel', 'Mark', 'James', 'Alex', 'Ryan', 'George',
        'Sean', 'Ravi', 'Richard', 'Guy', 'Roger', 'Fred', 'Keita', 'Ichiro',
        'Naoki', 'InJoon', 'Alvaro', 'Pablo', 'Henri', 'Conrad', 'Diego',
        'Rafael', 'Yunxi', 'Yunjian', 'Google Male', 'Google UK English Male'];
      if (knownMale.some(mn => name.includes(mn))) return false;
      // Unknown — can't tell
      return null;
    };

    Object.keys(CHARACTER_VOICE_PRESETS).forEach(charId => {
      const preset = CHARACTER_VOICE_PRESETS[charId];
      if (!isEnglish) {
        // Filter voices that actually match the target language
        const targetVoices = availableVoices.filter(v => langConfig.voiceFilter(v));
        if (targetVoices.length === 0) {
          // No target-language voices installed — let browser auto-select
          voiceMap[charId] = null;
        } else if (charId === 'luna') {
          // Luna = girl character → ALWAYS pick a female voice
          const femaleVoice = targetVoices.find(v => isFemaleVoice(v) === true);
          // If no confirmed female, pick one that's at least NOT confirmed male
          const notMaleVoice = femaleVoice || targetVoices.find(v => isFemaleVoice(v) !== false);
          voiceMap[charId] = notMaleVoice || targetVoices[0];
        } else {
          voiceMap[charId] = targetVoices[0];
        }
      } else {
        voiceMap[charId] = preset.voiceFilter(voicesToUse);
      }
      console.log(`🎤 ${charId} voice: ${voiceMap[charId]?.name || 'none (browser auto)'} (${voiceMap[charId]?.lang || 'unknown'})`);
    });

    return voiceMap;
  };

  // Keep userRef in sync — set SYNCHRONOUSLY on every render so it's never stale
  userRef.current = user;
  // sessionIdRef is handled by setCurrentSessionId wrapper above

  // Track if user has loaded (for refs, not for auto-expanding sidebar)
  const didAutoExpandRef = useRef(false);
  useEffect(() => {
    if (user?.uid && !didAutoExpandRef.current) {
      didAutoExpandRef.current = true;
      // Don't auto-expand — show all 4 character cards first
    }
  }, [user?.uid]);

  // Load all character sessions on mount and when user changes
  useEffect(() => {
    const loadAllSessions = async () => {
      // Use user?.uid from context (the source of truth for this effect)
      // DO NOT use getCurrentUserId() here — auth.currentUser may still be null
      // even when the UserContext has already resolved the user object.
      const userId = user?.uid;

      setLoadingHistory(true);
      
      if (!userId) {
        // Not logged in - show empty sessions for all characters
        const emptySessions = {};
        CHARACTERS.forEach(char => {
          emptySessions[char.id] = [];
        });
        setCharacterSessions(emptySessions);
        setLoadingHistory(false);
        return;
      }
      
      try {
        const allSessions = await loadAllCharacterSessions({ userId });
        setCharacterSessions(allSessions);
        
        // Don't auto-expand - let user choose which character to view
      } catch (error) {
        console.error('Error loading character sessions:', error);
      } finally {
        setLoadingHistory(false);
      }
    };

    loadAllSessions();
  }, [user?.uid]);

  // Initialize chat on mount and when character changes
  useEffect(() => {
    // Check browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setRecognitionSupported(!!SpeechRecognition);
    setSpeechSynthesisSupported('speechSynthesis' in window);

    // Skip auto-load if handleNewChat already set up the greeting
    if (skipNextAutoLoadRef.current) {
      skipNextAutoLoadRef.current = false;
      return;
    }

    // Initialize fresh chat for the selected character.
    // Also depends on user?.uid so that when auth resolves (user goes from null
    // to a real uid) we reload the session list from Firestore.
    initializeNewChat(selectedCharacter.id);
  }, [selectedCharacter.id, user?.uid]);

  // Sync mode with showCorrections and showGrammarTips
  useEffect(() => {
    const isCorrectionsMode = mode === 'chat_corrections';
    setShowCorrections(isCorrectionsMode);
    setShowGrammarTips(isCorrectionsMode);
  }, [mode]);

  // Initialize corrections visibility from user settings
  useEffect(() => {
    if (user?.settings) {
      setShowCorrections(user.settings.showGrammar !== false);
      setShowGrammarTips(user.settings.showDetailedRules === true);
    }
  }, [user?.settings]);

  // Sync selected character from user profile when settings change
  useEffect(() => {
    if (user?.profile?.preferredCharacter) {
      const preferred = CHARACTERS.find(c => c.id === user.profile.preferredCharacter);
      if (preferred && preferred.id !== selectedCharacter.id) {
        setSelectedCharacter(preferred);
      }
    }
  }, [user?.profile?.preferredCharacter]);

  // Re-initialize character voices when target language changes
  useEffect(() => {
    if (voices.length > 0) {
      const voiceMap = initializeCharacterVoices(voices);
      setCharacterVoices(voiceMap);
    }
  }, [user?.profile?.targetLanguage, voices]);

  const initializeNewChat = async (characterId, skipAutoLoad = false) => {
    const char = CHARACTERS.find(c => c.id === characterId);
    const targetLangCode = user?.profile?.targetLanguage || 'english';
    const targetLang = getGeminiLanguage(targetLangCode);
    const isTeaching = targetLangCode !== 'english';

    // Try to auto-load the most recent session for this character (unless explicitly creating new)
    if (!skipAutoLoad) {
      // Use ref (not closure) so we always get the latest uid even if auth resolved late
      const userId = userRef.current?.uid;
      if (userId) {
        try {
          // Always fetch fresh from Firestore (don't rely on stale state)
          const sessions = await loadCharacterSessions({ userId, characterId });
          if (sessions.length > 0) {
            const latestSession = sessions[0]; // Already sorted by updatedAt desc
            // Update local sessions state with fresh data
            setCharacterSessions(prev => ({
              ...prev,
              [characterId]: sessions
            }));
            const msgs = await loadSessionMessages({ userId, characterId, sessionId: latestSession.id });
            if (msgs.length > 0) {
              const formattedMessages = msgs.map((msg, index) => ({
                id: `${latestSession.id}-${index}`,
                sender: msg.role === 'user' ? 'user' : 'meemo',
                text: msg.text,
                corrected: msg.correctedText,
                mistakes: msg.mistakes || [],
                hadChanges: !!msg.correctedText,
                timestamp: msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
                timestampMs: msg.createdAt?.getTime ? msg.createdAt.getTime() : Date.now(),
                // Restore teaching data
                isTeachingMode: !!(msg.teachingData),
                romanization: msg.teachingData?.romanization || '',
                meaning: msg.teachingData?.meaning || '',
                // Restore inline corrections
                englishCorrection: msg.teachingData?.englishCorrection || null,
                targetLangCorrection: msg.teachingData?.targetLangCorrection || null,
                // Restore full panel data for per-message click
                usage: msg.teachingData?.usage || '',
                formalForm: msg.teachingData?.formalForm || '',
                informalForm: msg.teachingData?.informalForm || '',
                alternatives: msg.teachingData?.alternatives || '',
                culturalNote: msg.teachingData?.culturalNote || '',
                vocabulary: msg.teachingData?.vocabulary || [],
              }));
              setMessages(formattedMessages);
              setCurrentSessionId(latestSession.id);

              // Rebuild correction panel from auto-loaded session
              if (isTeaching) {
                const lastAssistant = [...msgs].reverse().find(m => m.role === 'assistant' && m.teachingData);
                if (lastAssistant?.teachingData) {
                  const td = lastAssistant.teachingData;
                  const teachingCard = {
                    id: `autoload-teach-${latestSession.id}`,
                    isVocabulary: true,
                    targetLanguage: targetLang || '',
                    usage: td.usage || '',
                    formalForm: td.formalForm || '',
                    informalForm: td.informalForm || '',
                    alternatives: td.alternatives || '',
                    culturalNote: td.culturalNote || '',
                    targetLangCorrection: td.targetLangCorrection || null,
                    vocabulary: (td.vocabulary || []).map((v, i) => ({
                      id: `autoload-${i}`,
                      word: v.word,
                      romanization: v.romanization,
                      meaning: v.meaning
                    }))
                  };
                  setCorrections([teachingCard]);
                } else {
                  setCorrections([]);
                }
              } else {
                setCorrections([]);
              }
              return;
            }
            // Session exists but has no messages yet (race condition) — reuse it instead of creating a new one
            console.log(`📌 Reusing empty session ${latestSession.id} for ${characterId}`);
            setCurrentSessionId(latestSession.id);
            // Still show greeting below, but don't create a new session
            const char2 = CHARACTERS.find(c => c.id === characterId);
            let greetText;
            if (isTeaching) {
              greetText = `Hello! I'm ${char2.name}. I'll help you learn ${targetLang}! Just type anything in English, and I'll teach you how to say it in ${targetLang} with pronunciation guides. Let's start! 🌟`;
            } else {
              greetText = `Hello! I'm ${char2.name}. ${char2.role} How can I help you today?`;
            }
            setMessages([{
              id: Date.now(),
              sender: 'meemo',
              text: greetText,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              timestampMs: Date.now()
            }]);
            setCorrections([]);
            return;
          }
        } catch (error) {
          console.error('Error auto-loading last session:', error);
        }
      }
    }
    
    // Fallback: show greeting if no previous session found (first time ever for this character)
    let greetingText;
    if (isTeaching) {
      greetingText = `Hello! I'm ${char.name}. I'll help you learn ${targetLang}! Just type anything in English, and I'll teach you how to say it in ${targetLang} with pronunciation guides. Let's start! 🌟`;
    } else {
      greetingText = `Hello! I'm ${char.name}. ${char.role} How can I help you today?`;
    }
    
    const greeting = {
      id: Date.now(),
      sender: 'meemo',
      text: greetingText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestampMs: Date.now()
    };
    setMessages([greeting]);
    setCorrections([]);

    // Don't create a Firestore session yet — wait until user actually sends a message
    // The FALLBACK handler in handleSendMessage will create a session on first send
    setCurrentSessionId(null);
  };

  const handleCharacterChange = (character) => {
    setSelectedCharacter(character);
  };

  const handleToggleCorrections = (value) => {
    setShowCorrections(value);
    setMode(value ? 'chat_corrections' : 'chat_only');
  };

  const handleToggleGrammarTips = (value) => {
    setShowGrammarTips(value);
    // Note: This only affects current session, not saved to Firestore
    // User can change default in Settings page
  };

  // Toggle character expansion in sidebar
  const handleToggleCharacter = (characterId) => {
    if (expandedCharacter === characterId) {
      setExpandedCharacter(null); // Collapse if already expanded
    } else {
      setExpandedCharacter(characterId); // Expand this character
    }
  };

  // Create new chat session for a character
  const handleNewChat = async (characterId) => {
    try {
      const userId = userRef.current?.uid;
      const character = CHARACTERS.find(c => c.id === characterId);
      
      if (!character) return;
      
      const targetLangCode = user?.profile?.targetLanguage || 'english';
      const targetLang = getGeminiLanguage(targetLangCode);
      const isTeaching = targetLangCode !== 'english';
      
      // Build greeting
      let greetingText;
      if (isTeaching) {
        greetingText = `Hello! I'm ${character.name}. I'll help you learn ${targetLang}! Just type anything in English, and I'll teach you how to say it in ${targetLang} with pronunciation guides. Let's start! 🌟`;
      } else {
        greetingText = `Hello! I'm ${character.name}. ${character.role} How can I help you today?`;
      }
      
      const greeting = {
        id: Date.now(),
        sender: 'meemo',
        text: greetingText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestampMs: Date.now()
      };
      
      // Prevent the useEffect from overriding our setup
      skipNextAutoLoadRef.current = true;
      
      // Set greeting and clear state
      setMessages([greeting]);
      setCorrections([]);
      
      if (!userId) {
        setSelectedCharacter(character);
        setCurrentSessionId(null);
        return;
      }
      
      // Don't create a Firestore session yet — wait until user sends a message
      // The FALLBACK handler in handleSendMessage will create the session
      setCurrentSessionId(null);
      
      // Switch to this character AFTER setting up everything
      setSelectedCharacter(character);
      
    } catch (error) {
      console.error('Error creating new chat:', error);
      // Fallback
      const character = CHARACTERS.find(c => c.id === characterId);
      if (character) {
        skipNextAutoLoadRef.current = true;
        setSelectedCharacter(character);
        setCurrentSessionId(null);
        initializeNewChat(characterId, true);
      }
    }
  };

  // Load a specific session when clicked
  const handleSelectSession = async (characterId, sessionId) => {
    try {
      const character = CHARACTERS.find(c => c.id === characterId);
      if (!character) return;
      
      // Prevent the useEffect from overriding our session load
      skipNextAutoLoadRef.current = true;
      setSelectedCharacter(character);
      setCurrentSessionId(sessionId);
      setExpandedCharacter(characterId);
      setLoadingMessages(true);
      
      const userId = userRef.current?.uid;
      
      if (!userId) {
        initializeNewChat(characterId);
        setLoadingMessages(false);
        return;
      }
      
      const msgs = await loadSessionMessages({ userId, characterId, sessionId });
      
      if (msgs.length === 0) {
        // Empty session - show greeting
        initializeNewChat(characterId);
      } else {
        // Convert session messages to UI format (including teaching data)
        const formattedMessages = msgs.map((msg, index) => ({
          id: `${sessionId}-${index}`,
          sender: msg.role === 'user' ? 'user' : 'meemo',
          text: msg.text,
          corrected: msg.correctedText,
          mistakes: msg.mistakes || [],
          hadChanges: !!msg.correctedText,
          timestamp: msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          timestampMs: msg.createdAt?.getTime ? msg.createdAt.getTime() : Date.now(),
          // Restore teaching data for proper bubble display
          isTeachingMode: !!(msg.teachingData),
          romanization: msg.teachingData?.romanization || '',
          meaning: msg.teachingData?.meaning || '',
          // Restore inline corrections
          englishCorrection: msg.teachingData?.englishCorrection || null,
          targetLangCorrection: msg.teachingData?.targetLangCorrection || null,
          // Restore full panel data for per-message click
          usage: msg.teachingData?.usage || '',
          formalForm: msg.teachingData?.formalForm || '',
          informalForm: msg.teachingData?.informalForm || '',
          alternatives: msg.teachingData?.alternatives || '',
          culturalNote: msg.teachingData?.culturalNote || '',
          vocabulary: msg.teachingData?.vocabulary || [],
        }));
        
        setMessages(formattedMessages);
        
        // Rebuild correction panel from loaded messages
        const targetLangCode = user?.profile?.targetLanguage || 'english';
        const isTeaching = targetLangCode !== 'english';
        const targetLangName = getGeminiLanguage(targetLangCode);
        
        if (isTeaching) {
          // Find the last assistant message with teaching data
          const lastAssistant = [...msgs].reverse().find(m => m.role === 'assistant' && m.teachingData);
          if (lastAssistant?.teachingData) {
            const td = lastAssistant.teachingData;
            const teachingCard = {
              id: `session-teach-${sessionId}`,
              isVocabulary: true,
              targetLanguage: targetLangName || '',
              usage: td.usage || '',
              formalForm: td.formalForm || '',
              informalForm: td.informalForm || '',
              alternatives: td.alternatives || '',
              culturalNote: td.culturalNote || '',
              targetLangCorrection: td.targetLangCorrection || null,
              vocabulary: (td.vocabulary || []).map((v, i) => ({
                id: `session-${i}`,
                word: v.word,
                romanization: v.romanization,
                meaning: v.meaning
              }))
            };
            setCorrections([teachingCard]);
          } else {
            setCorrections([]);
          }
        } else {
          // English mode: extract corrections from last user message
          const lastUserMessage = [...formattedMessages].reverse().find(m => m.sender === 'user' && m.mistakes?.length > 0);
          if (lastUserMessage && mode === 'chat_corrections') {
            const correction = {
              id: `session-${lastUserMessage.id}`,
              original: lastUserMessage.text,
              corrected: lastUserMessage.corrected,
              mistakes: lastUserMessage.mistakes.map((mistake, index) => ({
                id: `${lastUserMessage.id}-${index}`,
                original: mistake.originalFragment,
                corrected: mistake.correctedFragment,
                explanation: mistake.explanation
              }))
            };
            setCorrections([correction]);
          } else {
            setCorrections([]);
          }
        }
      }
      
    } catch (error) {
      console.error('Error loading session:', error);
      initializeNewChat(characterId);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Rename session
  const handleRenameSession = async (characterId, sessionId) => {
    const userId = user?.uid;
    if (!userId) return;

    const session = characterSessions[characterId]?.find(s => s.id === sessionId);
    if (!session) return;

    const newTitle = prompt('Enter new chat name:', session.title);
    if (!newTitle || newTitle.trim() === '' || newTitle === session.title) return;

    try {
      await updateSessionTitle({ userId, characterId, sessionId, title: newTitle.trim() });
      
      // Update local state
      setCharacterSessions(prev => ({
        ...prev,
        [characterId]: prev[characterId].map(s =>
          s.id === sessionId ? { ...s, title: newTitle.trim() } : s
        )
      }));
    } catch (error) {
      console.error('Error renaming session:', error);
      alert('Failed to rename chat. Please try again.');
    }
  };

  // Delete session
  const handleDeleteSession = async (characterId, sessionId) => {
    const userId = user?.uid;
    if (!userId) return;

    const confirmed = window.confirm('Are you sure you want to delete this chat? This cannot be undone.');
    if (!confirmed) return;

    try {
      // Delete from Firestore
      const sessionRef = doc(db, 'users', userId, 'characters', characterId, 'sessions', sessionId);
      await deleteDoc(sessionRef);
      
      // Update local state
      setCharacterSessions(prev => ({
        ...prev,
        [characterId]: prev[characterId].filter(s => s.id !== sessionId)
      }));

      // If this was the current session, clear it
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        initializeNewChat(characterId);
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Failed to delete chat. Please try again.');
    }
  };

  // Share session
  const handleShareSession = async (characterId, sessionId) => {
    const userId = user?.uid;
    if (!userId) return;

    try {
      const msgs = await loadSessionMessages({ userId, characterId, sessionId });
      const session = characterSessions[characterId]?.find(s => s.id === sessionId);
      
      if (!msgs || msgs.length === 0) {
        alert('This chat is empty and cannot be shared.');
        return;
      }

      const character = CHARACTERS.find(c => c.id === characterId);
      
      // Format conversation as text
      let conversationText = `Chat with ${character?.name || 'Mee-Mo'}\n`;
      conversationText += `Title: ${session?.title || 'Untitled Chat'}\n`;
      conversationText += `Date: ${new Date().toLocaleDateString()}\n`;
      conversationText += `${'='.repeat(50)}\n\n`;
      
      msgs.forEach(msg => {
        const role = msg.role === 'user' ? 'You' : character?.name || 'Mee-Mo';
        conversationText += `${role}: ${msg.text}\n\n`;
      });

      // Copy to clipboard
      await navigator.clipboard.writeText(conversationText);
      alert('Conversation copied to clipboard! You can now paste and share it.');
    } catch (error) {
      console.error('Error sharing session:', error);
      alert('Failed to share chat. Please try again.');
    }
  };

  const handleSendMessage = async (text) => {
    // Cancel any ongoing speech
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestampMs: Date.now(),
      hadChanges: false,
      mistakes: []
    };
    
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    try {
      // Use ref values — these are always current even inside async continuations
      const userId = userRef.current?.uid;

      // Build conversation history for API
      const history = messages.filter(msg => msg.sender !== 'meemo' || msg.text).map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      }));

      // Call backend API with user ID for XP tracking
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          character: selectedCharacter.id,
          message: text,
          history: history,
          replyStyle: user?.settings?.replyStyle || 'normal',
          showDetailedRules: user?.settings?.showDetailedRules ?? true,
          preferredLevel: user?.profile?.preferredLevel || 'intermediate',
          targetLanguage: getGeminiLanguage(user?.profile?.targetLanguage || 'english'),
          userId: user?.uid, // Send user ID for backend stats tracking
          userName: user?.profile?.displayName || '' // Send user's name so character can address them
        })
      });

      if (!response.ok) {
        // Try to parse error message
        let errorMessage = 'Failed to get response from Mee-Mo';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If JSON parsing fails, use status text
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Add Mee-Mo's response
      const meeMoMessageId = Date.now() + 1;
      const meeMoMessage = {
        id: meeMoMessageId,
        sender: 'meemo',
        text: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestampMs: Date.now(),
        // Foreign language teaching fields
        isTeachingMode: data.isTeachingMode || false,
        romanization: data.romanization || '',
        meaning: data.meaning || '',
        // Full teaching panel data (for per-message correction panel)
        usage: data.usage || '',
        formalForm: data.formalForm || '',
        informalForm: data.informalForm || '',
        alternatives: data.alternatives || '',
        culturalNote: data.culturalNote || '',
        targetLangCorrection: data.targetLangCorrection || null,
        vocabulary: data.vocabulary || [],
      };
      
      // Update user message with correction info
      const finalUserMessage = {
        ...userMessage,
        corrected: data.hadChanges ? data.correctedMessage : null,
        hadChanges: data.hadChanges,
        mistakes: data.mistakes || [],
        // Inline corrections for teaching mode (shown in bubble, NOT in panel)
        englishCorrection: data.englishCorrection || null,
        targetLangCorrection: data.targetLangCorrection || null,
      };

      const finalMessages = [
        ...messages,
        finalUserMessage,
        meeMoMessage
      ];
      setMessages(finalMessages);

      // Auto-select the AI message to show speaker icon
      setTimeout(() => {
        setSelectedMessageId(meeMoMessageId);
      }, 300);

      // Use sessionIdRef so we always get the latest session ID even if state updated during the API call
      const activeSessionId = sessionIdRef.current;
      const debugMsg = `SAVE DEBUG: userId=${userId || 'NULL'}, sessionId=${activeSessionId || 'NULL'}, char=${selectedCharacter.id}`;
      console.log(`💾 ${debugMsg}`);
      console.warn(`💾 ${debugMsg}`); // shows in yellow so it's easy to spot
      if (userId && activeSessionId) {
        try {
          console.log(`💾 Saving to existing session ${activeSessionId}`);
          // Append user message to session
          await appendMessageToSession({
            userId,
            characterId: selectedCharacter.id,
            sessionId: activeSessionId,
            role: 'user',
            text: finalUserMessage.text,
            mode: mode,
            correctedText: finalUserMessage.corrected,
            mistakes: finalUserMessage.mistakes,
            teachingData: data.isTeachingMode ? {
              englishCorrection: data.englishCorrection || null,
              targetLangCorrection: data.targetLangCorrection || null
            } : null
          });
          
          // Append AI message to session (include ALL teaching data for persistence)
          await appendMessageToSession({
            userId,
            characterId: selectedCharacter.id,
            sessionId: activeSessionId,
            role: 'assistant',
            text: meeMoMessage.text,
            mode: mode,
            teachingData: data.isTeachingMode ? {
              romanization: data.romanization || '',
              meaning: data.meaning || '',
              usage: data.usage || '',
              formalForm: data.formalForm || '',
              informalForm: data.informalForm || '',
              alternatives: data.alternatives || '',
              culturalNote: data.culturalNote || '',
              targetLangCorrection: data.targetLangCorrection || null,
              vocabulary: data.vocabulary || []
            } : null
          });
          
          // Generate title if this is first message pair
          const isFirstMessage = messages.filter(m => m.sender === 'user').length === 0;
          if (isFirstMessage) {
            try {
              const title = await generateSessionTitle(finalUserMessage.text, meeMoMessage.text);
              await updateSessionTitle({ 
                userId, 
                characterId: selectedCharacter.id, 
                sessionId: activeSessionId, 
                title 
              });
              
              // Update session title in local state
              setCharacterSessions(prev => ({
                ...prev,
                [selectedCharacter.id]: (prev[selectedCharacter.id] || []).map(session =>
                  session.id === activeSessionId ? { ...session, title } : session
                )
              }));
            } catch (titleError) {
              console.error('Error generating title:', titleError);
            }
          }
          
          // Update session timestamp in local state
          setCharacterSessions(prev => ({
            ...prev,
            [selectedCharacter.id]: (prev[selectedCharacter.id] || []).map(session =>
              session.id === activeSessionId ? { ...session, updatedAt: new Date() } : session
            )
          }));
          
        } catch (firestoreError) {
          console.error('Error saving to Firestore:', firestoreError);
          // Don't throw - message is already shown in UI
        }
      } else if (userId && !activeSessionId) {
        // User is logged in but no session yet - create one
        console.warn(`💾 FALLBACK: No session yet, creating new session for ${selectedCharacter.id}`);
        try {
          const newSession = await createSession({ userId, characterId: selectedCharacter.id });
          if (newSession) {
            setCurrentSessionId(newSession.id);
            
            // Add to character sessions
            setCharacterSessions(prev => ({
              ...prev,
              [selectedCharacter.id]: [newSession, ...(prev[selectedCharacter.id] || [])]
            }));
            
            // Save greeting message first (if exists)
            const greetingMsg = messages.find(m => m.sender === 'meemo' && m.id !== meeMoMessageId);
            if (greetingMsg) {
              await appendMessageToSession({
                userId,
                characterId: selectedCharacter.id,
                sessionId: newSession.id,
                role: 'assistant',
                text: greetingMsg.text,
                mode: 'chat_only'
              });
            }
            
            // Save user message
            await appendMessageToSession({
              userId,
              characterId: selectedCharacter.id,
              sessionId: newSession.id,
              role: 'user',
              text: finalUserMessage.text,
              mode: mode,
              correctedText: finalUserMessage.corrected,
              mistakes: finalUserMessage.mistakes,
              teachingData: data.isTeachingMode ? {
                englishCorrection: data.englishCorrection || null,
                targetLangCorrection: data.targetLangCorrection || null
              } : null
            });
            
            await appendMessageToSession({
              userId,
              characterId: selectedCharacter.id,
              sessionId: newSession.id,
              role: 'assistant',
              text: meeMoMessage.text,
              mode: mode,
              teachingData: data.isTeachingMode ? {
                romanization: data.romanization || '',
                meaning: data.meaning || '',
                usage: data.usage || '',
                formalForm: data.formalForm || '',
                informalForm: data.informalForm || '',
                alternatives: data.alternatives || '',
                culturalNote: data.culturalNote || '',
                targetLangCorrection: data.targetLangCorrection || null,
                vocabulary: data.vocabulary || []
              } : null
            });
            
            // Generate title
            const title = await generateSessionTitle(finalUserMessage.text, meeMoMessage.text);
            await updateSessionTitle({ 
              userId, 
              characterId: selectedCharacter.id, 
              sessionId: newSession.id, 
              title 
            });
            
            // Update session with title
            setCharacterSessions(prev => ({
              ...prev,
              [selectedCharacter.id]: (prev[selectedCharacter.id] || []).map(session =>
                session.id === newSession.id ? { ...session, title } : session
              )
            }));
          }
        } catch (sessionError) {
          console.error('Error creating session:', sessionError);
        }
      } else if (!userId) {
        console.error(`❌ CANNOT SAVE: user not logged in (userId is null)`);
      }

      // Update corrections/vocabulary panel
      if (data.isTeachingMode) {
        // Teaching mode: REPLACE panel with current message data only (not accumulated)
        const teachingCard = {
          id: `teach-${Date.now()}`,
          isVocabulary: true,
          targetLanguage: data.targetLanguage || '',
          // Minimal structured fields
          usage: data.usage || '',
          formalForm: data.formalForm || '',
          informalForm: data.informalForm || '',
          alternatives: data.alternatives || '',
          culturalNote: data.culturalNote || '',
          // Target language correction (only if user wrote bad target language)
          targetLangCorrection: data.targetLangCorrection || null,
          vocabulary: (data.vocabulary || []).map((v, i) => ({
            id: `${Date.now()}-${i}`,
            word: v.word,
            romanization: v.romanization,
            meaning: v.meaning
          }))
        };
        // Replace entirely — only show data for the current message
        setCorrections([teachingCard]);
      } else if (data.mistakes && data.mistakes.length > 0) {
        // English mode: show grammar corrections
        const newCorrection = {
          id: `msg-${Date.now()}`,
          original: text,
          corrected: data.correctedMessage,
          mistakes: data.mistakes.map((mistake, index) => ({
            id: `${Date.now()}-${index}`,
            original: mistake.originalFragment,
            corrected: mistake.correctedFragment,
            explanation: mistake.explanation
          }))
        };
        setCorrections(prev => [newCorrection, ...prev].slice(0, 10));
      } else if (data.hadChanges === false && messages.some(m => m.sender === 'user')) {
        // Show positive feedback if no mistakes
        setCorrections([{
          id: 'perfect-' + Date.now(),
          original: '',
          corrected: '',
          explanation: 'Looks great – no corrections needed!',
          isPerfect: true
        }, ...corrections.filter(c => !c.isPerfect)]);
      }

      // Auto-play character's voice (unless muted)
      if (!isMuted && speechSynthesisSupported && data.reply) {
        playCharacterVoice(selectedCharacter.id, data.reply, meeMoMessageId);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      // Show error message
      const errorMessage = {
        id: Date.now() + 1,
        sender: 'meemo',
        text: error.message || 'Mee-Mo had a small hiccup. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestampMs: Date.now(),
        isError: true
      };
      const errorMessages = [...updatedMessages, errorMessage];
      setMessages(errorMessages);
      // Note: error messages are shown in UI but not persisted to Firestore
    }
  };

  // Play character voice with unique speaking style
  const playCharacterVoice = (characterId, text, messageId = null) => {
    if (!window.speechSynthesis) return;
    
    // Stop any ongoing speech
    window.speechSynthesis.cancel();
    
    // Don't speak if no voices are loaded yet
    if (voices.length === 0) {
      console.warn('No voices available yet for TTS');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set the language for the utterance based on target language
    const targetLangCode = user?.profile?.targetLanguage || 'english';
    const speechCode = getSpeechCode(targetLangCode);
    utterance.lang = speechCode;
    
    // Get the voice and preset for the character
    const characterVoice = characterVoices[characterId]; // null if no voice for target language
    const preset = CHARACTER_VOICE_PRESETS[characterId];
    const userSpeed = user?.settings?.speechSpeed || 1.0;

    // ALWAYS apply each character's personality (rate/pitch) — this is what makes
    // Luna sound soft and Bro sound energetic, regardless of language
    if (preset) {
      utterance.rate = preset.rate * userSpeed;
      utterance.pitch = preset.pitch;
      utterance.volume = preset.volume;
    } else {
      utterance.rate = 0.95 * userSpeed;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
    }

    // Assign a voice only if it genuinely matches the target language
    // (never assign an English voice when speaking Japanese/Spanish/etc. — browsers reject mismatches silently)
    if (characterVoice) {
      utterance.voice = characterVoice;
      console.log(`🗣️ ${characterId} → ${characterVoice.name} (${speechCode}) rate:${utterance.rate} pitch:${utterance.pitch}`);
    } else {
      // No pre-selected voice — let browser auto-pick for the language code
      // Fallback: try any voice that matches the language
      const langConfig = getLanguageByCode(targetLangCode);
      const fallbackVoice = voices.find(v => langConfig.voiceFilter(v));
      if (fallbackVoice) {
        utterance.voice = fallbackVoice;
      }
      console.log(`🗣️ ${characterId} → browser auto (${speechCode}) rate:${utterance.rate} pitch:${utterance.pitch}`);
    }
    
    // Track which message is speaking
    if (messageId) {
      utterance.onstart = () => setSpeakingMessageId(messageId);
      utterance.onend = () => setSpeakingMessageId(null);
      utterance.onerror = () => setSpeakingMessageId(null);
    }
    
    window.speechSynthesis.speak(utterance);
  };

  // Legacy function for backward compatibility
  const speakText = (text) => {
    playCharacterVoice(selectedCharacter.id, text);
  };

  // Toggle mute/unmute
  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (!isMuted) {
      // If muting, stop any ongoing speech
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
    }
  };

  const handleSTT = () => {
    if (!recognitionSupported) {
      alert('Speech recognition is not supported in your browser.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      handleSendMessage(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        alert('Speech recognition error: ' + event.error);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch (error) {
      console.error('Failed to start recognition:', error);
      setIsListening(false);
    }
  };

  const handleTTS = () => {
    setIsTTSEnabled(!isTTSEnabled);
    if (isTTSEnabled && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const handleReplayAudio = (text) => {
    // Cancel any currently playing speech
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    // Replay the text with the current character's voice
    speakText(text);
  };

  const handleSelectMessage = (messageId) => {
    setSelectedMessageId(messageId);
    
    // Find the clicked message
    const clickedMsg = messages.find(m => m.id === messageId);
    if (!clickedMsg) return;
    
    const targetLangCode = user?.profile?.targetLanguage || 'english';
    const isTeaching = targetLangCode !== 'english';
    const targetLangName = getGeminiLanguage(targetLangCode);
    
    if (clickedMsg.sender === 'meemo' && clickedMsg.isTeachingMode) {
      // Clicked an AI teaching message - show its teaching data in panel
      const teachingCard = {
        id: `click-teach-${messageId}`,
        isVocabulary: true,
        targetLanguage: targetLangName || '',
        usage: clickedMsg.usage || '',
        formalForm: clickedMsg.formalForm || '',
        informalForm: clickedMsg.informalForm || '',
        alternatives: clickedMsg.alternatives || '',
        culturalNote: clickedMsg.culturalNote || '',
        targetLangCorrection: clickedMsg.targetLangCorrection || null,
        vocabulary: (clickedMsg.vocabulary || []).map((v, i) => ({
          id: `click-${i}`,
          word: v.word,
          romanization: v.romanization,
          meaning: v.meaning
        }))
      };
      setCorrections([teachingCard]);
    } else if (clickedMsg.sender === 'user') {
      // Clicked a user message - show its correction data
      if (isTeaching && (clickedMsg.englishCorrection || clickedMsg.targetLangCorrection)) {
        // Find the AI response right after this user message
        const msgIndex = messages.indexOf(clickedMsg);
        const nextMsg = msgIndex >= 0 && msgIndex < messages.length - 1 ? messages[msgIndex + 1] : null;
        if (nextMsg && nextMsg.sender === 'meemo' && nextMsg.isTeachingMode) {
          const teachingCard = {
            id: `click-teach-${nextMsg.id}`,
            isVocabulary: true,
            targetLanguage: targetLangName || '',
            usage: nextMsg.usage || '',
            formalForm: nextMsg.formalForm || '',
            informalForm: nextMsg.informalForm || '',
            alternatives: nextMsg.alternatives || '',
            culturalNote: nextMsg.culturalNote || '',
            targetLangCorrection: nextMsg.targetLangCorrection || null,
            vocabulary: (nextMsg.vocabulary || []).map((v, i) => ({
              id: `click-${i}`,
              word: v.word,
              romanization: v.romanization,
              meaning: v.meaning
            }))
          };
          setCorrections([teachingCard]);
        }
      } else if (clickedMsg.mistakes?.length > 0 && mode === 'chat_corrections') {
        // English mode - show this message's grammar corrections
        const correction = {
          id: `click-${messageId}`,
          original: clickedMsg.text,
          corrected: clickedMsg.corrected,
          mistakes: clickedMsg.mistakes.map((mistake, index) => ({
            id: `click-${messageId}-${index}`,
            original: mistake.originalFragment,
            corrected: mistake.correctedFragment,
            explanation: mistake.explanation
          }))
        };
        setCorrections([correction]);
      }
    }
  };

  const handlePlayMessageTTS = (message) => {
    if (!window.speechSynthesis) return;

    // If already speaking this message, stop it
    if (speakingMessageId === message.id) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }

    // Stop any currently playing speech
    window.speechSynthesis.cancel();
    setSpeakingMessageId(message.id);

    const utterance = new SpeechSynthesisUtterance(message.text);
    
    // Select voice based on message sender
    if (message.sender === 'user') {
      // Use default/English voice for user messages (user speaks in English)
      const defaultVoice = voices.find(v => v.default) || voices.find(v => v.lang.startsWith('en')) || voices[0];
      if (defaultVoice) utterance.voice = defaultVoice;
      utterance.lang = 'en-US';
    } else {
      // Use character-specific voice for AI messages (in target language)
      const targetLangCode = user?.profile?.targetLanguage || 'english';
      const speechCode = getSpeechCode(targetLangCode);
      utterance.lang = speechCode;
      
      const characterVoice = characterVoices[selectedCharacter.id];
      const preset = CHARACTER_VOICE_PRESETS[selectedCharacter.id];
      if (characterVoice) {
        utterance.voice = characterVoice;
        console.log(`Playing ${selectedCharacter.id} message with voice: ${characterVoice.name} (${speechCode})`);
      } else {
        // Fallback: find any voice for the target language
        const langConfig = getLanguageByCode(targetLangCode);
        const targetVoice = voices.find(v => langConfig.voiceFilter(v));
        if (targetVoice) {
          utterance.voice = targetVoice;
        }
      }
      // Apply character preset rate if available
      if (preset) {
        const userSpeed = user?.settings?.speechSpeed || 1.0;
        utterance.rate = preset.rate * userSpeed;
        utterance.pitch = preset.pitch;
        utterance.volume = preset.volume;
      }
    }

    // Apply user's speech speed setting if not already set
    if (!utterance.rate) {
      const userSpeed = user?.settings?.speechSpeed || 1.0;
      utterance.rate = 0.95 * userSpeed;
    }

    utterance.onend = () => {
      setSpeakingMessageId(null);
    };

    utterance.onerror = () => {
      setSpeakingMessageId(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="chat-page">
      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}
      
      {/* Correction panel overlay */}
      {isCorrectionPanelOpen && (
        <div className="correction-panel-overlay" onClick={() => setIsCorrectionPanelOpen(false)} />
      )}
      
      <div className={`chat-container ${!isSidebarOpen ? 'sidebar-closed' : ''} ${isCorrectionPanelOpen ? 'panel-open' : ''}`}>
        <button 
          className="sidebar-toggle"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          aria-label="Toggle sidebar"
        >
          {isSidebarOpen ? '✕' : '💬'}
        </button>
        
        <button 
          className="correction-panel-toggle"
          onClick={() => setIsCorrectionPanelOpen(!isCorrectionPanelOpen)}
          aria-label="Toggle corrections"
        >
          {isCorrectionPanelOpen ? '✕' : '✨'}
        </button>

        <ChatSidebar
          characters={CHARACTERS}
          characterSessions={characterSessions}
          expandedCharacter={expandedCharacter}
          currentSessionId={currentSessionId}
          selectedCharacter={selectedCharacter}
          onToggleCharacter={handleToggleCharacter}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onDeleteSession={handleDeleteSession}
          isOpen={isSidebarOpen}
          loading={loadingHistory}
          userEmail={user?.email || user?.profile?.email || null}
        />

        <ChatWindow
          character={selectedCharacter}
          characters={CHARACTERS}
          messages={messages}
          showCorrections={showCorrections}
          showGrammarTips={showGrammarTips}
          onCharacterChange={handleCharacterChange}
          onToggleCorrections={handleToggleCorrections}
          onToggleGrammarTips={handleToggleGrammarTips}
          onSendMessage={handleSendMessage}
          onSTT={handleSTT}
          onTTS={handleTTS}
          isTTSEnabled={isTTSEnabled}
          isListening={isListening}
          recognitionSupported={recognitionSupported}
          speechSynthesisSupported={speechSynthesisSupported}
          onReplayAudio={handleReplayAudio}
          selectedMessageId={selectedMessageId}
          onSelectMessage={handleSelectMessage}
          onPlayMessageTTS={handlePlayMessageTTS}
          speakingMessageId={speakingMessageId}
          isMuted={isMuted}
          onToggleMute={toggleMute}
        />

        <CorrectionPanel
          corrections={corrections}
          showCorrections={showCorrections}
          showGrammarTips={showGrammarTips}
          isOpen={isCorrectionPanelOpen}
          targetLanguage={getGeminiLanguage(user?.profile?.targetLanguage || 'english')}
        />
      </div>
    </div>
  );
}

export default ChatPage;
