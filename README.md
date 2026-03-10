<div align="center">

# 🌍 Mee-Mo: Your AI Language Companion 🤖💬

[![React](https://img.shields.io/badge/React-18.x-blue?style=for-the-badge&logo=react)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-purple?style=for-the-badge&logo=vite)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Backend-green?style=for-the-badge&logo=nodedotjs)](https://nodejs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth_&_DB-orange?style=for-the-badge&logo=firebase)](https://firebase.google.com/)
[![Gemini API](https://img.shields.io/badge/Powered_by-Google_Gemini-blueviolet?style=for-the-badge)](https://deepmind.google/technologies/gemini/)

*Fluent conversation, perfect grammar, and personalized learning—all in one place!*

<br/>

![Mee-Mo Banner](https://img.shields.io/badge/Status-Live!-success?style=for-the-badge)

</div>

<br/>

## 🎯 What is Mee-Mo?
Mee-Mo is an intelligent, full-stack language learning application designed to help you practice speaking naturally. Instead of rigid flashcards, you learn by **chatting with distinct AI personas**. 

Whether you need a strict grammar teacher or a chill friend to practice slang with, Mee-Mo adapts to your learning style in real-time!

---

## ✨ Amazing Features

### 🎭 4 Unique AI Personalities
You don't just talk to a generic robot. Choose your vibe:
- 🎓 **Mentor Mee-Mo**: A patient, professional teacher who explains grammar step-by-step.
- 🧘‍♂️ **Bro Mee-Mo**: Your casual, laid-back best friend. Talks slow, deep, and fully chill.
- 🌈 **Vibe Mee-Mo**: A chameleon! Matches *your* exact energy and personality traits.
- 🌸 **Luna Mee-Mo**: Sweet, cute, and deeply encouraging with plenty of emojis.

### 🎙️ Real-Time Voice Conversation (TTS & STT)
Talk to your AI using your actual microphone! Mee-Mo listens using Speech-to-Text and replies aloud with distinct Text-to-Speech voices tailored to each persona (Bro talks slowly, Luna sounds soft).

### 📝 Speak & Story Feedback
Practice speaking about specific topics (like "Job Interviews" or "Travel"). When you end the session, Mee-Mo gives you:
- **Fluency, Grammar, and Confidence Scores** 📊
- **Tone Analysis** (Did you sound polite? Awkward? Confident?) 🎭
- **"What you should have replied"** (Exact sentence corrections to use next time) ✍️
- **Continue Chat**: Seamlessly resume right where you left off!

### 🌍 Translate & Upgrade
Type or speak in *any* language (Spanish, Japanese, Hindi, etc.) and Mee-Mo will gracefully translate it to English while teaching you new vocabulary and cultural nuances along the way.

### 🧠 Vocabulary Fill-in-the-Blanks
Test your grammar with dynamically AI-generated fill-in-the-blank sentences matched perfectly to your skill level (Easy, Medium, Hard).

---

## 🛠️ Tech Stack

Mee-Mo is blazing fast and built with modern web technologies:

| **Frontend** | **Backend** | **Infrastructure & AI** |
|:---:|:---:|:---:|
| React 18 ⚛️ | Node.js 🟩 | Google Gemini 2.0 Flash ✨ |
| Vite ⚡ | Express 🚂 | Firebase (Auth & Firestore) 🔥 |
| CSS3 (Glassmorphism UI) 🎨 | CORS & Custom Rate Limiters 🛡️ | Vercel (Serverless Deployment) ▲ |

---

## 🚀 Getting Started (Run Locally)

Want to run Mee-Mo on your own machine? It's simple!

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/your-username/mee-mo.git
cd mee-mo
```

### 2️⃣ Install Dependencies
You need to install packages for both the frontend (React) and the backend (Node).
```bash
# Terminal 1: Setup Frontend
cd client
npm install

# Terminal 2: Setup Backend
cd server
npm install
```

### 3️⃣ Setup Environment Variables
Create a `.env` file inside the `server/` directory:
```env
GEMINI_API_KEY=your_google_ai_studio_key_here
```

### 4️⃣ Start the Engines! 🏎️
```bash
# Terminal 1: Run Backend (runs on port 5000)
cd server
npm run dev

# Terminal 2: Run Frontend (runs on port 3000)
cd client
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser!

---

## 🔒 Security & Deployment
Mee-Mo is perfectly configured for seamless one-click Vercel deployment! 
- **Serverless API Routing** built-in via `vercel.json` and `api/index.js`.
- **Firestore Rules** actively protect user chat history and session data.
- **Custom Rate-Limiter** prevents API abuse, ensuring your free-tier Gemini limits are protected.

---

<div align="center">
Made with ❤️ for language learners everywhere.
<br/>
<br/>
⭐⭐ <b>If you like Mee-Mo, don't forget to star this repository!</b> ⭐⭐
</div>
