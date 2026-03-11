import { useState, useEffect, useRef } from 'react';
import { useUser } from '../contexts/UserContext';
import { getLanguageByCode, getGeminiLanguage } from '../config/languageConfig.js';
import './LearnPage.css';
import { useToast } from '../contexts/ToastContext';

function LearnPage() {
  const { user } = useUser();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('speak');
  const [showQuickTest, setShowQuickTest] = useState(false);

  // Get user's target language
  const targetLangCode = user?.profile?.targetLanguage || 'english';
  const langConfig = getLanguageByCode(targetLangCode);
  const targetLanguage = getGeminiLanguage(targetLangCode); // "English", "Japanese", "Korean", etc.
  const isEnglishMode = targetLanguage === 'English';

  return (
    <div className="learn-page">
      <div className="learn-container">
        {/* Header */}
        <div className="learn-header">
          <div>
            <h1>Level up your {targetLanguage} {langConfig.flag}</h1>
            <p className="practice-text">Practice daily with Mentor, Vibe, Bro and Luna.</p>
          </div>
        </div>

        {/* Main Tabs */}
        <div className="main-tabs">
          <button
            className={`tab-btn ${activeTab === 'speak' ? 'active' : ''}`}
            onClick={() => setActiveTab('speak')}
          >
            Speak & Story
          </button>
          <button
            className={`tab-btn ${activeTab === 'fill' ? 'active' : ''}`}
            onClick={() => setActiveTab('fill')}
          >
            Fill the blanks
          </button>
          <button
            className={`tab-btn ${activeTab === 'translate' ? 'active' : ''}`}
            onClick={() => setActiveTab('translate')}
          >
            Translate & Upgrade
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'speak' && <SpeakStoryMode targetLanguage={targetLanguage} langConfig={langConfig} />}
          {activeTab === 'fill' && <FillBlanksMode targetLanguage={targetLanguage} langConfig={langConfig} />}
          {activeTab === 'translate' && <TranslateUpgradeMode targetLanguage={targetLanguage} langConfig={langConfig} />}
        </div>

        {/* Quick Test Section - English only */}
        {targetLanguage === 'English' && (
          <>
            <div className="quick-test-section">
              <h3>Quick test</h3>
              <button className="btn-start-test" onClick={() => setShowQuickTest(true)}>
                Start 3-question test
              </button>
            </div>

            {/* Quick Test Modal */}
            {showQuickTest && <QuickTestModal onClose={() => setShowQuickTest(false)} targetLanguage={targetLanguage} langConfig={langConfig} />}
          </>
        )}
      </div>
    </div>
  );
}

