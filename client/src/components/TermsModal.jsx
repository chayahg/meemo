import { useEffect } from 'react';
import './TermsModal.css';

function TermsModal({ isOpen, onClose }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="terms-overlay" onClick={onClose}>
      <div className="terms-modal" onClick={(e) => e.stopPropagation()}>
        <button className="terms-close" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <div className="terms-content">
          <h2 className="terms-heading">Terms &amp; Privacy Policy</h2>
          <p className="terms-date">Effective Date: March 1, 2026</p>

          <p className="terms-intro">
            Welcome to Mee-Mo. By using our platform, you agree to the following terms and privacy practices.
          </p>

          <h3>1. Platform Overview</h3>
          <p>
            Mee-Mo is an AI-powered language learning platform that provides interactive conversations, personalized feedback, and learning insights through intelligent AI mentors.
          </p>

          <h3>2. Information We Collect</h3>
          <ul>
            <li>Name and email during account registration</li>
            <li>Learning progress and activity data</li>
            <li>AI conversation history</li>
            <li>Device and usage information</li>
          </ul>

          <h3>3. How We Use Your Information</h3>
          <ul>
            <li>Personalize learning experience</li>
            <li>Improve AI responses</li>
            <li>Track progress</li>
            <li>Maintain security</li>
          </ul>
          <p>We do not sell your personal information.</p>

          <h3>4. AI-Generated Content</h3>
          <p>
            Mee-Mo uses artificial intelligence to generate responses. AI outputs may occasionally contain errors. Users are responsible for verifying important information.
          </p>

          <h3>5. Account Responsibility</h3>
          <p>
            Users are responsible for maintaining account confidentiality.
          </p>

          <h3>6. Acceptable Use</h3>
          <p>
            Users agree not to misuse the platform or engage in harmful activities.
          </p>

          <h3>7. Data Security</h3>
          <p>
            We apply reasonable security measures but cannot guarantee complete protection.
          </p>

          <h3>8. Updates</h3>
          <p>
            We may update this policy periodically. Continued use means acceptance.
          </p>

          <h3>9. Contact</h3>
          <p>
            For questions, contact: <a href="mailto:support@meemo.app" className="terms-link">support@meemo.app</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default TermsModal;
