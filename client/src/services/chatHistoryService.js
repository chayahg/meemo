import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc,
  doc,
  query, 
  orderBy, 
  limit,
  serverTimestamp,
  Timestamp,
  updateDoc,
  arrayUnion
} from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';

/**
 * Chat History Service - Manages Firestore operations for session-based chat history
 * Data model: users/{userId}/characters/{characterId}/sessions/{sessionId}
 * Each session contains: characterId, title, createdAt, updatedAt, messages[]
 */

/**
 * Create a new chat session for a character
 * @param {Object} params
 * @param {string} params.userId - User ID (from Firebase Auth)
 * @param {string} params.characterId - One of: 'mentor', 'vibe', 'bro', 'luna'
 * @returns {Promise<Object>} Created session object with id
 */
export const createSession = async ({ userId, characterId }) => {
  try {
    if (!userId) {
      console.warn('No user ID provided, skipping session creation');
      return null;
    }

    const sessionsRef = collection(db, 'users', userId, 'characters', characterId, 'sessions');
    
    const sessionData = {
      characterId,
      title: 'New chat', // Will be updated after first message
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      messages: []
    };

    const docRef = await addDoc(sessionsRef, sessionData);
    
    return {
      id: docRef.id,
      ...sessionData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  } catch (error) {
    console.error('Error creating session:', error);
    throw error;
  }
};

/**
 * Load all sessions for a specific character
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @param {string} params.characterId - Character ID
 * @returns {Promise<Array>} Array of session objects, ordered by updatedAt desc
 */
export const loadCharacterSessions = async ({ userId, characterId }) => {
  try {
    if (!userId) return [];

    const sessionsRef = collection(db, 'users', userId, 'characters', characterId, 'sessions');
    const q = query(sessionsRef, orderBy('updatedAt', 'desc'));
    const snapshot = await getDocs(q);
    
    const sessions = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      sessions.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate()
      });
    });
    
    return sessions;
  } catch (error) {
    console.error('Error loading sessions:', error);
    return [];
  }
};

/**
 * Load messages for a specific session
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @param {string} params.characterId - Character ID
 * @param {string} params.sessionId - Session ID
 * @returns {Promise<Array>} Array of message objects
 */
export const loadSessionMessages = async ({ userId, characterId, sessionId }) => {
  try {
    if (!userId || !sessionId) return [];

    const sessionRef = doc(db, 'users', userId, 'characters', characterId, 'sessions', sessionId);
    const sessionDoc = await getDoc(sessionRef);
    
    if (!sessionDoc.exists()) {
      return [];
    }
    
    const data = sessionDoc.data();
    return data.messages || [];
  } catch (error) {
    console.error('Error loading session messages:', error);
    return [];
  }
};

/**
 * Append a message to an existing session
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @param {string} params.characterId - Character ID
 * @param {string} params.sessionId - Session ID
 * @param {string} params.role - 'user' or 'assistant'
 * @param {string} params.text - Message text
 * @param {string} params.mode - 'chat_only' or 'chat_corrections'
 * @param {string} [params.correctedText] - Corrected version (if corrections mode)
 * @param {Array} [params.mistakes] - Array of mistake objects
 * @param {Object} [params.teachingData] - Teaching mode data (romanization, meaning, vocabulary)
 */
export const appendMessageToSession = async ({ 
  userId, 
  characterId, 
  sessionId, 
  role, 
  text, 
  mode = 'chat_only',
  correctedText = null, 
  mistakes = [],
  teachingData = null
}) => {
  try {
    if (!userId || !sessionId) {
      console.warn('No user ID or session ID provided, skipping message append');
      return null;
    }

    const sessionRef = doc(db, 'users', userId, 'characters', characterId, 'sessions', sessionId);
    
    const messageData = {
      role,
      text,
      createdAt: new Date(),
      mode
    };

    // Only add correction fields if they exist
    if (correctedText) {
      messageData.correctedText = correctedText;
    }
    if (mistakes && mistakes.length > 0) {
      messageData.mistakes = mistakes;
    }

    // Add teaching data for foreign language messages
    if (teachingData) {
      messageData.teachingData = teachingData;
    }

    // Append message to messages array and update timestamp
    await updateDoc(sessionRef, {
      messages: arrayUnion(messageData),
      updatedAt: serverTimestamp()
    });
    
    return messageData;
  } catch (error) {
    console.error('Error appending message to session:', error);
    throw error;
  }
};

/**
 * Generate a short GPT-style title for a session based on first messages
 * @param {string} firstUserMessage - First user message
 * @param {string} firstAssistantMessage - First assistant reply
 * @returns {Promise<string>} Generated title
 */
export const generateSessionTitle = async (firstUserMessage, firstAssistantMessage) => {
  try {
    const response = await fetch('/api/generate-title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userMessage: firstUserMessage,
        assistantMessage: firstAssistantMessage
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to generate title');
    }
    
    const data = await response.json();
    return data.title || 'New chat';
  } catch (error) {
    console.error('Error generating title:', error);
    // Fallback: Use first few words of user message
    const words = firstUserMessage.split(' ').slice(0, 3).join(' ');
    return words.length > 30 ? words.substring(0, 30) + '...' : words;
  }
};

/**
 * Update session title
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @param {string} params.characterId - Character ID
 * @param {string} params.sessionId - Session ID
 * @param {string} params.title - New title
 */
export const updateSessionTitle = async ({ userId, characterId, sessionId, title }) => {
  try {
    if (!userId || !sessionId) return;

    const sessionRef = doc(db, 'users', userId, 'characters', characterId, 'sessions', sessionId);
    await updateDoc(sessionRef, { title });
  } catch (error) {
    console.error('Error updating session title:', error);
  }
};

/**
 * Load all sessions for all characters to populate sidebar
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @returns {Promise<Object>} Object with characterId as keys, array of sessions as values
 */
export const loadAllCharacterSessions = async ({ userId }) => {
  try {
    if (!userId) {
      console.warn('No user ID provided, returning empty character data');
      return {};
    }

    const characterIds = ['mentor', 'vibe', 'bro', 'luna'];
    const allSessions = {};

    // Fetch sessions for each character
    await Promise.all(
      characterIds.map(async (characterId) => {
        try {
          const sessions = await loadCharacterSessions({ userId, characterId });
          allSessions[characterId] = sessions;
        } catch (error) {
          console.error(`Error loading sessions for ${characterId}:`, error);
          allSessions[characterId] = [];
        }
      })
    );

    return allSessions;
  } catch (error) {
    console.error('Error loading all character sessions:', error);
    return {};
  }
};

/**
 * Helper to get relative time string (e.g., "2h ago", "1d ago")
 * @param {Date} date - Date object
 * @returns {string} Relative time string
 */
export const getRelativeTime = (date) => {
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

/**
 * Get current user ID from Firebase Auth
 * @returns {string|null} User ID or null if not authenticated
 */
export const getCurrentUserId = () => {
  return auth.currentUser?.uid || null;
};