// Speak & Story Mode - Realistic speaking session with real-time conversation
function SpeakStoryMode({ targetLanguage, langConfig }) {
  const { user } = useUser();
  const isEnglishMode = targetLanguage === 'English';
  // Session state
  const [difficulty, setDifficulty] = useState('easy');
  const [role, setRole] = useState('general');
  const [character, setCharacter] = useState(
    () => user?.profile?.preferredCharacter || 'mentor'
  );

  // Sync character from user profile when settings change
  useEffect(() => {
    if (user?.profile?.preferredCharacter) {
      setCharacter(user.profile.preferredCharacter);
    }
  }, [user?.profile?.preferredCharacter]);
  const [storyPrompt, setStoryPrompt] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  const [sessionSummary, setSessionSummary] = useState(null);
  const [speakingFeedback, setSpeakingFeedback] = useState(null);
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  const [allCorrections, setAllCorrections] = useState([]);
  
  // Speech state
  const [isListening, setIsListening] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzingFeedback, setAnalyzingFeedback] = useState(false);
  
  // TTS state
  const [voices, setVoices] = useState([]);
  const [characterVoices, setCharacterVoices] = useState({});
  
  const recognitionRef = useRef(null);
  const lastMessageRef = useRef(null);
  const finalTranscriptRef = useRef('');
  const [lastTurnFeedback, setLastTurnFeedback] = useState(null);

  // Initialize speech recognition
  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = langConfig?.speechCode || 'en-US';
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.maxAlternatives = 1;

      recognitionRef.current.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscriptRef.current += t;
          } else {
            interim += t;
          }
        }
        setCurrentTranscript((finalTranscriptRef.current + interim).trim());
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        // Put final text into the editable box — user reviews before sending
        const finalText = finalTranscriptRef.current.trim() || currentTranscript.trim();
        finalTranscriptRef.current = '';
        if (finalText) {
          setCurrentTranscript(finalText);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'no-speech') {
          // Silently reset — user just didn't speak
          setCurrentTranscript('');
        } else if (event.error === 'network') {
          showToast('Network error. Please check your connection.', 'error');
        }
      };
    }
  }, [currentTranscript, storyPrompt]);

  // Load TTS voices
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices);
        const voiceMap = initializeCharacterVoices(availableVoices);
        setCharacterVoices(voiceMap);
      }
    };

    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, []);

  // Helper to map voices to characters
  const initializeCharacterVoices = (availableVoices) => {
    if (availableVoices.length === 0) return {};

    const englishVoices = availableVoices.filter(v => v.lang.startsWith('en'));
    const fallbackVoices = englishVoices.length > 0 ? englishVoices : availableVoices;

    const maleVoices = fallbackVoices.filter(v => 
      v.name.toLowerCase().includes('male') && !v.name.toLowerCase().includes('female') ||
      v.name.includes('David') || v.name.includes('James') ||
      v.name.includes('Microsoft David') || v.name.includes('Google US English Male')
    );

    const femaleVoices = fallbackVoices.filter(v => 
      v.name.toLowerCase().includes('female') ||
      v.name.includes('Zira') || v.name.includes('Google UK English Female') ||
      v.name.includes('Samantha')
    );

    return {
      mentor: maleVoices[0] || fallbackVoices[0] || availableVoices[0],
      vibe: maleVoices[1] || maleVoices[0] || fallbackVoices[1] || availableVoices[0],
      bro: maleVoices[2] || maleVoices[1] || fallbackVoices[0] || availableVoices[0],
      luna: femaleVoices[0] || fallbackVoices[fallbackVoices.length - 1] || availableVoices[0]
    };
  };

  // Text-to-speech for character
  const speakText = (text, charId) => {
    if (!window.speechSynthesis || voices.length === 0) return;
    
    window.speechSynthesis.cancel(); // Stop any ongoing speech
    
    // Strip emojis so the TTS engine doesn't read them out loud
    const cleanText = text.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const characterVoice = characterVoices[charId];
    
    if (characterVoice) {
      utterance.voice = characterVoice;
    }
    
    // Apply user's speech speed setting
    const userSpeed = user?.settings?.speechSpeed || 1.0;
    utterance.rate = 0.9 * userSpeed;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    window.speechSynthesis.speak(utterance);
  };

  // Get new conversation prompt
  const getNewPrompt = async () => {
    setLoading(true);
    setSessionSummary(null);
    setConversationHistory([]);
    setCurrentTranscript('');
    setIsAnalyzed(false);
    setAllCorrections([]);
    
    try {
      const res = await fetch('/api/learn/story-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: difficulty, role, character, targetLanguage })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStoryPrompt(data.prompt);
    } catch (error) {
      console.error('Error:', error);
      showToast('Oops, Mee-Mo couldn\'t generate this. Try again.', 'error');
    }
    setLoading(false);
  };

  // Toggle mic listening
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setCurrentTranscript('');
      finalTranscriptRef.current = '';
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  // Auto-scroll to latest message when conversation updates
  useEffect(() => {
    if (conversationHistory.length > 0) {
      lastMessageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [conversationHistory]);

  // Get speaking quality feedback
  const getSpeakingQualityFeedback = async (transcript) => {
    setAnalyzingFeedback(true);
    
    try {
      const res = await fetch('/api/learn/speaking-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          role,
          coach: character,
          level: difficulty,
          targetLanguage
        })
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setSpeakingFeedback(data);
      
    } catch (error) {
      console.error('Error getting speaking feedback:', error);
      setSpeakingFeedback({
        overallSummary: 'Could not analyze this speaking turn. Please try again.',
        fluencyFeedback: '',
        sentenceEndingFeedback: '',
        confidenceFeedback: '',
        improvementTips: [],
        scores: { fluency: 0, grammar: 0, clarity: 0, confidence: 0 }
      });
    }
    
    setAnalyzingFeedback(false);
  };

  // Handle one speaking turn in the conversation
  const handleSpeakingTurn = async (transcript) => {
    if (!transcript.trim() || !storyPrompt) return;
    
    setLoading(true);
    
    try {
      const res = await fetch('/api/learn/speaking-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: difficulty,
          role,
          prompt: storyPrompt,
          transcript,
          character,
          history: conversationHistory,
          targetLanguage
        })
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      // Add turn to history
      const newTurn = {
        user: transcript,
        meeMo: data.reply,
        romanization: data.romanization || '',
        meaning: data.meaning || '',
        corrections: data.corrections || [],
        overallFeedback: data.overallFeedback,
        speakingScore: data.speakingScore,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      setConversationHistory(prev => [...prev, newTurn]);
      setCurrentTranscript('');
      
      // Accumulate corrections for feedback panel
      if (data.corrections && data.corrections.length > 0) {
        setAllCorrections(prev => [...prev, ...data.corrections]);
      }

      // Show per-turn overall feedback immediately
      if (data.overallFeedback || data.speakingScore !== undefined) {
        setLastTurnFeedback({ text: data.overallFeedback, score: data.speakingScore });
      }
      
      // Stop loading immediately so UI is responsive
      setLoading(false);
      
      // Speak the reply using TTS immediately
      speakText(data.reply, character);
      
    } catch (error) {
      console.error('Error:', error);
      showToast('Oops, Mee-Mo couldn\'t process that. Try again.', 'error');
      setLoading(false);
    }
  };

  // End session and get comprehensive summary
  const endSession = async () => {
    if (conversationHistory.length === 0) {
      showToast('Start a conversation first!', 'warning');
      return;
    }
    
    setLoading(true);
    setIsAnalyzed(true);
    
    try {
      // Get detailed speaking feedback for the entire conversation
      const allText = conversationHistory
        .map(turn => turn.user)
        .join(' ');
      
      await getSpeakingQualityFeedback(allText);
      
      // Get session summary
      const res = await fetch('/api/learn/speaking-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: difficulty,
          role,
          character,
          prompt: storyPrompt,
          history: conversationHistory,
          targetLanguage
        })
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setSessionSummary(data);
      
    } catch (error) {
      console.error('Error:', error);
      showToast('Oops, Mee-Mo couldn\'t analyze the session. Try again.', 'error');
    }
    
    setLoading(false);
  };

  return (
    <div className="speak-story-layout">
      {/* Left: Story Prompt with Role & Character Selector */}
      <div className="prompt-card">
        <h3>Conversation Setup</h3>
        
        {/* Role Selector */}
        <div className="selector-group">
          <label>I am a:</label>
          <div className="role-pills">
            {[
              { id: 'general', label: 'General' },
              { id: 'student', label: 'Student' },
              { id: 'job_seeker', label: 'Job seeker' },
              { id: 'professional', label: 'Professional' },
              { id: 'traveler', label: 'Traveler' }
            ].map(r => (
              <button
                key={r.id}
                className={`role-pill ${role === r.id ? 'active' : ''}`}
                onClick={() => setRole(r.id)}
                disabled={conversationHistory.length > 0}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Character Selector */}
        <div className="selector-group">
          <label>Coach:</label>
          <div className="character-pills">
            {['mentor', 'vibe', 'bro', 'luna'].map(char => (
              <button
                key={char}
                className={`character-pill ${character === char ? 'active' : ''}`}
                onClick={() => setCharacter(char)}
                disabled={conversationHistory.length > 0}
              >
                {char.charAt(0).toUpperCase() + char.slice(1)}
              </button>
            ))}
          </div>
        </div>
        
        <div className="prompt-controls">
          <button className="btn-new-prompt" onClick={getNewPrompt} disabled={loading}>
            {loading ? '...' : 'New conversation topic'}
          </button>
          <div className="difficulty-chips">
            {['easy', 'medium', 'hard'].map(level => (
              <button
                key={level}
                className={`chip ${difficulty === level ? 'active' : ''}`}
                onClick={() => setDifficulty(level)}
                disabled={conversationHistory.length > 0}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
        </div>
        
        {storyPrompt && (
          <div className="prompt-text">
            <strong>Topic:</strong>
            <p className="prompt-topic-text">{storyPrompt}</p>
          </div>
        )}
      </div>

      {/* Center: Conversation Area */}
      <div className="speak-card">
        <h3>Your conversation {!isEnglishMode && `(in ${targetLanguage})`}</h3>
        
        {/* Helper tip for non-English mode */}
        {!isEnglishMode && (
          <div className="lang-practice-tip">
            💡 <strong>Don't know {targetLanguage}?</strong> That's okay — reply in <strong>English</strong>! Mee-Mo will respond in {targetLanguage} with an English meaning below. You're here to learn!
          </div>
        )}
        
        {/* Chat Messages List */}
        <div className="chat-messages-list">
          {conversationHistory.length === 0 ? (
            <div className="empty-chat-state">
              <p>{storyPrompt ? 'Start speaking to begin the conversation' : 'Get a topic first, then tap the mic'}</p>
            </div>
          ) : (
            <>
              {conversationHistory.map((turn, idx) => (
                <div key={idx}>
                  {/* User Message */}
                  <div className="speak-chat-row speak-chat-user">
                    <div className="speak-bubble speak-bubble-user">
                      <div className="speak-bubble-text">{turn.user}</div>
                    </div>
                  </div>

                  {/* Mee-Mo Message */}
                  <div className="speak-chat-row speak-chat-meemo">
                    <div className="speak-bubble speak-bubble-meemo">
                      <div className="speak-bubble-text">{turn.meeMo}</div>
                      {turn.romanization && (
                        <div className="speak-bubble-romanization">🔊 {turn.romanization}</div>
                      )}
                      {turn.meaning && (
                        <div className="speak-bubble-meaning">{turn.meaning}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="speak-chat-row speak-chat-meemo">
                  <div className="speak-bubble typing-bubble">
                    <div className="typing-indicator">
                      <span className="dot"></span>
                      <span className="dot"></span>
                      <span className="dot"></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={lastMessageRef} />
            </>
          )}
        </div>
        
        {/* Mic Button - ChatGPT Style */}
        <div className="mic-button-wrapper">
          <button
            className={`mic-btn-chatgpt ${isListening ? 'listening' : ''}`}
            onClick={toggleListening}
            disabled={!storyPrompt || loading || sessionSummary}
            aria-label={isListening ? 'Stop recording' : 'Start recording'}
          >
            <svg className="mic-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </button>
          <span className="mic-label-text">{isListening ? 'Listening...' : 'Tap to speak'}</span>
        </div>
        
        {/* Live Transcript */}
        {currentTranscript && (
          <div className="live-transcript">
            <small>Review & correct before sending:</small>
            <textarea
              className="transcript-edit"
              value={currentTranscript}
              onChange={(e) => setCurrentTranscript(e.target.value)}
              rows={3}
              disabled={loading}
            />
            <div className="transcript-buttons">
              <button
                className="btn-cancel-transcript"
                onClick={() => {
                  setCurrentTranscript('');
                  if (recognitionRef.current) {
                    recognitionRef.current.stop();
                  }
                  setIsListening(false);
                }}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="btn-send-transcript"
                onClick={() => handleSpeakingTurn(currentTranscript)}
                disabled={loading || !currentTranscript.trim()}
              >
                {loading ? 'Sending...' : 'Send →'}
              </button>
            </div>
          </div>
        )}
        
        {/* End Session Button */}
        {conversationHistory.length > 0 && !sessionSummary && (
          <button
            className="btn-end-session"
            onClick={endSession}
            disabled={loading}
          >
            {loading ? 'Analyzing...' : 'End session & analyze'}
          </button>
        )}
      </div>

      {/* Right: Feedback Panel */}
      <div className="feedback-card">
        <h3>Speaking Quality Feedback</h3>
        
        {analyzingFeedback ? (
          // Loading state while analyzing
          <div className="analyzing-feedback">
            <div className="spinner"></div>
            <p>Analyzing your speaking...</p>
          </div>
        ) : conversationHistory.length > 0 || speakingFeedback || sessionSummary ? (
          // Speaking quality feedback with corrections
          <div className="speaking-quality-feedback">

            {/* Score Boxes - Show after End Session & Analyze */}
            {isAnalyzed && speakingFeedback && (
              <>
                <div className="scores-row">
                  <div className="score-badge">
                    <div className="score-value">{speakingFeedback.scores?.fluency || 0}</div>
                    <div className="score-label">Fluency</div>
                  </div>
                  <div className="score-badge">
                    <div className="score-value">{speakingFeedback.scores?.grammar || 0}</div>
                    <div className="score-label">Grammar</div>
                  </div>
                  <div className="score-badge">
                    <div className="score-value">{speakingFeedback.scores?.clarity || 0}</div>
                    <div className="score-label">Clarity</div>
                  </div>
                  <div className="score-badge">
                    <div className="score-value">{speakingFeedback.scores?.confidence || 0}</div>
                    <div className="score-label">Confidence</div>
                  </div>
                </div>

                {/* Detailed speaking feedback */}
                {speakingFeedback.overallSummary && (
                  <div className="feedback-detail-section">
                    <h4>Overview</h4>
                    <p>{speakingFeedback.overallSummary}</p>
                  </div>
                )}
                {speakingFeedback.fluencyFeedback && (
                  <div className="feedback-detail-section">
                    <h4>🗣️ Fluency</h4>
                    <p>{speakingFeedback.fluencyFeedback}</p>
                  </div>
                )}
                {speakingFeedback.sentenceEndingFeedback && (
                  <div className="feedback-detail-section">
                    <h4>✍️ Sentence Structure</h4>
                    <p>{speakingFeedback.sentenceEndingFeedback}</p>
                  </div>
                )}
                {speakingFeedback.confidenceFeedback && (
                  <div className="feedback-detail-section">
                    <h4>💪 Confidence & Tone</h4>
                    <p>{speakingFeedback.confidenceFeedback}</p>
                  </div>
                )}
                {speakingFeedback.improvementTips?.length > 0 && (
                  <div className="feedback-detail-section">
                    <h4>🎯 Tips to Improve</h4>
                    <ul className="improvement-tips-list">
                      {speakingFeedback.improvementTips.map((tip, i) => (
                        <li key={i}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {/* Live per-turn coaching note */}
            {!sessionSummary && !isAnalyzed && lastTurnFeedback && (
              <div className="live-feedback-note">
                {lastTurnFeedback.score !== undefined && lastTurnFeedback.score !== null && (
                  <span className="live-score-badge">Score: {lastTurnFeedback.score}/100</span>
                )}
                {lastTurnFeedback.text && <p>{lastTurnFeedback.text}</p>}
              </div>
            )}

            {/* Corrections Section - Visible during and after session */}
            {allCorrections.length > 0 && (
              <div className="corrections-panel">
                <h4>✏️ Corrections</h4>
                <div className="corrections-panel-list">
                  {allCorrections.map((correction, idx) => (
                    <div key={idx} className="correction-panel-item">
                      <div className="correction-panel-label">You said:</div>
                      <div className="correction-panel-original">{correction.original}</div>
                      <div className="correction-panel-label">Better & Why:</div>
                      <div className="correction-panel-corrected">{correction.corrected}</div>
                      <div className="correction-panel-explanation">{correction.explanation}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Session Summary - Show after End Session */}
            {sessionSummary && (
              <>
                <div className="summary-section">
                  <h4>📝 Session Summary</h4>
                  <p>{sessionSummary.summary}</p>
                </div>
                
                <div className="summary-section">
                  <h4>✅ Strengths</h4>
                  <ul>
                    {sessionSummary.strengths.map((s, idx) => (
                      <li key={idx}>• {s}</li>
                    ))}
                  </ul>
                </div>
                
                <div className="summary-section">
                  <h4>💡 Areas to Improve & Better Replies</h4>
                  <ul>
                    {sessionSummary.improvements.map((i, idx) => (
                      <li key={idx}>• {i}</li>
                    ))}
                  </ul>
                </div>
                
                {sessionSummary.toneAnalysis && (
                  <div className="summary-section">
                    <h4>🎭 Tone Analysis</h4>
                    <p>{sessionSummary.toneAnalysis}</p>
                  </div>
                )}
                
                <div className="summary-section">
                  <h4>🎯 Next Focus</h4>
                  <p>{sessionSummary.suggestedNextFocus}</p>
                </div>
                
                <div className="confidence-score">
                  <strong>Confidence today:</strong> {sessionSummary.confidenceScore}/100
                </div>
                
                <div className="summary-actions-row" style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                  {/* Continue Chat Button */}
                  <button
                    className="btn-continue-chat"
                    onClick={() => {
                      // Just clear the summary views to return to chat state
                      setSessionSummary(null);
                      setIsAnalyzed(false);
                      setSpeakingFeedback(null);
                      setLastTurnFeedback(null);
                      // Do NOT clear conversationHistory, storyPrompt, or allCorrections
                    }}
                    style={{ flex: 1, padding: '12px', background: 'var(--bg-card-hover)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    Continue Chat
                  </button>
                  
                  {/* Start New Conversation Button */}
                  <button
                    className="btn-new-conversation"
                    onClick={() => {
                      setSessionSummary(null);
                      setConversationHistory([]);
                      setStoryPrompt('');
                      setCurrentTranscript('');
                      setSpeakingFeedback(null);
                      setIsAnalyzed(false);
                      setAllCorrections([]);
                      setLastTurnFeedback(null);
                    }}
                    style={{ flex: 1 }}
                  >
                    New Chat
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <p className="empty-state">
            {storyPrompt ? 'Start speaking to get feedback' : 'Get a conversation topic first'}
          </p>
        )}
      </div>
    </div>
  );
}

// One random tip shown while Fill Blanks is loading
const LOADING_TIPS = [
  "💡 Reading sentences in context helps your brain absorb vocabulary faster.",
  "🧠 Short daily practice beats long weekly sessions for language learning.",
  "🗣️ Say the sentence out loud after you fill it — speaking locks memory faster.",
  "📖 Try to guess the word before looking at the options — it trains your intuition.",
  "🔊 Repeat the romanization aloud to improve your pronunciation quickly.",
  "⭐ Getting it wrong is fine — your brain remembers mistakes better than correct answers.",
  "🌍 10 minutes a day of focused practice can make you conversational in months.",
  "🎯 High-frequency words cover 80% of everyday conversation — master those first.",
  "💬 Think of the meaning before choosing — don’t just match characters.",
  "🏆 Consistency matters more than intensity. Come back tomorrow too!",
];

function LoadingTip() {
  const [tip] = useState(() => LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)]);
  return (
    <div className="loading-tip-pill">
      <span className="tip-label">Did you know?</span>
      {tip}
    </div>
  );
}

// Fill the Blanks Mode
function FillBlanksMode({ targetLanguage, langConfig }) {
  const [level, setLevel] = useState('easy');
  const [exercise, setExercise] = useState(null);
  const [userAnswers, setUserAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchExercise = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/learn/fill-blanks/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, targetLanguage })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setExercise(data);
      setUserAnswers(new Array(data.answers.length).fill(''));
    } catch (error) {
      console.error('Error:', error);
      showToast('Oops, Mee-Mo couldn\'t generate this. Try again.', 'error');
    }
    setLoading(false);
  };

  const checkAnswers = async () => {
    if (!exercise) return;

    setLoading(true);
    try {
      // For MC mode, options are "nativeScript (romanization)" — strip the romanization before sending
      const normalizedAnswers = exercise.isMultipleChoice
        ? userAnswers.map(a => a ? a.replace(/\s*\([^)]*\)\s*$/, '').trim() : '')
        : userAnswers;

      const res = await fetch('/api/learn/fill-blanks/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exerciseId: exercise.exerciseId,
          userAnswers: normalizedAnswers,
          targetLanguage
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (error) {
      console.error('Error:', error);
      showToast('Oops, Mee-Mo couldn\'t check this. Try again.', 'error');
    }
    setLoading(false);
  };

  const handleAnswerChange = (index, value) => {
    const newAnswers = [...userAnswers];
    newAnswers[index] = value;
    setUserAnswers(newAnswers);
  };

  const loadNextQuestion = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/learn/fill-blanks/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, targetLanguage })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setExercise(data);
      setUserAnswers(new Array(data.answers.length).fill(''));
    } catch (error) {
      console.error('Error:', error);
      showToast('Oops, Mee-Mo couldn\'t generate this. Try again.', 'error');
    }
    setLoading(false);
  };

  return (
    <div className="fill-blanks-layout">
      {/* Left: Level Selector */}
      <div className="level-card">
        <h3>Level</h3>
        <div className="level-buttons">
          {['easy', 'medium', 'hard'].map(lvl => (
            <button
              key={lvl}
              className={`level-btn ${level === lvl ? 'active' : ''}`}
              onClick={() => setLevel(lvl)}
            >
              {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
            </button>
          ))}
        </div>
        <button className="btn-new-exercise" onClick={fetchExercise} disabled={loading}>
          {loading ? '...' : 'New exercise'}
        </button>
      </div>

      {/* Center: Exercise */}
      <div className="exercise-card">
        <h3>Fill in the blanks {targetLanguage !== 'English' && `(${targetLanguage})`}</h3>
        {loading && (
          <div className="exercise-skeleton">
            <div className="exercise-spinner"></div>
            <div className="skeleton-line"></div>
            <div className="skeleton-line short"></div>
            <div className="skeleton-mc-options">
              <div className="skeleton-btn"></div>
              <div className="skeleton-btn"></div>
              <div className="skeleton-btn"></div>
              <div className="skeleton-btn"></div>
            </div>
            <LoadingTip />
          </div>
        )}
        {exercise && !loading && (
          <>
            {/* Sentence with blanks */}
            <div className="exercise-text">
              {exercise.textWithBlanks.split(/(_+\d+_+)/).map((part, idx) => {
                const blankMatch = part.match(/___(\d+)___/);
                if (blankMatch) {
                  const blankIndex = parseInt(blankMatch[1]) - 1;
                  const resultItem = result?.results?.[blankIndex];
                  if (exercise.isMultipleChoice) {
                    // Show selected answer as a highlighted chip, or placeholder
                    return (
                      <span
                        key={idx}
                        className={`mc-blank-slot ${
                          resultItem ? (resultItem.correct ? 'correct' : 'wrong') : (userAnswers[blankIndex] ? 'filled' : '')
                        }`}
                      >
                        {userAnswers[blankIndex] || `  ${blankIndex + 1}  `}
                      </span>
                    );
                  }
                  return (
                    <input
                      key={idx}
                      type="text"
                      className={`blank-input ${resultItem ? (resultItem.correct ? 'correct' : 'wrong') : ''}`}
                      value={userAnswers[blankIndex] || ''}
                      onChange={(e) => handleAnswerChange(blankIndex, e.target.value)}
                      disabled={!!result}
                      placeholder={`${blankIndex + 1}`}
                    />
                  );
                }
                return <span key={idx}>{part}</span>;
              })}
            </div>

            {/* Romanization + English translation */}
            {exercise.sentenceRomanization && (
              <div className="sentence-romanization">🔊 {exercise.sentenceRomanization}</div>
            )}
            {exercise.englishTranslation && (
              <div className="sentence-translation">{exercise.englishTranslation}</div>
            )}

            {/* Multiple choice options (foreign language) */}
            {exercise.isMultipleChoice && exercise.blankOptions && (
              <div className="mc-options-section">
                {exercise.blankOptions.map((options, blankIndex) => {
                  const resultItem = result?.results?.[blankIndex];
                  return (
                    <div key={blankIndex} className="mc-blank-group">
                      <div className="mc-blank-label">Blank {blankIndex + 1}:</div>
                      <div className="mc-options-row">
                        {options.map((opt, optIdx) => {
                          const isSelected = userAnswers[blankIndex] === opt;
                          const isCorrectOpt = resultItem && opt.startsWith(exercise.answers[blankIndex]);
                          return (
                            <button
                              key={optIdx}
                              className={`mc-option-btn ${isSelected ? 'selected' : ''} ${
                                resultItem ? (isCorrectOpt ? 'correct' : isSelected ? 'wrong' : 'dimmed') : ''
                              }`}
                              onClick={() => !result && handleAnswerChange(blankIndex, opt)}
                              disabled={!!result}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!result && (
              <button
                className="btn-check"
                onClick={checkAnswers}
                disabled={loading || (exercise.isMultipleChoice && userAnswers.some(a => !a))}
              >
                Check answers
              </button>
            )}
          </>
        )}
      </div>

      {/* Right: Results */}
      <div className="result-card">
        <h3>Result</h3>
        {result ? (
          <>
            <div className="score-big">
              Score: {result.score}/{result.total}
            </div>
            
            {/* Detailed per-blank feedback */}
            {result.results && (
              <div className="grammar-explanations">
                <h4>Grammar Feedback:</h4>
                {result.results.map((item, idx) => (
                  <div key={idx} className={`blank-feedback ${item.correct ? 'correct-blank' : 'wrong-blank'}`}>
                    <div className="blank-header">
                      <span className="blank-number">Blank {item.index}:</span>
                      <span className={`status-icon ${item.correct ? 'correct' : 'wrong'}`}>
                        {item.correct ? '✓' : '✗'}
                      </span>
                    </div>
                    <div className="blank-details">
                      {!item.correct && item.userAnswer && (
                        <p className="user-answer">Your answer: <em>"{item.userAnswer}"</em></p>
                      )}
                      <p className="correct-answer">Correct: <strong>{item.correctAnswer}</strong></p>
                      {item.explanation && (
                        <p className="explanation">{item.explanation}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Overall explanation */}
            {result.overallExplanation && (
              <div className="overall-explanation">
                <h4>Grammar Point:</h4>
                <p>{result.overallExplanation}</p>
              </div>
            )}

            {/* Next question button */}
            <button 
              className="btn-next-question" 
              onClick={loadNextQuestion}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Next question'}
            </button>
          </>
        ) : (
          <p className="empty-state">Check your answers to see results</p>
        )}
      </div>
    </div>
  );
}

// Quick Test Modal
function QuickTestModal({ onClose, targetLanguage, langConfig }) {
  const [testId, setTestId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [userAnswers, setUserAnswers] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTest();
  }, []);

  const fetchTest = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/learn/quick-test/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: 'medium', targetLanguage })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTestId(data.testId);
      setQuestions(data.questions || []);
      setUserAnswers(new Array(data.questions.length).fill(''));
    } catch (error) {
      console.error('Error:', error);
      showToast('Oops, Mee-Mo couldn\'t generate this. Try again.', 'error');
      onClose();
    }
    setLoading(false);
  };

  const submitTest = async () => {
    if (!testId) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/learn/quick-test/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId, userAnswers })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResults(data);
    } catch (error) {
      console.error('Error:', error);
      showToast('Oops, Mee-Mo couldn\'t check this. Try again.', 'error');
    }
    setLoading(false);
  };

  const handleAnswerSelect = (questionIdx, answer) => {
    const newAnswers = [...userAnswers];
    newAnswers[questionIdx] = answer;
    setUserAnswers(newAnswers);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        
        {loading ? (
          <p className="loading-text">Loading test...</p>
        ) : results ? (
          <div className="test-results">
            <h2>Test Complete!</h2>
            <div className="final-score">
              Score: {results.score}/{results.total}
            </div>
            <div className="feedback-message">
              {results.feedback}
            </div>
            <div className="results-details">
              {results.results.map((r, idx) => (
                <div key={idx} className={`result-item ${r.correct ? 'correct' : 'wrong'}`}>
                  <strong>Q{r.questionId}:</strong> {r.correct ? '✅ Correct' : `❌ Wrong - Answer: ${r.correctAnswer}`}
                  <br />
                  <small>You answered: {r.userAnswer}</small>
                </div>
              ))}
            </div>
            <button className="btn-done" onClick={onClose}>Done</button>
          </div>
        ) : questions.length > 0 ? (
          <div className="test-question-view">
            <h2>Quick Test</h2>
            <p className="test-instructions">Select the correct answer for each question:</p>
            
            {questions.map((q, qIdx) => (
              <div key={q.id} className="mcq-question">
                <div className="question-text">
                  <strong>{qIdx + 1}.</strong> {q.text}
                </div>
                <div className="mcq-options">
                  {q.options.map((option, optIdx) => (
                    <label 
                      key={optIdx} 
                      className={`mcq-option ${userAnswers[qIdx] === option ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name={`question-${qIdx}`}
                        value={option}
                        checked={userAnswers[qIdx] === option}
                        onChange={() => handleAnswerSelect(qIdx, option)}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            
            <button 
              className="btn-submit-test" 
              onClick={submitTest}
              disabled={loading || userAnswers.some(a => !a)}
            >
              {loading ? 'Checking...' : 'Submit Test'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Translate & Upgrade Mode
function TranslateUpgradeMode({ targetLanguage, langConfig }) {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  
  // Grouped language list for translate section
  const languageGroups = [
    {
      label: 'Popular',
      langs: [
        { name: 'English', flag: '🇬🇧' },
        { name: 'Spanish', flag: '🇪🇸' },
        { name: 'French', flag: '🇫🇷' },
        { name: 'German', flag: '🇩🇪' },
        { name: 'Japanese', flag: '🇯🇵' },
        { name: 'Korean', flag: '🇰🇷' },
      ]
    },
    {
      label: 'Indian',
      langs: [
        { name: 'Hindi', flag: '🇮🇳' },
        { name: 'Kannada', flag: '🇮🇳' },
        { name: 'Tamil', flag: '🇮🇳' },
        { name: 'Telugu', flag: '🇮🇳' },
        { name: 'Malayalam', flag: '🇮🇳' },
        { name: 'Bengali', flag: '🇮🇳' },
        { name: 'Gujarati', flag: '🇮🇳' },
        { name: 'Marathi', flag: '🇮🇳' },
        { name: 'Punjabi', flag: '🇮🇳' },
        { name: 'Urdu', flag: '🇵🇰' },
      ]
    },
    {
      label: 'European',
      langs: [
        { name: 'Italian', flag: '🇮🇹' },
        { name: 'Portuguese', flag: '🇧🇷' },
        { name: 'Russian', flag: '🇷🇺' },
        { name: 'Dutch', flag: '🇳🇱' },
        { name: 'Swedish', flag: '🇸🇪' },
        { name: 'Polish', flag: '🇵🇱' },
        { name: 'Greek', flag: '🇬🇷' },
      ]
    },
    {
      label: 'Asian & Middle East',
      langs: [
        { name: 'Chinese (Mandarin)', flag: '🇨🇳' },
        { name: 'Arabic', flag: '🇸🇦' },
        { name: 'Turkish', flag: '🇹🇷' },
        { name: 'Thai', flag: '🇹🇭' },
        { name: 'Vietnamese', flag: '🇻🇳' },
        { name: 'Indonesian', flag: '🇮🇩' },
        { name: 'Hebrew', flag: '🇮🇱' },
      ]
    }
  ];

  const [selectedTargetLang, setSelectedTargetLang] = useState(targetLanguage);
  const isEnglishMode = selectedTargetLang === 'English';
  const langPickerRef = useRef(null);
  
  // Find current flag
  const currentFlag = languageGroups.flatMap(g => g.langs).find(l => l.name === selectedTargetLang)?.flag || '🌐';
  
  const recognitionRef = useRef(null);

  // Close picker on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (langPickerRef.current && !langPickerRef.current.contains(e.target)) {
        setLangPickerOpen(false);
      }
    };
    if (langPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [langPickerOpen]);

  // Initialize speech recognition
  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.maxAlternatives = 1;

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        setError('Speech recognition failed. Please try again.');
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startListening = () => {
    if (!recognitionRef.current) {
      setError('Speech recognition is not supported in your browser.');
      return;
    }

    setError('');
    setIsListening(true);
    recognitionRef.current.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const handleTranslate = async () => {
    if (!inputText.trim()) {
      setError('Please enter or speak some text first.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/translate-upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: inputText, targetLanguage: selectedTargetLang })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Translation failed');
      }

      setResult(data);
    } catch (err) {
      console.error('Translation error:', err);
      setError(err.message || 'Failed to translate. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setInputText('');
    setResult(null);
    setError('');
  };

  return (
    <div className="translate-upgrade-mode">
      <div className="translate-header">
        <h2>{isEnglishMode ? 'Translate & Upgrade' : `Translate & Practice`}</h2>
        <p className="translate-subtitle">
          {isEnglishMode
            ? 'Type or speak in any language — get polished English translations with vocabulary tips.'
            : `Type or speak in any language — get ${selectedTargetLang} translations with vocabulary tips.`}
        </p>
        <div className="translate-lang-picker-wrap" ref={langPickerRef}>
          <button 
            className={`translate-lang-trigger ${langPickerOpen ? 'open' : ''}`}
            onClick={() => setLangPickerOpen(!langPickerOpen)}
            type="button"
          >
            <span className="lang-trigger-label">Translate to</span>
            <span className="lang-trigger-value">
              <span className="lang-trigger-flag">{currentFlag}</span>
              {selectedTargetLang}
            </span>
            <svg className="lang-trigger-arrow" width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 11L3 6h10z"/>
            </svg>
          </button>
          
          {langPickerOpen && (
            <div className="lang-picker-dropdown">
              {languageGroups.map(group => (
                <div key={group.label} className="lang-picker-group">
                  <div className="lang-picker-group-label">{group.label}</div>
                  <div className="lang-picker-grid">
                    {group.langs.map(lang => (
                      <button
                        key={lang.name}
                        className={`lang-picker-chip ${selectedTargetLang === lang.name ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedTargetLang(lang.name);
                          setResult(null);
                          setError('');
                          setLangPickerOpen(false);
                        }}
                        type="button"
                      >
                        <span className="lang-chip-flag">{lang.flag}</span>
                        <span className="lang-chip-name">{lang.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Input Section */}
      <div className="translate-input-section">
        <div className="translate-input-row">
          <div className="mic-button-wrapper">
            <button
              className={`mic-btn-chatgpt ${isListening ? 'listening' : ''}`}
              onClick={isListening ? stopListening : startListening}
              disabled={loading}
              aria-label={isListening ? 'Stop recording' : 'Start recording'}
            >
              <svg className="mic-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
            </button>
            <span className="mic-label-text">{isListening ? 'Listening...' : 'Tap to speak'}</span>
          </div>

          <div className="translate-divider-or">
            <span>or</span>
          </div>

          <div className="text-input-area">
            <textarea
              className="translate-textarea"
              placeholder="Type your text here in any language..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={loading}
              rows={3}
            />
          </div>
        </div>

        <div className="translate-actions">
          <button
            className="btn-translate"
            onClick={handleTranslate}
            disabled={loading || !inputText.trim()}
          >
            {loading ? (
              <>
                <span className="translate-spinner"></span>
                Translating...
              </>
            ) : (
              '✨ Translate & Upgrade'
            )}
          </button>
          {inputText && (
            <button
              className="btn-clear"
              onClick={handleClear}
              disabled={loading}
            >
              ✕ Clear
            </button>
          )}
        </div>

        {error && (
          <div className="translate-error">
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* Results Section */}
      {result && (
        <div className="translate-results">
          <div className="result-card original-card">
            <div className="result-header">
              <span className="result-icon">💬</span>
              <h3>You said</h3>
              <span className="detected-lang-badge">{result.detectedLanguage}</span>
            </div>
            <p className="result-text">{result.original}</p>
          </div>

          <div className="result-card direct-card">
            <div className="result-header">
              <span className="result-icon">📝</span>
              <h3>{isEnglishMode ? 'Simple Translation' : `Simple ${selectedTargetLang}`}</h3>
              <span className="level-badge">B1-B2</span>
            </div>
            <p className="result-text">{result.directEnglish}</p>
          </div>

          <div className="result-card upgraded-card">
            <div className="result-header">
              <span className="result-icon">⭐</span>
              <h3>{isEnglishMode ? 'Upgraded Version' : `Natural ${selectedTargetLang}`}</h3>
              <span className="level-badge advanced">B2-C1</span>
            </div>
            <p className="result-text upgraded-text">{result.upgradedEnglish}</p>
          </div>

          {result.vocabTips && result.vocabTips.length > 0 && (
            <div className="result-card vocab-card">
              <div className="result-header">
                <span className="result-icon">📚</span>
                <h3>Vocabulary Tips</h3>
              </div>
              <ul className="vocab-list">
                {result.vocabTips.map((tip, index) => (
                  <li key={index}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default LearnPage;
