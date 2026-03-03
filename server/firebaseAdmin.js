/**
 * Firebase Admin SDK Configuration
 * 
 * This module initializes Firebase Admin SDK for server-side operations
 * like updating user stats, XP, streaks, and scores in Firestore.
 */

import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin with environment variables or service account
// For development, we can use Application Default Credentials
// For production, use a service account key file

let adminDb = null;

try {
  // Try to initialize with application default credentials
  // This works if you've set GOOGLE_APPLICATION_CREDENTIALS env var
  // or if running on Google Cloud infrastructure
  
  if (!admin.apps.length) {
    // Check if service account key is provided via environment variable
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'mee-mo'
      });
      console.log('✅ Firebase Admin initialized with service account');
    } else {
      // Fallback: Use project ID only (works with emulator or default credentials)
      admin.initializeApp({
        projectId: 'mee-mo'
      });
      console.log('✅ Firebase Admin initialized with default credentials');
    }
  }
  
  adminDb = admin.firestore();
  console.log('✅ Firestore Admin DB connected');
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin:', error.message);
  console.log('⚠️  Stats tracking will be disabled. To enable:');
  console.log('   1. Download service account key from Firebase Console');
  console.log('   2. Set FIREBASE_SERVICE_ACCOUNT env var with JSON string');
  console.log('   or set GOOGLE_APPLICATION_CREDENTIALS to path of key file');
}

/**
 * Update user stats in Firestore after a chat interaction
 * 
 * @param {string} userId - The user's Firebase UID
 * @param {object} interaction - Details about the interaction
 * @param {number} interaction.mistakesCount - Number of grammar mistakes
 * @param {number} interaction.messageLength - Length of user's message in words
 * @param {string} interaction.type - Type of interaction ('chat', 'speaking', 'listening', etc.)
 */
export async function updateUserStats(userId, interaction) {
  if (!adminDb) {
    console.warn('⚠️  Firebase Admin not initialized, skipping stats update');
    return;
  }

  try {
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.warn(`User ${userId} not found in Firestore`);
      return;
    }

    const userData = userDoc.data();
    const currentStats = userData.stats || {
      xp: 0,
      level: 1,
      dailyStreak: 0,
      lastActiveDate: null,
      totalMessages: 0,
      correctMessages: 0,
      overallScore: 0,
      grammarScore: 0,
      speakingScore: 0,
      pronunciationScore: 0,
      listeningScore: 0,
      vocabularyScore: 0
    };

    // Calculate XP for this interaction
    let baseXp = 5; // Base XP for any interaction
    
    // Bonus XP based on message quality
    if (interaction.mistakesCount === 0) {
      baseXp += 3; // Perfect grammar bonus
    }
    
    // Bonus for longer messages (more practice)
    if (interaction.messageLength > 20) {
      baseXp += 2;
    }
    
    // Different XP for different interaction types
    if (interaction.type === 'speaking') {
      baseXp += 3; // Speaking practice is valuable
    } else if (interaction.type === 'listening') {
      baseXp += 2;
    }

    const newXp = currentStats.xp + baseXp;
    const newLevel = Math.floor(newXp / 100) + 1; // Level up every 100 XP

    // Update message counts
    const newTotalMessages = currentStats.totalMessages + 1;
    const newCorrectMessages = currentStats.correctMessages + (interaction.mistakesCount === 0 ? 1 : 0);

    // Calculate grammar score (percentage of messages with no mistakes)
    const grammarScore = Math.round((newCorrectMessages / newTotalMessages) * 100);

    // Update overall score (weighted average of all scores)
    const speakingScore = currentStats.speakingScore || 0;
    const listeningScore = currentStats.listeningScore || 0;
    const vocabularyScore = currentStats.vocabularyScore || 0;
    const pronunciationScore = currentStats.pronunciationScore || 0;
    
    const overallScore = Math.round(
      (grammarScore * 0.3 + 
       speakingScore * 0.25 + 
       listeningScore * 0.2 + 
       vocabularyScore * 0.15 + 
       pronunciationScore * 0.1)
    );

    // Handle daily streak
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = admin.firestore.Timestamp.fromDate(today);
    
    let dailyStreak = currentStats.dailyStreak || 0;
    let lastActiveDate = currentStats.lastActiveDate;

    if (lastActiveDate) {
      const lastActiveDay = lastActiveDate.toDate();
      lastActiveDay.setHours(0, 0, 0, 0);
      
      const daysDiff = Math.floor((today - lastActiveDay) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 0) {
        // Same day, don't change streak
      } else if (daysDiff === 1) {
        // Consecutive day, increment streak
        dailyStreak += 1;
      } else {
        // Streak broken, reset to 1
        dailyStreak = 1;
      }
    } else {
      // First activity ever
      dailyStreak = 1;
    }

    // Update Firestore
    await userRef.update({
      'stats.xp': newXp,
      'stats.level': newLevel,
      'stats.dailyStreak': dailyStreak,
      'stats.lastActiveDate': todayTimestamp,
      'stats.totalMessages': newTotalMessages,
      'stats.correctMessages': newCorrectMessages,
      'stats.overallScore': overallScore,
      'stats.grammarScore': grammarScore
    });

    console.log(`✅ Updated stats for user ${userId}: +${baseXp} XP, Level ${newLevel}, Streak ${dailyStreak}`);
    
    return {
      xpGained: baseXp,
      newXp,
      newLevel,
      leveledUp: newLevel > currentStats.level,
      dailyStreak,
      streakIncreased: dailyStreak > currentStats.dailyStreak
    };
  } catch (error) {
    console.error('Error updating user stats:', error);
    throw error;
  }
}

/**
 * Update speaking-specific score
 */
export async function updateSpeakingScore(userId, score) {
  if (!adminDb) return;
  
  try {
    await adminDb.collection('users').doc(userId).update({
      'stats.speakingScore': score
    });
  } catch (error) {
    console.error('Error updating speaking score:', error);
  }
}

/**
 * Update listening-specific score
 */
export async function updateListeningScore(userId, score) {
  if (!adminDb) return;
  
  try {
    await adminDb.collection('users').doc(userId).update({
      'stats.listeningScore': score
    });
  } catch (error) {
    console.error('Error updating listening score:', error);
  }
}

/**
 * Update vocabulary-specific score
 */
export async function updateVocabularyScore(userId, score) {
  if (!adminDb) return;
  
  try {
    await adminDb.collection('users').doc(userId).update({
      'stats.vocabularyScore': score
    });
  } catch (error) {
    console.error('Error updating vocabulary score:', error);
  }
}

export { adminDb };
export default admin;
