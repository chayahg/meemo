/**
 * Firebase Client Module
 * 
 * This module re-exports Firebase Auth and Firestore instances
 * from the main firebaseConfig for use across the app.
 */

import { auth, db } from '../firebaseConfig';

export { auth, db };
