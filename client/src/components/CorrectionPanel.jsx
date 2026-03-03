function CorrectionPanel({ corrections, showCorrections, showGrammarTips, isOpen, targetLanguage }) {
  const isTeachingMode = targetLanguage && targetLanguage !== 'English';
  const panelTitle = isTeachingMode ? `${targetLanguage} Learning` : 'Corrections & tips';

  if (!showCorrections) {
    return (
      <div className={`correction-panel ${isOpen ? 'open' : ''}`}>
        <div className="panel-header">
          <h3>{panelTitle}</h3>
        </div>
        <div className="panel-content">
          <div className="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <p>{isTeachingMode ? 'Learning panel is hidden.' : 'Grammar tips are hidden.'}</p>
            <p className="small">Turn on "Chat + corrections" to see them.</p>
          </div>
        </div>
      </div>
    );
  }

  // In teaching mode: only show the LATEST teaching card (not accumulated history)
  const latestTeachingCard = isTeachingMode ? corrections.find(c => c.isVocabulary) : null;
  const grammarCorrections = corrections.filter(c => !c.isVocabulary && !c.isPerfect);
  const perfectMessage = corrections.find(c => c.isPerfect);

  return (
    <div className={`correction-panel ${isOpen ? 'open' : ''}`}>
      <div className="panel-header">
        <h3>{panelTitle}</h3>
        {!isTeachingMode && grammarCorrections.length > 0 && (
          <span className="correction-count">{grammarCorrections.length}</span>
        )}
      </div>
      <div className="panel-content">
        {/* ===== TEACHING MODE: Single current card only ===== */}
        {isTeachingMode && (
          <>
            {!latestTeachingCard ? (
              <div className="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                </svg>
                <p>Start chatting to learn {targetLanguage}!</p>
                <p className="small">Usage tips & vocabulary will appear here.</p>
              </div>
            ) : (
              <div className="vocab-list">
                <div className="vocab-section">
                  {/* Usage context */}
                  {latestTeachingCard.usage && (
                    <div className="teaching-usage">
                      <span className="label">💬 Usage</span>
                      <p>{latestTeachingCard.usage}</p>
                    </div>
                  )}

                  {/* Formal / Informal */}
                  {(latestTeachingCard.formalForm || latestTeachingCard.informalForm) && (
                    <div className="teaching-formality">
                      {latestTeachingCard.formalForm && (
                        <div className="formality-row">
                          <span className="formality-label formal">Formal</span>
                          <span className="formality-text">{latestTeachingCard.formalForm}</span>
                        </div>
                      )}
                      {latestTeachingCard.informalForm && (
                        <div className="formality-row">
                          <span className="formality-label informal">Informal</span>
                          <span className="formality-text">{latestTeachingCard.informalForm}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Alternatives (max 2) */}
                  {latestTeachingCard.alternatives && (
                    <div className="teaching-alternatives">
                      <span className="label">🔄 Alternatives</span>
                      <p>{latestTeachingCard.alternatives}</p>
                    </div>
                  )}

                  {/* Cultural note (only if relevant) */}
                  {latestTeachingCard.culturalNote && (
                    <div className="teaching-cultural">
                      <span className="label">🌏 Cultural Note</span>
                      <p>{latestTeachingCard.culturalNote}</p>
                    </div>
                  )}

                  {/* Target language correction (if user wrote bad Korean/Japanese/etc) */}
                  {latestTeachingCard.targetLangCorrection && (
                    <div className="teaching-correction">
                      <span className="label">✏️ {latestTeachingCard.targetLanguage} Correction</span>
                      <p className="correction-wrong">❌ {latestTeachingCard.targetLangCorrection.original}</p>
                      <p className="correction-right">✅ {latestTeachingCard.targetLangCorrection.corrected}</p>
                      {latestTeachingCard.targetLangCorrection.explanation && (
                        <p className="correction-explanation-text">{latestTeachingCard.targetLangCorrection.explanation}</p>
                      )}
                    </div>
                  )}

                  {/* Vocabulary (2-3 words max) */}
                  {latestTeachingCard.vocabulary && latestTeachingCard.vocabulary.length > 0 && (
                    <div className="vocab-cards-section">
                      <span className="label">📖 Vocabulary</span>
                      {latestTeachingCard.vocabulary.map((vocab) => (
                        <div key={vocab.id} className="vocab-card">
                          <div className="vocab-word">
                            <span className="vocab-target">{vocab.word}</span>
                            {vocab.romanization && (
                              <span className="vocab-romanization">{vocab.romanization}</span>
                            )}
                          </div>
                          <div className="vocab-meaning">
                            <span className="vocab-english">{vocab.meaning}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ===== ENGLISH MODE: Grammar Corrections ===== */}
        {!isTeachingMode && (
          <>
            {perfectMessage && (
              <div className="perfect-message">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--success)' }}>
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <p style={{ color: 'var(--success)', fontWeight: '500' }}>{perfectMessage.explanation}</p>
              </div>
            )}
            
            {grammarCorrections.length === 0 && !perfectMessage ? (
              <div className="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <p>No grammar issues yet!</p>
                <p className="small">Your messages will be analyzed here.</p>
              </div>
            ) : (
              <div className="corrections-list">
                {grammarCorrections.map((correction) => (
                  <div key={correction.id} className="correction-card">
                    <div className="correction-original">
                      <span className="label">You wrote:</span>
                      <p>{correction.original}</p>
                    </div>
                    <div className="correction-arrow">→</div>
                    <div className="correction-fixed">
                      <span className="label">Better:</span>
                      <p>{correction.corrected}</p>
                    </div>
                    
                    {showGrammarTips && correction.mistakes && correction.mistakes.map((mistake, idx) => (
                      <div key={mistake.id} className="correction-explanation">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"></circle>
                          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                          <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        <div>
                          <p><strong>{mistake.original}</strong> → <strong>{mistake.corrected}</strong></p>
                          <p>{mistake.explanation}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default CorrectionPanel;
