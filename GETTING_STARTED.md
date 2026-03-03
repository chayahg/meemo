# 🚀 Quick Start Guide - Firebase Integration

## ✅ What's Been Done

Your Mee-Mo app now has:
- ✨ Settings page synced with Firebase Firestore
- 📊 Real-time XP, level, and streak tracking
- 🎯 Score tracking for grammar, speaking, listening, and vocabulary
- ⚡ Live updates across the app (no page refresh needed!)

## 🎬 Getting Started

### 1. Start the Backend Server

```bash
cd mee-mo/server
npm start
```

The server will start on **http://localhost:5000**

**Note**: You'll see a warning that Firebase Admin isn't initialized. This is OK for testing! Stats just won't save to Firestore yet. See setup instructions below to enable full stats tracking.

### 2. Start the Frontend Client

```bash
cd mee-mo/client
npm run dev
```

The client will start on **http://localhost:3000**

### 3. Test the App

1. **Login** - Go to http://localhost:3000 and login
2. **Chat** - Chat with Mee-Mo and see grammar corrections
3. **Settings** - Click Settings to see your profile and stats
4. **Change Settings** - Update your preferred character, reply style, or speech speed
5. **Save** - Click "Save changes" to sync with Firestore
6. **Check Stats** - See your XP, level, and streak update in real-time!

## 🔧 Enable Full Stats Tracking (Optional)

To enable XP and score tracking in Firestore:

### Option 1: Quick Dev Setup (5 minutes)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your "mee-mo" project
3. Go to **Project Settings** > **Service Accounts**
4. Click **"Generate new private key"**
5. Download the JSON file
6. Create `mee-mo/server/.env` file and add:

```env
GEMINI_API_KEY=your_existing_gemini_key
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"mee-mo","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
```

7. Restart the server

### Option 2: Application Default Credentials

If you have Google Cloud SDK installed:

```bash
gcloud auth application-default login
```

Then restart the server - it will auto-detect credentials.

## 🎯 Testing the Integration

### Test Settings Sync
1. Login to the app
2. Go to Settings page
3. Change your display name
4. Click "Save changes"
5. Refresh the page - your changes should persist!

### Test XP Tracking
1. Go to Chat page
2. Send a message to Mee-Mo
3. Go back to Settings page
4. Check the "Progress & Stats" section
5. You should see XP increase!

### Test Scores
1. Practice speaking in Learn mode
2. Complete a fill-in-the-blanks exercise
3. Return to Settings
4. Watch scores update in real-time ✨

## 📊 Features Overview

### Settings Page
- **Profile**: Name, email, country, level, character
- **Chat Preferences**: Grammar corrections, reply style
- **Voice Settings**: Speech speed, recognition language
- **Stats Dashboard**: Live XP, level, streak, and scores

### Real-Time Updates
- All settings changes sync to Firestore instantly
- XP and scores update without page refresh
- Streak counter increments on daily practice

### XP System
- **Chat**: 5 XP base + bonuses
- **Perfect Grammar**: +3 XP
- **Long Messages**: +2 XP (>20 words)
- **Speaking Practice**: +3 XP bonus
- **Listening Practice**: +2 XP bonus
- **Level Up**: Every 100 XP

### Streak System
- Practice daily to maintain your streak 🔥
- Streak increments on consecutive days
- Resets if you miss more than 1 day

## 🐛 Troubleshooting

### "Firebase Admin not initialized"
- This is OK! App still works, stats just won't save
- Follow "Enable Full Stats Tracking" above to fix

### "User not found in Firestore"
- Document is auto-created on first login
- Try logging out and back in

### Settings not saving
- Check browser console for errors
- Ensure you're logged in
- Check Firestore security rules (see FIREBASE_STATS_IMPLEMENTATION.md)

### Stats not updating
- Backend needs Firebase Admin credentials
- Check server logs for "✅ Updated stats for user..."
- If you see "⚠️ Stats tracking disabled", set up credentials

## 📚 More Information

- **Full Implementation Details**: See `FIREBASE_STATS_IMPLEMENTATION.md`
- **Firestore Structure**: See data model in implementation doc
- **Security Rules**: Instructions in implementation doc

## 🎉 You're All Set!

Your app now has:
- ✅ Persistent settings
- ✅ Real-time XP tracking
- ✅ Live score updates
- ✅ Daily streak counter
- ✅ Performance analytics

Start practicing and watch your stats grow! 🚀
