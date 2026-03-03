import { useState, useEffect, useRef } from 'react';
import './FloatingCharacterCards.css';

const CHARACTERS = [
  {
    id: 'mentor',
    name: 'Mentor',
    fullName: 'Mentor Mee-Mo',
    tagline: 'Wise guide who explains things step-by-step.',
    description:
      'Patient, knowledgeable, and always ready to break down complex topics into bite-sized lessons. Mentor walks you through grammar, vocabulary, and pronunciation at your own pace.',
    image: '/characters/mentor.png',
    color: '#14b8a6',
  },
  {
    id: 'vibe',
    name: 'Vibe',
    fullName: 'Vibe Mee-Mo',
    tagline: 'Chill companion who matches your energy.',
    description:
      'Relaxed, supportive, and keeps the learning atmosphere fun and pressure-free. Vibe turns every conversation into a laid-back hangout where fluency comes naturally.',
    image: '/characters/vibe.png',
    color: '#d946ef',
  },
  {
    id: 'bro',
    name: 'Bro',
    fullName: 'Bro Mee-Mo',
    tagline: 'Your friendly bro who keeps you motivated.',
    description:
      'Casual, encouraging, and always hypes you up to keep going when things get tough. Bro makes sure learning never feels like a chore.',
    image: '/characters/bro.png',
    color: '#06b6d4',
  },
  {
    id: 'luna',
    name: 'Luna',
    fullName: 'Luna Mee-Mo',
    tagline: 'Creative partner who inspires ideas.',
    description:
      'Imaginative, warm, and helps you explore language through creativity and storytelling. Luna sparks your imagination while building real-world fluency.',
    image: '/characters/luna.png',
    color: '#ec4899',
  },
];

const RADIUS = 260;
const PAUSE_MS = 2800;
const ROTATE_MS = 900;

function FloatingCharacterCards() {
  const [step, setStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [typing, setTyping] = useState('');
  const typingRef = useRef(null);
  const timerRef = useRef(null);
  const touchStartX = useRef(0);

  const frontIndex = ((step % 4) + 4) % 4;
  const isOpen = selectedIndex !== null;
  const selected = isOpen ? CHARACTERS[selectedIndex] : null;

  /* ---- Auto-advance: pause → snap → pause ---- */
  useEffect(() => {
    if (isOpen) return;
    timerRef.current = setTimeout(() => {
      setIsAnimating(true);
      setStep((s) => s + 1);
      setTimeout(() => setIsAnimating(false), ROTATE_MS);
    }, PAUSE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [step, isOpen]);

  /* ---- Typing effect ---- */
  useEffect(() => {
    if (!isOpen) {
      setTyping('');
      if (typingRef.current) clearTimeout(typingRef.current);
      return;
    }
    const text = CHARACTERS[selectedIndex].description;
    let i = 0;
    setTyping('');
    const type = () => {
      if (i <= text.length) {
        setTyping(text.slice(0, i));
        i++;
        typingRef.current = setTimeout(type, 18);
      }
    };
    typingRef.current = setTimeout(type, 400);
    return () => { if (typingRef.current) clearTimeout(typingRef.current); };
  }, [selectedIndex, isOpen]);

  const handleClick = (idx) => { if (!isOpen) setSelectedIndex(idx); };
  const handleClose = () => setSelectedIndex(null);

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (isOpen || isAnimating) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) {
      setIsAnimating(true);
      setStep((s) => s + (dx < 0 ? 1 : -1));
      setTimeout(() => setIsAnimating(false), ROTATE_MS);
    }
  };

  return (
    <div className="co" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>

      {/* ====== 3D Scene ====== */}
      <div className={`co__stage ${isOpen ? 'co__stage--dimmed' : ''}`}>
        <div className="co__scene">
          {CHARACTERS.map((char, i) => {
            const angleDeg = i * 90 - step * 90;
            const rad = (angleDeg * Math.PI) / 180;
            const x = Math.sin(rad) * RADIUS;
            const z = Math.cos(rad) * RADIUS;
            const isFront = i === frontIndex && !isAnimating;

            return (
              <div
                key={char.id}
                className={`co__char ${isFront ? 'co__char--front' : ''} ${isAnimating ? 'co__char--moving' : ''}`}
                style={{
                  '--c': char.color,
                  transform: `translate3d(${Math.round(x)}px, 0px, ${Math.round(z)}px)`,
                }}
                onClick={() => handleClick(i)}
              >
                {/* 3D name BEHIND the character (pushed back in Z) */}
                <span className="co__char-bgname">{char.name}</span>

                <img
                  src={char.image}
                  alt={char.name}
                  className="co__char-img"
                  draggable="false"
                />
              </div>
            );
          })}
        </div>

        <div className="co__ground" />
      </div>

      {/* ====== Detail card overlay ====== */}
      {isOpen && (
        <div className="co__overlay" onClick={handleClose}>
          <div
            className="co__card"
            style={{ '--c': selected.color }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="co__card-ring" />
            <div className="co__card-glow" />
            <div className="co__card-shimmer" />

            <div className="co__card-img-wrap">
              <img
                src={selected.image}
                alt={selected.fullName}
                className="co__card-img"
                draggable="false"
              />
            </div>

            <h3 className="co__card-name">{selected.fullName}</h3>
            <p className="co__card-tagline">{selected.tagline}</p>
            <div className="co__card-divider" />
            <p className="co__card-desc">
              {typing}
              <span className="co__card-cursor">|</span>
            </p>

            <button className="co__card-close" onClick={handleClose} aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default FloatingCharacterCards;
