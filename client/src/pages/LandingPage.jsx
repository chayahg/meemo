import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FloatingCharacterCards from '../components/FloatingCharacterCards';
import TermsModal from '../components/TermsModal';
import './LandingPage.css';

function LandingPage() {
  const navigate = useNavigate();
  const [showTerms, setShowTerms] = useState(false);

  // Force dark theme on landing page
  useEffect(() => {
    const prev = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', 'dark');
    return () => {
      if (prev) document.documentElement.setAttribute('data-theme', prev);
    };
  }, []);

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="landing-page">
      {/* Navigation Bar */}
      <nav className="landing-nav">
        <div className="nav-container">
          <div className="nav-logo">
            <img src="/characters/logo%20meemo.png" alt="Mee-Mo" className="nav-logo-img" />
          </div>
          <div className="nav-links">
            <button onClick={() => scrollToSection('hero')} className="nav-link">Home</button>
            <button onClick={() => scrollToSection('how-it-works')} className="nav-link">How it works</button>
            <button onClick={() => scrollToSection('about')} className="nav-link">About</button>
          </div>
          <div className="nav-actions">
            <button onClick={() => navigate('/login')} className="btn-login">Log in</button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="hero" className="hero-section">
        <div className="hero-container">
          <div className="hero-content">
            <h1 className="hero-title">
              Confidence Is a Language. Learn It.
            </h1>
            <p className="hero-subtitle">
              Break language barriers. Connect with people. Build confidence anywhere you go.
            </p>
            <div className="hero-buttons">
              <button onClick={() => navigate('/login')} className="btn-primary">
                Start Exploring
              </button>
            </div>
          </div>
          <div className="hero-image">
            <FloatingCharacterCards />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="how-section">
        <div className="how-container">
          <h2 className="section-title">How Mee-Mo Works</h2>
          <div className="how-steps">
            <div className="step">
              <div className="step-number">1</div>
              <h3>Pick Your Mentor</h3>
              <p>Choose an AI personality that fits your vibe.</p>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <h3>Speak Freely</h3>
              <p>Practice real conversations in any supported language.</p>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <h3>Improve Instantly</h3>
              <p>Get smart corrections and clear guidance.</p>
            </div>
            <div className="step">
              <div className="step-number">4</div>
              <h3>Grow Confidently</h3>
              <p>Track your progress and unlock achievements.</p>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="about-section">
        <div className="about-container">
          <h2 className="section-title">About Mee-Mo</h2>
          <p className="about-text">
            Mee-Mo is your personal AI language companion, built to help you speak confidently in any language you choose. Whether you're starting from scratch or refining your fluency, our intelligent AI mentors adapt to your level and guide you through real-world conversations that feel natural and practical.
          </p>
          <p className="about-text">
            Designed for modern learners, Mee-Mo goes beyond memorizing vocabulary. It helps you build confidence, think in a new language, and connect effortlessly across cultures.
          </p>
          <p className="about-text">
            Say goodbye to passive learning and hello to interactive, personalized experiences that grow with you.
          </p>
          <p className="about-text about-text-highlight">
            Start speaking. Start connecting.
          </p>
          <button onClick={() => navigate('/login')} className="btn-primary">
            Get Started Today
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-container">
          <div className="footer-logo">
            <img src="/characters/logo%20meemo.png" alt="Mee-Mo" className="footer-logo-img" />
          </div>
          <div className="footer-links">
            <button className="footer-link" onClick={() => setShowTerms(true)}>Terms &amp; Privacy Policy</button>
            <span className="footer-divider">|</span>
            <a href="mailto:support@meemo.app" className="footer-link">Contact</a>
          </div>
          <p className="footer-text">© 2026 Mee-Mo. All rights reserved.</p>
        </div>
      </footer>

      <TermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} />
    </div>
  );
}

export default LandingPage;
