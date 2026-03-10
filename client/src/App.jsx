import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom';
import { SettingsProvider } from './contexts/SettingsContext';
import { UserProvider, useUser } from './contexts/UserContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { LANGUAGES, getLanguageByCode } from './config/languageConfig';
import WelcomeLanguageModal from './components/WelcomeLanguageModal';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import LearnPage from './pages/LearnPage';
import SettingsPage from './pages/SettingsPage';
import './App.css';

function App() {
  return (
    <UserProvider>
      <SettingsProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </Router>
      </SettingsProvider>
    </UserProvider>
  );
}

function AppRoutes() {
  const navigate = useNavigate();
  const { user, logout, loading, switchLanguage, updateUserData } = useUser();
  const { showToast } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLanguageSwitcher, setShowLanguageSwitcher] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('meemo-theme') || 'dark');

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('meemo-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Show welcome modal on first login - MUST be before any early returns
  useEffect(() => {
    if (user && !user.profile?.hasSeenWelcome) {
      setShowWelcomeModal(true);
    }
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: 'var(--text-muted)',
        background: 'var(--body-bg)'
      }}>
        Loading...
      </div>
    );
  }

  const handleWelcomeLanguageSelect = async (languageCode) => {
    try {
      await switchLanguage(languageCode);
      // Mark welcome as seen
      await updateUserData({
        profile: {
          ...user.profile,
          hasSeenWelcome: true
        }
      });
      setShowWelcomeModal(false);
    } catch (error) {
      console.error('Error setting initial language:', error);
      setShowWelcomeModal(false);
    }
  };

  const handleWelcomeSkip = async () => {
    try {
      await updateUserData({
        profile: {
          ...user.profile,
          hasSeenWelcome: true
        }
      });
      setShowWelcomeModal(false);
    } catch (error) {
      console.error('Error skipping welcome:', error);
      setShowWelcomeModal(false);
    }
  };

  const handleQuickLanguageSwitch = async (languageCode) => {
    console.log('handleQuickLanguageSwitch called with:', languageCode);
    
    if (languageCode === user?.profile?.targetLanguage) {
      console.log('Same language, skipping');
      setShowLanguageSwitcher(false);
      return;
    }

    try {
      console.log('Calling switchLanguage...');
      await switchLanguage(languageCode);
      setShowLanguageSwitcher(false);
      console.log('Language switch successful');
    } catch (error) {
      console.error('Error in handleQuickLanguageSwitch:', error);
      showToast(`Failed to switch language: ${error.message}`, 'error');
    }
  };

  return (
    <>
      {showWelcomeModal && (
        <WelcomeLanguageModal
          onSelectLanguage={handleWelcomeLanguageSelect}
          onSkip={handleWelcomeSkip}
        />
      )}
      
      {user && (
        <nav className="app-navbar">
          <div className="nav-brand" style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <img src="/characters/logo%20meemo.png" alt="Mee-Mo" style={{height: '2.4rem', width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.4))'}} />
          </div>
          <button className="mobile-menu-toggle" onClick={toggleMobileMenu} aria-label="Toggle menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {isMobileMenuOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </>
              ) : (
                <>
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </>
              )}
            </svg>
          </button>
          <div className={`nav-links ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
            <Link to="/chat" className="nav-link" onClick={closeMobileMenu}>Chat</Link>
            <Link to="/learn" className="nav-link" onClick={closeMobileMenu}>Learn</Link>
            <Link to="/settings" className="nav-link" onClick={closeMobileMenu}>Settings</Link>
            
            {/* Theme Toggle */}
            <button 
              className="theme-toggle-btn"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line>
                  <line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              )}
            </button>

            {/* Language Switcher */}
            <div className="language-switcher-container">
              <button 
                className="language-switcher-btn"
                onClick={() => setShowLanguageSwitcher(!showLanguageSwitcher)}
                aria-label="Switch language"
              >
                <span className="language-flag-nav">
                  {getLanguageByCode(user?.profile?.targetLanguage || 'english').flag}
                </span>
              </button>
              
              {showLanguageSwitcher && (
                <>
                  <div 
                    className="language-switcher-overlay"
                    onClick={() => setShowLanguageSwitcher(false)}
                  />
                  <div className="language-switcher-dropdown">
                    <div className="language-dropdown-header">
                      Switch Language
                    </div>
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        className={`language-dropdown-item ${user?.profile?.targetLanguage === lang.code ? 'active' : ''}`}
                        onClick={() => handleQuickLanguageSwitch(lang.code)}
                      >
                        <span className="language-dropdown-flag">{lang.flag}</span>
                        <span className="language-dropdown-name">{lang.name}</span>
                        {user?.profile?.targetLanguage === lang.code && (
                          <span className="language-dropdown-check">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </nav>
      )}
      <Routes>
        <Route 
          path="/" 
          element={user ? <Navigate to="/chat" /> : <LandingPage />} 
        />
        <Route 
          path="/login" 
          element={user ? <Navigate to="/chat" /> : <LoginPage />} 
        />
        <Route 
          path="/chat" 
          element={user ? <ChatPage /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/learn" 
          element={user ? <LearnPage /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/settings" 
          element={user ? <SettingsPage /> : <Navigate to="/login" />} 
        />
      </Routes>
    </>
  );
}

export default App;
