import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebaseConfig'
import { useUser } from '../contexts/UserContext'
import TermsModal from '../components/TermsModal'
import '../App.css'
import './LandingPage.css'

function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useUser();

  // Force dark theme on login page
  useEffect(() => {
    const prev = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', 'dark');
    return () => {
      if (prev) document.documentElement.setAttribute('data-theme', prev);
    };
  }, []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isFlipped, setIsFlipped] = useState(false);
  
  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Sign up form states
  const [fullName, setFullName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Error states
  const [loginError, setLoginError] = useState('');
  const [signupError, setSignupError] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);
    
    try {
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Fetch user profile from Firestore (handled by UserContext)
      // Navigate to chat page
      navigate('/chat');
    } catch (error) {
      console.error('Login error:', error);
      
      // Handle specific error codes
      switch (error.code) {
        case 'auth/invalid-email':
          setLoginError('Invalid email address');
          break;
        case 'auth/user-disabled':
          setLoginError('This account has been disabled');
          break;
        case 'auth/user-not-found':
          setLoginError('No account found with this email');
          break;
        case 'auth/wrong-password':
          setLoginError('Incorrect password');
          break;
        case 'auth/invalid-credential':
          setLoginError('Invalid email or password');
          break;
        default:
          setLoginError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoginError('');
    
    if (!email || !email.includes('@')) {
      setLoginError('Please enter a valid email address first to reset your password.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      alert('Password reset email sent! Please check your inbox (and spam folder).');
    } catch (error) {
      console.error('Password reset error:', error);
      if (error.code === 'auth/user-not-found') {
        setLoginError('No account found with this email.');
      } else if (error.code === 'auth/invalid-email') {
        setLoginError('Invalid email address format.');
      } else {
        setLoginError('Failed to send reset email. Please try again.');
      }
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setSignupError('');
    
    // Validate passwords match
    if (createPassword !== confirmPassword) {
      setSignupError('Passwords do not match');
      return;
    }
    
    // Validate password length
    if (createPassword.length < 6) {
      setSignupError('Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    
    try {
      // Create user with Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, signupEmail, createPassword);
      const user = userCredential.user;
      
      // Create Firestore profile document
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        name: fullName,
        email: signupEmail,
        preferredCharacter: 'mentor',
        country: '',
        preferredLevel: 'beginner',
        avatarUrl: '',
        theme: 'dark',
        createdAt: serverTimestamp()
      });
      
      // Flip back to login and show success
      setIsFlipped(false);
      setSignupEmail('');
      setFullName('');
      setCreatePassword('');
      setConfirmPassword('');
      
      // Set email for login form
      setEmail(signupEmail);
      
      alert('Account created successfully! Please log in.');
    } catch (error) {
      console.error('Signup error:', error);
      
      // Handle specific error codes
      switch (error.code) {
        case 'auth/email-already-in-use':
          setSignupError('Email already in use');
          break;
        case 'auth/invalid-email':
          setSignupError('Invalid email address');
          break;
        case 'auth/weak-password':
          setSignupError('Weak password. Use at least 6 characters.');
          break;
        default:
          setSignupError('Signup failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Navigation Bar - same style as landing */}
      <nav className="landing-nav">
        <div className="nav-container">
          <div className="nav-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <img src="/characters/logo%20meemo.png" alt="Mee-Mo" className="nav-logo-img" />
          </div>
          <div className="nav-actions">
            <button onClick={() => navigate('/')} className="btn-login">Home</button>
            <button onClick={() => { navigate('/'); setTimeout(() => { const el = document.getElementById('about'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }, 300); }} className="btn-login">About</button>
          </div>
        </div>
      </nav>

      {/* Floating Orbs Background */}
      <div className="login-orbs" aria-hidden="true">
        <div className="login-orb login-orb-1"></div>
        <div className="login-orb login-orb-2"></div>
        <div className="login-orb login-orb-3"></div>
      </div>

      <div className="login-layout">
        {/* LEFT SIDE - Mee-Mo Logo */}
        <div className="login-logo-side">
          <div className="login-logo-glow">
            <img
              src="/characters/logo%20design.png"
              alt="Mee-Mo"
              className="login-meemo-logo"
              draggable="false"
            />
          </div>
          <div className="login-logo-text-group">
            <p className="login-logo-tagline">Your AI Language Companion</p>
            <div className="login-logo-divider"></div>
            <p className="login-logo-subtext">Practice. Improve. Be Confident.</p>
          </div>
          <div className="login-logo-features">
            <div className="login-logo-chip">
              <span className="chip-icon">💬</span>
              <span>AI Conversations</span>
            </div>
            <div className="login-logo-chip">
              <span className="chip-icon">🎯</span>
              <span>Instant Feedback</span>
            </div>
            <div className="login-logo-chip">
              <span className="chip-icon">🌍</span>
              <span>Learn Anywhere</span>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE - Login/Signup Flip Card */}
        <div className="login-panel">
          <div className={`flip-card-container ${isFlipped ? 'flipped' : ''}`}>
            {/* FRONT SIDE - Login */}
            <div className="flip-card-front">
              <div className="login-box">
                <h1 className="login-title">Log in</h1>
                <p className="login-subtitle">
                  Sign in to start your journey
                </p>

                <form onSubmit={handleLogin}>
                  <div className="form-group">
                    <div className="input-with-icon">
                      <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                        <polyline points="22,6 12,13 2,6"></polyline>
                      </svg>
                      <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <div className="input-with-icon">
                      <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                      <input
                        type={showPassword ? "text" : "password"}
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                      />
                      <button
                        type="button"
                        className="eye-icon"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        )}
                      </button>
                    </div>
                    <a href="#" className="forgot-link" onClick={handleForgotPassword}>Forgot password?</a>
                  </div>

                  {loginError && (
                    <div style={{
                      color: '#ff4444',
                      backgroundColor: 'rgba(255, 68, 68, 0.1)',
                      padding: '10px',
                      borderRadius: '8px',
                      marginBottom: '15px',
                      fontSize: '14px',
                      textAlign: 'center',
                      border: '1px solid rgba(255, 68, 68, 0.3)'
                    }}>
                      {loginError}
                    </div>
                  )}

                  <button type="submit" className="login-btn" disabled={loading}>
                    {loading ? 'Logging in...' : 'Log in'}
                  </button>
                </form>

                <p className="signup-text">
                  Don't have an account? <a href="#" className="signup-link" onClick={(e) => { e.preventDefault(); setIsFlipped(true); }}>Sign up</a>
                </p>
              </div>
            </div>

            {/* BACK SIDE - Sign Up */}
            <div className="flip-card-back">
              <div className="login-box">
                <h1 className="login-title">Sign up</h1>
                <p className="login-subtitle">
                  Create your account to get started
                </p>

                <form onSubmit={handleSignup}>
                  <div className="form-group">
                    <div className="input-with-icon">
                      <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                      <input
                        type="text"
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Enter your full name"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <div className="input-with-icon">
                      <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                        <polyline points="22,6 12,13 2,6"></polyline>
                      </svg>
                      <input
                        type="email"
                        id="signupEmail"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        placeholder="Enter your email"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <div className="input-with-icon">
                      <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                      <input
                        type={showCreatePassword ? "text" : "password"}
                        id="createPassword"
                        value={createPassword}
                        onChange={(e) => setCreatePassword(e.target.value)}
                        placeholder="Create a password"
                        required
                      />
                      <button
                        type="button"
                        className="eye-icon"
                        onClick={() => setShowCreatePassword(!showCreatePassword)}
                      >
                        {showCreatePassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <div className="input-with-icon">
                      <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                        <path d="M2 17l10 5 10-5M2 12l10 5 10-5"></path>
                      </svg>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        id="confirmPassword"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm your password"
                        required
                      />
                      <button
                        type="button"
                        className="eye-icon"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {signupError && (
                    <div style={{
                      color: '#ff4444',
                      backgroundColor: 'rgba(255, 68, 68, 0.1)',
                      padding: '10px',
                      borderRadius: '8px',
                      marginBottom: '15px',
                      fontSize: '14px',
                      textAlign: 'center',
                      border: '1px solid rgba(255, 68, 68, 0.3)'
                    }}>
                      {signupError}
                    </div>
                  )}

                  <label className="terms-checkbox-label">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      className="terms-checkbox"
                    />
                    <span className="terms-checkbox-text">
                      I agree to the <button type="button" className="terms-inline-link" onClick={() => setShowTerms(true)}>Terms &amp; Privacy Policy</button>
                    </span>
                  </label>

                  <button type="submit" className="login-btn" disabled={loading || !agreeTerms}>
                    {loading ? 'Creating account...' : 'Sign up'}
                  </button>
                </form>

                <p className="signup-text">
                  Already have an account? <a href="#" className="signup-link" onClick={(e) => { e.preventDefault(); setIsFlipped(false); }}>Log in</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <TermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} />
    </div>
  )
}

export default LoginPage;
