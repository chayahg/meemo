function ChatSidebar({ 
  characters, 
  characterSessions, 
  expandedCharacter, 
  currentSessionId,
  selectedCharacter,
  onToggleCharacter,
  onSelectSession, 
  onNewChat,
  onDeleteSession,
  isOpen, 
  loading,
  userEmail 
}) {
  
  const handleDeleteClick = (e, charId, sessionId) => {
    e.stopPropagation();
    onDeleteSession(charId, sessionId);
  };
  
  // Get character display name (e.g., "Mentor" from "Mentor Mee-Mo")
  const getCharacterDisplayName = (characterName) => {
    return characterName.replace(' Mee-Mo', '');
  };

  // Get session preview text
  const getSessionPreview = (session) => {
    // Try to get first user message from the messages array (if loaded)
    if (session.messages && session.messages.length > 0) {
      const firstUserMsg = session.messages.find(m => m.role === 'user');
      if (firstUserMsg) {
        return firstUserMsg.text.length > 35 
          ? firstUserMsg.text.substring(0, 35) + '...' 
          : firstUserMsg.text;
      }
    }
    // Fallback: use the session title as preview
    if (session.title && session.title !== 'New chat') {
      return session.title;
    }
    return 'New conversation';
  };

  // Format timestamp
  const getRelativeTime = (date) => {
    if (!date) return '';
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className={`chat-sidebar ${isOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-header">
        <h2>Chats</h2>
      </div>

      <div className="conversations-list">
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--accent-primary)', opacity: 0.7 }}>
            Loading chats...
          </div>
        ) : expandedCharacter ? (
          // Show expanded character's sessions with back button
          (() => {
            const char = characters.find(c => c.id === expandedCharacter);
            const sessions = characterSessions[expandedCharacter] || [];
            if (!char) return null;
            return (
              <div className="character-sessions-view">
                <div className="sessions-header">
                  <button className="back-btn" onClick={() => onToggleCharacter(null)}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                      <polyline points="15 18 9 12 15 6"/>
                    </svg>
                  </button>
                  <img 
                    src={char.avatar} 
                    alt={char.name}
                    className="character-avatar-header"
                    onError={(e) => {
                      e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="40" fill="%238b5cf6"/%3E%3C/svg%3E';
                    }}
                  />
                  <h3>{getCharacterDisplayName(char.name)}</h3>
                </div>

                <button 
                  className="new-session-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNewChat(char.id);
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  New chat
                </button>

                <div className="sessions-list">
                  {sessions.length === 0 ? (
                    <div className="no-sessions">No chats yet. Start a new one!</div>
                  ) : (
                    sessions.map((session) => (
                      <div 
                        key={session.id} 
                        className={`session-row ${currentSessionId === session.id ? 'active' : ''}`}
                        onClick={() => onSelectSession(char.id, session.id)}
                      >
                        <div className="session-content">
                          <div className="session-title">{session.title}</div>
                          <div className="session-preview">{getSessionPreview(session)}</div>
                          <div className="session-time">{getRelativeTime(session.updatedAt)}</div>
                        </div>
                        <button 
                          className="delete-btn"
                          onClick={(e) => handleDeleteClick(e, char.id, session.id)}
                          title="Delete chat"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })()
        ) : (
          // Default: show all 4 simple character cards
          characters.map((char) => (
            <div 
              key={char.id} 
              className={`character-card ${selectedCharacter?.id === char.id ? 'active' : ''}`}
              onClick={() => onToggleCharacter(char.id)}
            >
              <img 
                src={char.avatar} 
                alt={char.name}
                className="character-avatar"
                onError={(e) => {
                  e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="40" fill="%238b5cf6"/%3E%3C/svg%3E';
                }}
              />
              <div className="character-info">
                <h3>{getCharacterDisplayName(char.name)}</h3>
              </div>
            </div>
          ))
        )}
      </div>

      {userEmail && (
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <span>{userEmail}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatSidebar;
