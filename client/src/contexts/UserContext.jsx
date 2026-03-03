import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { DEFAULT_LANGUAGE } from '../config/languageConfig';

const UserContext = createContext();

// Default user data structure
const getDefaultUserData = (uid, email) => ({
  uid,
  email,
  profile: {
    displayName: email?.split('@')[0] || 'User',
    email: email || '',
    country: '',
    preferredLevel: 'Beginner',
    preferredCharacter: 'mentor',
    avatarUrl: '',
    theme: 'dark',
    targetLanguage: DEFAULT_LANGUAGE, // New: current learning language
    hasSeenWelcome: false // New: track if user saw welcome modal
  },
  settings: {
    replyStyle: 'normal',
    speechSpeed: 1.0,
    showGrammar: true,
    showDetailedRules: false,
    autoTranslate: false,
    recognitionLanguage: 'English only',
    speakingMode: 'press-to-talk'
  },
  stats: {
    overallScore: 0,
    grammarScore: 0,
    speakingScore: 0,
    pronunciationScore: 0,
    listeningScore: 0,
    vocabularyScore: 0,
    xp: 0,
    level: 1,
    dailyStreak: 0,
    lastActiveDate: null,
    totalMessages: 0,
    correctMessages: 0
  },
  languageStats: {} // New: per-language stats { english: {...stats}, spanish: {...stats} }
});

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeSnapshot = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in - set up real-time listener
        const userDocRef = doc(db, 'users', firebaseUser.uid);

        // First check if document exists, if not create it
        try {
          const userDoc = await getDoc(userDocRef);
          if (!userDoc.exists()) {
            // Create initial document with defaults
            const defaultData = getDefaultUserData(firebaseUser.uid, firebaseUser.email);
            await setDoc(userDocRef, {
              profile: defaultData.profile,
              settings: defaultData.settings,
              stats: defaultData.stats
            });
          }
        } catch (error) {
          console.error('Error initializing user document:', error);
        }

        // Subscribe to real-time updates
        unsubscribeSnapshot = onSnapshot(userDocRef, (docSnapshot) => {
          if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            const defaults = getDefaultUserData(firebaseUser.uid, firebaseUser.email);
            
            // Merge with defaults to ensure all fields exist
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              profile: { ...defaults.profile, ...data.profile },
              settings: { ...defaults.settings, ...data.settings },
              stats: { ...defaults.stats, ...data.stats },
              languageStats: data.languageStats || {}
            });
          } else {
            // Fallback if document somehow doesn't exist
            setUser(getDefaultUserData(firebaseUser.uid, firebaseUser.email));
          }
          setLoading(false);
        }, (error) => {
          console.error('Error listening to user document:', error);
          setUser(getDefaultUserData(firebaseUser.uid, firebaseUser.email));
          setLoading(false);
        });
      } else {
        // User is signed out
        setUser(null);
        setLoading(false);
      }
    });

    // Cleanup subscriptions
    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Error logging out:', error);
      throw error;
    }
  };

  // Update user profile or settings
  const updateUserData = async (updates) => {
    if (!user?.uid) {
      throw new Error('No user logged in');
    }

    try {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, updates, { merge: true });
      // The onSnapshot listener will automatically update the local state
      return true;
    } catch (error) {
      console.error('Error updating user data:', error);
      throw error;
    }
  };

  // Switch learning language and load corresponding stats
  const switchLanguage = async (languageCode) => {
    console.log('switchLanguage called with:', languageCode);
    console.log('Current user:', user);
    
    if (!user?.uid) {
      console.error('No user logged in');
      throw new Error('No user logged in');
    }

    try {
      const userDocRef = doc(db, 'users', user.uid);
      
      // Save current language stats before switching
      const currentLang = user.profile?.targetLanguage || 'english';
      console.log('Current language:', currentLang, '-> New language:', languageCode);
      
      const updatedLanguageStats = {
        ...(user.languageStats || {}),
        [currentLang]: user.stats || getDefaultUserData(user.uid, user.email).stats
      };

      // Get stats for new language (or create defaults)
      const newLangStats = updatedLanguageStats[languageCode] || getDefaultUserData(user.uid, user.email).stats;

      const updateData = {
        profile: {
          ...user.profile,
          targetLanguage: languageCode
        },
        stats: newLangStats,
        languageStats: updatedLanguageStats
      };
      
      console.log('Updating Firestore with:', updateData);

      await setDoc(userDocRef, updateData, { merge: true });

      console.log('Language switched successfully!');
      return true;
    } catch (error) {
      console.error('Error switching language - Full error:', error);
      console.error('Error message:', error.message);
      console.error('Error code:', error.code);
      throw error;
    }
  };

  const value = {
    user,
    setUser,
    logout,
    loading,
    updateUserData,
    switchLanguage
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
