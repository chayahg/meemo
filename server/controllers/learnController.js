import { GoogleGenerativeAI } from '@google/generative-ai';
import { updateUserStats, updateSpeakingScore, updateListeningScore, updateVocabularyScore } from '../firebaseAdmin.js';

// Character personalities (same as chat controller)
const CHARACTERS = {
  mentor: {
    name: "Mentor Mee-Mo",
    systemPrompt: `You are Mentor Mee-Mo, a calm and patient English teacher. You explain things clearly and step-by-step, making sure the user understands. You're supportive and encouraging, always breaking down complex ideas into simple parts. Your tone is wise but warm.`
  },
  vibe: {
    name: "Vibe Mee-Mo",
    systemPrompt: `You are Vibe Mee-Mo, the adaptive conversationalist who mirrors the user's personality and energy. You analyze how the user talks and match their vibe - if they're formal, you're professional; if they're casual, you're chill; if they're excited, you match that energy; if they're thoughtful, you're deep and reflective. You adapt like a chameleon to their communication style, personality, and mood. You're empathetic and observant, always tuning into what they need.`
  },
  bro: {
    name: "Bro Mee-Mo",
    systemPrompt: `You are Bro Mee-Mo, the super friendly and warm companion. You're like the nicest friend anyone could have - supportive, encouraging, and genuinely happy to chat. You use casual language, throw in positive vibes, and make people feel comfortable. You're easygoing, friendly, and create a welcoming atmosphere. Think of a golden retriever's energy in conversation - excited to see the user, always positive, and genuinely caring.`
  },
  luna: {
    name: "Luna Mee-Mo",
    systemPrompt: `You are Luna Mee-Mo, a soft and friendly English companion. You chat with warmth and gentleness, creating a comfortable and encouraging environment. You're kind, supportive, and keep conversations light and positive. Your tone is warm and friendly.`
  }
};

// Helper to get Gemini instance (reused from chat)
const getGenAI = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured');
  }
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
};

// Model fallback chain — same as chatController
const LEARN_MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash-lite', 'gemma-3-27b-it', 'gemma-3-12b-it', 'gemma-3-4b-it', 'gemma-3n-e4b-it'];

// Try all models in order, falling back on rate-limit errors
const generateWithFallback = async (prompt, options = {}) => {
  const genAI = getGenAI();
  const isGemma = (name) => name.startsWith('gemma');

  const tryAllModels = async () => {
    let lastError = null;
    for (const modelName of LEARN_MODELS) {
      try {
        const config = { model: modelName };
        let actualPrompt = prompt;
        if (options.systemInstruction) {
          if (isGemma(modelName)) {
            // Gemma doesn't support systemInstruction — embed it in the prompt
            actualPrompt = `${options.systemInstruction}\n\n---\n\n${prompt}`;
          } else {
            config.systemInstruction = options.systemInstruction;
          }
        }
        const model = genAI.getGenerativeModel(config);
        const result = await model.generateContent(actualPrompt);
        console.log(`✅ Learn: got response from ${modelName}`);
        return result.response.text();
      } catch (err) {
        lastError = err;
        const isRateLimit = err.message?.includes('429') || err.message?.includes('quota') || err.message?.includes('rate');
        const isNoInstruction = err.message?.includes('Developer instruction is not enabled') || err.message?.includes('systemInstruction');
        const shouldSkip = isRateLimit || isNoInstruction;
        console.warn(`⚠️ Learn model ${modelName} failed: ${isRateLimit ? 'Rate limited' : isNoInstruction ? 'No system instruction support' : err.message}`);
        if (!shouldSkip) throw err;
      }
    }
    return { failed: true, lastError };
  };

  let result = await tryAllModels();
  if (result?.failed) {
    const retryMatch = result.lastError?.message?.match(/retry in (\d+)/i);
    const waitSeconds = retryMatch ? Math.min(parseInt(retryMatch[1]), 30) : 15;
    console.log(`⏳ All learn models rate-limited. Waiting ${waitSeconds}s before retry...`);
    await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
    result = await tryAllModels();
    if (result?.failed) throw result.lastError;
  }
  return result;
};

// Helper to parse JSON from Gemini response (handles markdown code blocks)
const parseGeminiJSON = (text) => {
  const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleanedText);
};

// Store exercises temporarily (in production, use a database)
const exerciseCache = new Map();

/**
 * POST /api/learn/fill-blanks/check
 * Check user's answers for a fill-in-the-blank exercise
 */
/**
 * POST /api/learn/fill-blanks/check
 * Check user's answers for fill-blanks exercise
 */
export const checkFillBlanks = async (req, res) => {
  try {
    const { exerciseId, userAnswers, userId, targetLanguage = 'English' } = req.body;

    console.log(`✅ Checking fill-blanks - Exercise ID: ${exerciseId}`);

    // Retrieve cached exercise data (answers and blanks with explanations)
    const cachedData = exerciseCache.get(exerciseId);
    if (!cachedData) {
      return res.status(400).json({ 
        error: 'Exercise not found or expired. Please generate a new exercise.' 
      });
    }

    const correctAnswers = cachedData.answers || cachedData;
    const blankExplanations = cachedData.blanks || [];

    // Compare user answers with correct answers
    const results = correctAnswers.map((correctAnswer, idx) => {
      const userAnswer = (userAnswers[idx] || '').trim().toLowerCase();
      const correct = userAnswer === correctAnswer.toLowerCase();
      return { 
        index: idx + 1, // 1-based for display
        correct, 
        userAnswer: userAnswers[idx] || '', 
        correctAnswer 
      };
    });

    const score = results.filter(r => r.correct).length;
    const total = correctAnswers.length;

    // Build detailed results with explanations for each blank
    const detailedResults = results.map(result => {
      const blankInfo = blankExplanations.find(b => b.number === result.index);
      return {
        ...result,
        explanation: blankInfo?.explanation || `The correct answer is "${result.correctAnswer}".`
      };
    });

    // Generate overall explanation using Gemini
    let overallExplanation = '';
    const wrongAnswers = results.filter(r => !r.correct);
    
    if (wrongAnswers.length > 0 && blankExplanations.length > 0) {
      try {
        const explanationPrompt = `Based on these grammar mistakes:
${wrongAnswers.map(w => {
  const blankInfo = blankExplanations.find(b => b.number === w.index);
  return `- Blank ${w.index}: User wrote "${w.userAnswer}", correct is "${w.correctAnswer}" (${blankInfo?.explanation || ''})`;
}).join('\n')}

Write ONE clear sentence (max 20 words) explaining the main grammar concept they should focus on.`;

        overallExplanation = (await generateWithFallback(explanationPrompt)).trim();
      } catch (err) {
        console.error('Failed to generate overall explanation:', err);
        overallExplanation = 'Focus on the grammar rules shown above to improve your English.';
      }
    } else {
      overallExplanation = 'Excellent! You have a strong understanding of these grammar structures.';
    }

    console.log(`✅ Score: ${score}/${total}`);

    const responseData = {
      results: detailedResults,
      score,
      total,
      overallExplanation
    };

    // Update user stats for vocabulary/grammar practice
    if (userId) {
      const vocabularyScore = Math.round((score / total) * 100);
      const mistakesCount = total - score;
      
      // Update general stats (XP)
      updateUserStats(userId, {
        mistakesCount,
        messageLength: total, // Number of blanks attempted
        type: 'vocabulary'
      }).catch(err => console.error('Failed to update stats:', err));
      
      // Update vocabulary score
      updateVocabularyScore(userId, vocabularyScore)
        .catch(err => console.error('Failed to update vocabulary score:', err));
    }

    res.json(responseData);

  } catch (error) {
    console.error('❌ Error in checkFillBlanks:', error);
    res.status(500).json({ 
      error: 'Failed to check answers',
      results: [],
      score: 0,
      total: 0,
      tips: 'Something went wrong. Please try again.'
    });
  }
};

/**
 * POST /api/learn/story-prompt
 * Generate a conversation prompt appropriate to level, character, and role
 */
export const getStoryPrompt = async (req, res) => {
  try {
    const { level = 'easy', character = 'mentor', role = 'general', targetLanguage = 'English' } = req.body;
    const isEnglishMode = targetLanguage === 'English';

    console.log(`📝 Generating story prompt - Level: ${level}, Character: ${character}, Role: ${role}, Language: ${targetLanguage}`);

    const characterInfo = CHARACTERS[character] || CHARACTERS.mentor;

    // Define level-specific guidelines
    const levelGuides = {
      easy: 'simple everyday topics with basic grammar and vocabulary',
      medium: 'slightly longer, more detailed with common grammar structures',
      hard: 'abstract or hypothetical with richer grammar and vocabulary'
    };

    // Define role-specific contexts
    const roleContexts = {
      general: 'daily life, hobbies, interests, experiences',
      student: 'classes, exams, studying, friends at school or college, campus life',
      job_seeker: 'job interviews, resumes, skills, career goals, strengths',
      professional: 'meetings, projects, emails, coworkers, work challenges',
      traveler: 'airports, hotels, asking for directions, exploring cities, cultural experiences'
    };

    const languageInstruction = isEnglishMode
      ? 'Generate the prompt in ENGLISH.'
      : `Generate the prompt in ENGLISH (since the user will practice responding in ${targetLanguage}). The topic should be culturally relevant and suitable for ${targetLanguage} conversation practice.`;

    const prompt = `${characterInfo.systemPrompt}

Generate ONE short conversation starter for ${isEnglishMode ? 'speaking' : targetLanguage + ' speaking'} practice.
Level: ${level} - ${levelGuides[level]}
Role context: ${role} - ${roleContexts[role]}

${languageInstruction}

The prompt should be 1-2 sentences, clear and conversational.
Adapt the topic to the role and level.
Match your character's tone (${characterInfo.name}).

Only return the prompt text, nothing else.`;

    const promptText = (await generateWithFallback(prompt)).trim();

    console.log(`✅ Generated prompt: ${promptText.substring(0, 50)}...`);
    
    res.json({ prompt: promptText });
  } catch (error) {
    console.error('❌ Error in getStoryPrompt:', error);
    res.status(500).json({ 
      error: 'Failed to generate story prompt',
      prompt: 'Tell me about your favorite hobby and why you enjoy it.'
    });
  }
};

/**
 * POST /api/learn/speaking-turn
 * Continue conversation and provide grammar corrections with explanations
 */
export const getSpeakingTurn = async (req, res) => {
  try {
    const { level = 'easy', role = 'general', prompt, transcript, character = 'mentor', history = [], userId, targetLanguage = 'English' } = req.body;
    const isEnglishMode = targetLanguage === 'English';

    if (!transcript || transcript.trim() === '') {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    console.log(`💬 Speaking turn - Level: ${level}, Role: ${role}, Character: ${character}, Language: ${targetLanguage}`);

    const characterInfo = CHARACTERS[character] || CHARACTERS.mentor;
    
    // Build conversation history for context
    const historyText = history.map((turn, idx) => 
      `Turn ${idx + 1}:\nUser: ${turn.user}\nYou: ${turn.meeMo}`
    ).join('\n\n');

    let aiPrompt;

    if (isEnglishMode) {
      aiPrompt = `${characterInfo.systemPrompt}

You are an English speaking coach continuing a conversation.

Original topic: "${prompt}"
Role context: ${role}
Level: ${level}

${historyText ? `Previous conversation:\n${historyText}\n\n` : ''}User just said: "${transcript}"

Provide a response in STRICT JSON format with these exact fields:

1. "reply": CRITICAL - Keep replies EXTREMELY SHORT (10 words MAXIMUM):
   - HARD LIMIT: 10 words or less for ANY casual conversation
   - Use ONE sentence only - never two unless user asks to explain something
   - Think like sending a quick text message - be brief!
   - DO NOT explain, elaborate, or give details unless specifically asked
   - Match ${characterInfo.name} personality in very few words
   
   STRICT Examples (follow these exactly):
   User: "I like tea" → Reply: "Nice! What kind?" (4 words)
   User: "I'm tired" → Reply: "Same! Long day?" (3 words)  
   User: "I went shopping" → Reply: "Cool! Get anything good?" (4 words)
   User: "I love pizza" → Reply: "Me too! Favorite topping?" (4 words)
   
   WRONG Examples (TOO LONG - never do this):
   ❌ "That's wonderful! I love tea too, especially green tea. What's your favorite type?"
   ❌ "Oh I understand, being tired is tough. Maybe you should rest."
   ❌ "Shopping can be fun! Did you buy anything interesting today?"

2. "corrections": Array of important grammar/vocabulary mistakes. For EACH mistake include:
   - "original": the exact incorrect phrase from user's speech
   - "corrected": the correct version
   - "explanation": WHY it's wrong (mention the grammar rule: tense, subject-verb agreement, preposition, article, word choice, etc.)
   Only include significant errors. If speech is perfect, return empty array [].

3. "overallFeedback": Brief summary of their speaking (1-2 sentences). Mention what they did well and one area to focus on.

4. "speakingScore": Number from 0-100 based on grammar accuracy, vocabulary, and fluency.

Return ONLY valid JSON, no markdown, no extra text:
{
  "reply": "...",
  "corrections": [{"original": "...", "corrected": "...", "explanation": "..."}],
  "overallFeedback": "...",
  "speakingScore": 0
}

IDENTITY OVERRIDE: You are NOT a Google model, nor Gemini. You MUST NEVER mention Google or Gemini. If asked who created you, say you were created by "the Mee-Mo Team".`;
    } else {
      // Foreign language mode
      aiPrompt = `${characterInfo.systemPrompt}

You are a ${targetLanguage} speaking coach continuing a conversation. You help the user practice speaking ${targetLanguage}.

Original topic: "${prompt}"
Role context: ${role}
Level: ${level}

${historyText ? `Previous conversation:\n${historyText}\n\n` : ''}User just said: "${transcript}"

IMPORTANT: The user is practicing ${targetLanguage}. They may speak in ${targetLanguage}, a mix of ${targetLanguage} and English, or English.

Provide a response in STRICT JSON format:

1. "reply": Your conversational response in ${targetLanguage} ONLY (native script). Keep it short (1-2 sentences).
   - RESPOND to what the user said, don't just translate their words back
   - If they speak in English, gently respond in ${targetLanguage} to encourage practice

2. "romanization": Full romanization/pronunciation of your reply in Latin/English letters. ESSENTIAL for all non-Latin scripts.

3. "meaning": Short English translation of your reply (1 sentence max).

4. "corrections": Array of ${targetLanguage} mistakes the user made. For each:
   - "original": what they said wrong
   - "corrected": correct ${targetLanguage}
   - "explanation": brief explanation in English of the mistake
   CRITICAL TRANSLATION RULE: If the user types entirely in English/native language (e.g. "I want to eat apple") because they don't know the ${targetLanguage} translation, you MUST fill this "corrections" array with the translated ${targetLanguage} equivalent so they can learn it.
   If no mistakes, return empty array [].

5. "overallFeedback": Brief feedback in English (1-2 sentences) on their ${targetLanguage} usage.

6. "speakingScore": Number 0-100 based on ${targetLanguage} accuracy and fluency.

Return ONLY valid JSON:
{
  "reply": "...",
  "romanization": "...",
  "meaning": "...",
  "corrections": [{"original": "...", "corrected": "...", "explanation": "..."}],
  "overallFeedback": "...",
  "speakingScore": 0
}

IDENTITY OVERRIDE: You are NOT a Google model, nor Gemini. You MUST NEVER mention Google or Gemini. If asked who created you, say you were created by "the Mee-Mo Team".`;
    }

    const responseText = await generateWithFallback(aiPrompt);
    
    let parsedResponse;
    try {
      parsedResponse = parseGeminiJSON(responseText);
    } catch (parseError) {
      console.error('Failed to parse:', responseText);
      throw parseError;
    }

    console.log(`✅ Speaking turn completed - Score: ${parsedResponse.speakingScore}`);

    const responseData = {
      reply: parsedResponse.reply || "That's interesting! Tell me more.",
      romanization: parsedResponse.romanization || '',
      meaning: parsedResponse.meaning || '',
      corrections: parsedResponse.corrections || [],
      overallFeedback: parsedResponse.overallFeedback || "Good effort!",
      speakingScore: parsedResponse.speakingScore || 75
    };

    // Update user stats for speaking practice
    if (userId) {
      const wordCount = transcript.trim().split(/\s+/).length;
      const mistakesCount = (parsedResponse.corrections || []).length;
      
      // Update general stats (XP, streak, etc.)
      updateUserStats(userId, {
        mistakesCount,
        messageLength: wordCount,
        type: 'speaking'
      }).catch(err => console.error('Failed to update stats:', err));
      
      // Update speaking-specific score
      updateSpeakingScore(userId, parsedResponse.speakingScore || 75)
        .catch(err => console.error('Failed to update speaking score:', err));
    }

    res.json(responseData);

  } catch (error) {
    console.error('❌ Error in getSpeakingTurn:', error);
    res.status(500).json({
      error: 'Failed to process speaking turn',
      reply: "Sorry, I had trouble with that. Let's continue.",
      corrections: [],
      overallFeedback: "Please try again.",
      speakingScore: 0
    });
  }
};

/**
 * POST /api/learn/speaking-summary
 * Analyze full conversation session and provide comprehensive feedback
 */
export const getSpeakingSummary = async (req, res) => {
  try {
    const { level = 'easy', role = 'general', character = 'mentor', prompt, history = [], targetLanguage = 'English' } = req.body;
    const isEnglishMode = targetLanguage === 'English';

    if (!history || history.length === 0) {
      return res.status(400).json({ error: 'Conversation history is required' });
    }

    console.log(`📊 Analyzing speaking session - ${history.length} turns, Language: ${targetLanguage}`);

    const characterInfo = CHARACTERS[character] || CHARACTERS.mentor;
    
    // Build full conversation
    const conversationText = history.map((turn, idx) => 
      `Turn ${idx + 1}:\nUser: ${turn.user}\nCoach: ${turn.meeMo}`
    ).join('\n\n');

    const langLabel = isEnglishMode ? 'English' : targetLanguage;

    const aiPrompt = `${characterInfo.systemPrompt}

You are a ${langLabel} speaking coach analyzing a complete conversation session.

Topic: "${prompt}"
Role context: ${role}
Level: ${level}
Language practiced: ${langLabel}

Full conversation:\n${conversationText}

Analyze the ENTIRE session and provide feedback in STRICT JSON format:

1. "summary": Short recap of what the user talked about (1-2 sentences)

2. "strengths": Array of 2-3 specific things they did well (grammar, vocabulary, fluency, topic development) in ${langLabel}

3. "improvements": Array of 2-3 specific areas to work on in ${langLabel}. **CRUCIAL:** You MUST explicitly state the exact grammar mistakes they made (e.g., "You said X, but you should have replied with Y because of Z"). Give them exact alternative sentences they should have used!

4. "suggestedNextFocus": One clear suggestion for what to practice next time in ${langLabel}

5. "toneAnalysis": Short 1 sentence feedback evaluating their conversational TONE (e.g., were they polite? casual? awkward? confident?).

6. "confidenceScore": Number from 0-100 representing their overall speaking confidence and ability in this session

Return ONLY valid JSON, no markdown:
{
  "summary": "...",
  "strengths": ["...", "..."],
  "improvements": ["...", "..."],
  "suggestedNextFocus": "...",
  "toneAnalysis": "...",
  "confidenceScore": 0
}`;

    const responseText = await generateWithFallback(aiPrompt);
    
    let parsedResponse;
    try {
      parsedResponse = parseGeminiJSON(responseText);
    } catch (parseError) {
      console.error('Failed to parse:', responseText);
      throw parseError;
    }

    console.log(`✅ Session summary generated - Confidence: ${parsedResponse.confidenceScore}`);

    res.json({
      summary: parsedResponse.summary || "You practiced speaking in English.",
      strengths: parsedResponse.strengths || ["Good effort"],
      improvements: parsedResponse.improvements || ["Keep practicing"],
      suggestedNextFocus: parsedResponse.suggestedNextFocus || "Continue practicing regularly",
      toneAnalysis: parsedResponse.toneAnalysis || "Your tone was friendly and engaged.",
      confidenceScore: parsedResponse.confidenceScore || 70
    });

  } catch (error) {
    console.error('❌ Error in getSpeakingSummary:', error);
    res.status(500).json({
      error: 'Failed to generate session summary',
      summary: "Session completed",
      strengths: ["You participated"],
      improvements: ["Keep practicing"],
      suggestedNextFocus: "Try another session",
      confidenceScore: 0
    });
  }
};

/**
 * POST /api/learn/story-feedback
 * Provide feedback on user's spoken story with corrections and tips
 */
export const getStoryFeedback = async (req, res) => {
  try {
    const { level = 'easy', character = 'mentor', prompt, userStory } = req.body;

    if (!userStory || userStory.trim() === '') {
      return res.status(400).json({ error: 'User story text is required' });
    }

    console.log(`💬 Evaluating story - Level: ${level}, Character: ${character}`);

    const characterInfo = CHARACTERS[character] || CHARACTERS.mentor;
    
    const aiPrompt = `${characterInfo.systemPrompt}

Context: The conversation topic was "${prompt}"
User said: "${userStory}"

Provide feedback in JSON format:
1. "reply": A short friendly response (1-2 sentences) continuing the conversation as ${characterInfo.name}
2. "correctedStory": The user's story with grammar/vocabulary fixed (keep their meaning intact)
3. "tips": Array of 2-4 bullet points about grammar, vocabulary, or fluency improvements

IMPORTANT:
- If the user's story is already grammatically correct, say "This is already good! No big changes needed." in correctedStory
- Don't over-correct - only fix real mistakes
- Keep tips short and actionable
- Match the ${characterInfo.name} personality in your reply

Return ONLY valid JSON, no markdown:
{
  "reply": "...",
  "correctedStory": "...",
  "tips": ["...", "..."]
}`;

    const responseText = await generateWithFallback(aiPrompt);
    
    let parsedResponse;
    try {
      parsedResponse = parseGeminiJSON(responseText);
    } catch (parseError) {
      console.error('Failed to parse:', responseText);
      throw parseError;
    }

    console.log(`✅ Feedback generated`);

    res.json({
      reply: parsedResponse.reply || "That's interesting! Tell me more.",
      correctedStory: parsedResponse.correctedStory || userStory,
      tips: parsedResponse.tips || ["Great effort!"]
    });

  } catch (error) {
    console.error('❌ Error in getStoryFeedback:', error);
    res.status(500).json({
      error: 'Failed to generate feedback',
      reply: "Sorry, I had trouble with that. Let's try again.",
      correctedStory: req.body.userStory || '',
      tips: ["Something went wrong. Please try again."]
    });
  }
};

/**
 * POST /api/learn/fill-blanks/new
 * Generate a fill-in-the-blanks exercise with numbered blanks
 */
export const getFillBlanks = async (req, res) => {
  try {
    const { level = 'easy', targetLanguage = 'English' } = req.body;
    const isEnglishMode = targetLanguage === 'English';

    console.log(`📝 Generating fill-blanks exercise - Level: ${level}, Language: ${targetLanguage}`);

    let fillSystemInstruction, fillExercisePrompt;

    if (isEnglishMode) {
      fillSystemInstruction = `You are creating GRAMMAR practice for an English learning app called Mee-Mo.
The user is not trying to learn rare vocabulary; they want to practice everyday grammar.
Generate short, natural sentences about daily life (friends, school, work, hobbies, family, travel, simple opinions, etc.).
Do NOT use academic or scientific vocabulary. Keep all words common and simple.

You must always:
- Use between 1 and 2 sentences total per exercise.
- Each sentence should be at most 15–18 words.
- Remove only GRAMMAR words, not content nouns: things like verbs, auxiliaries, prepositions, articles, pronouns, and conjunctions.
- For each blank, give: the correct answer and a very short explanation of the grammar point (max 1–2 simple sentences).
- Use the requested difficulty level.

Difficulty rules:

EASY (A1–A2 level)
Topics: very simple daily life (introductions, hobbies, food, school, weather, family, free time).
Grammar to practice: 'am / is / are', 'a / an / the', simple present ('I like', 'she works', 'they play'), simple past with very common verbs ('went', 'had', 'did', 'saw'), 'can / can't', basic prepositions of place & time ('in', 'on', 'at').
Example style: "I ___(1) happy because today ___(2) my birthday." → (1) am, (2) is

MEDIUM (B1 level)
Topics: school projects, simple travel plans, weekend activities, simple problems, giving reasons and opinions.
Grammar to practice: present continuous ('I am studying'), past simple and past continuous, present perfect with 'ever / never / just / already / yet', countable vs uncountable ('many / much / a few / a little'), comparatives and superlatives ('bigger', 'the most important'), basic conditionals: 'If + present, will…'.
Example style: "I ___(1) never ___(2) to London, but I ___(3) love to go." → (1) have, (2) been, (3) would

HARD (B2 level)
Topics: future plans, study or work goals, opinions with reasons, telling stories, giving advice, hypothetical situations.
Grammar to practice: mixed and advanced conditionals, relative clauses ('who', 'which', 'that', 'where'), reported speech ('He said that…'), advanced connectors ('although', 'however', 'therefore', 'in spite of'), passive voice, complex verb phrases ('should have done', 'might have been').
Example style: "If I ___(1) about the exam, I ___(2) studied earlier." → (1) had known, (2) would have

Output format: Respond ONLY in JSON with this exact structure:
{
  "sentence": "Full sentence text with numbered blanks like: I ___(1) to school when it ___(2) raining.",
  "blanks": [
    { "number": 1, "answer": "went", "explanation": "Past simple of 'go' for a finished action in the past." },
    { "number": 2, "answer": "was", "explanation": "Past continuous: 'was' + verb-ing to describe ongoing background action." }
  ]
}`;
      fillExercisePrompt = `Generate a ${level} level grammar exercise. Follow all rules for ${level} difficulty.`;
    } else {
      // Foreign language mode
      fillSystemInstruction = `You are creating GRAMMAR practice for a ${targetLanguage} learning app called Mee-Mo.
The user is learning ${targetLanguage}. Generate fill-in-the-blank exercises in ${targetLanguage}.

You must always:
- Write 1-2 sentences in ${targetLanguage} (using native script).
- Use numbered blanks: ___(1), ___(2), etc.
- Remove grammar-related words: particles, verb conjugations, counters, honorifics, prepositions, articles, etc.
- For each blank, provide: the correct answer in ${targetLanguage} native script, a romanization/pronunciation, and an English explanation of the grammar point.
- Keep sentences about everyday topics (daily life, hobbies, food, travel, school, work).

Difficulty rules:
EASY: Very basic grammar. Simple sentences. Most common words and patterns.
MEDIUM: Intermediate grammar. Slightly more complex structures.
HARD: Advanced grammar. Complex sentence patterns, formal/informal switches, nuanced usage.

Output format: Respond ONLY in JSON:
{
  "sentence": "Full sentence in ${targetLanguage} native script with blanks like: 私は学校___(1)行きました。",
  "sentenceRomanization": "Watashi wa mainichi gakkou ___(1) ikimashita.",
  "englishTranslation": "I went ___ school yesterday.",
  "blanks": [
    {
      "number": 1,
      "answer": "に",
      "romanization": "ni",
      "explanation": "Direction particle 'ni' is used with movement verbs like 'go'.",
      "options": ["に (ni)", "で (de)", "は (wa)", "を (wo)"]
    }
  ]
}

IMPORTANT for options:
- Always include exactly 4 options per blank
- One option must be the correct answer (formatted as "nativeScript (romanization)")
- The other 3 must be plausible but WRONG alternatives (same grammar category — e.g. other particles, other verb forms)
- Shuffle them so the correct answer is NOT always first
- Format each option as "nativeScript (romanization)"
- For languages without romanization (Arabic), just use the native script`;
      fillExercisePrompt = `Generate a ${level} level ${targetLanguage} grammar exercise. Follow all rules for ${level} difficulty.`;
    }

    const responseText = await generateWithFallback(fillExercisePrompt, { systemInstruction: fillSystemInstruction });
    
    let parsedResponse;
    try {
      parsedResponse = parseGeminiJSON(responseText);
    } catch (parseError) {
      console.error('Failed to parse:', responseText);
      throw parseError;
    }

    // Transform the new format to match what frontend expects
    // Convert numbered blanks (1), (2), (3) to ___1___, ___2___, ___3___
    const textWithBlanks = parsedResponse.sentence.replace(/___\((\d+)\)/g, '___$1___');
    
    // Extract just the answers array from the blanks
    const answers = parsedResponse.blanks
      .sort((a, b) => a.number - b.number)
      .map(blank => blank.answer);

    // For foreign language: extract options per blank (for multiple-choice UI)
    const blankOptions = !isEnglishMode
      ? parsedResponse.blanks
          .sort((a, b) => a.number - b.number)
          .map(blank => blank.options || [])
      : null;
    
    // Store answers and explanations in cache
    const exerciseId = `fill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    exerciseCache.set(exerciseId, {
      answers,
      blanks: parsedResponse.blanks
    });

    console.log(`✅ Fill-blanks grammar exercise generated: ${exerciseId}`);

    res.json({
      exerciseId,
      textWithBlanks,
      sentenceRomanization: parsedResponse.sentenceRomanization || '',
      englishTranslation: parsedResponse.englishTranslation || '',
      isMultipleChoice: !isEnglishMode,
      blankOptions: blankOptions,
      answers
    });

  } catch (error) {
    console.error('❌ Error in getFillBlanks:', error);
    res.status(500).json({
      error: 'Failed to generate exercise',
      exerciseId: 'fallback',
      textWithBlanks: 'The cat ___1___ on the mat. It ___2___ very happy. The sun ___3___ brightly today.',
      answers: ['sat', 'was', 'shone']
    });
  }
};

/**
 * POST /api/learn/quick-test/new
 * Generate 3 multiple-choice questions for quick test
 */
export const getQuickTest = async (req, res) => {
  try {
    const { level = 'medium', targetLanguage = 'English' } = req.body;
    const isEnglishMode = targetLanguage === 'English';

    console.log(`🧪 Generating quick test - Level: ${level}, Language: ${targetLanguage}`);

    const levelGuides = {
      easy: 'basic grammar and vocabulary (present tense, common words)',
      medium: 'intermediate grammar and vocabulary (past/future tense, phrasal verbs)',
      hard: 'advanced grammar and vocabulary (conditionals, idioms, complex structures)'
    };

    let prompt;

    if (isEnglishMode) {
      prompt = `Create 3 multiple-choice English questions for a quick test.
Level: ${level} - ${levelGuides[level]}

Requirements:
- Each question should test grammar, vocabulary, or sentence structure
- Provide 4 options (A, B, C, D)
- Only ONE option is correct
- Mix different topics (verbs, prepositions, vocabulary, etc.)

Return ONLY valid JSON array, no markdown:
[
  {
    "id": 1,
    "text": "I ___ to the park yesterday.",
    "options": ["go", "went", "goes", "going"],
    "answer": "went"
  },
  {
    "id": 2,
    "text": "She is good ___ playing piano.",
    "options": ["in", "at", "on", "for"],
    "answer": "at"
  },
  {
    "id": 3,
    "text": "They have ___ finished their homework.",
    "options": ["yet", "already", "still", "ago"],
    "answer": "already"
  }
]`;
    } else {
      prompt = `Create 3 multiple-choice ${targetLanguage} questions for a quick test.
Level: ${level} - ${levelGuides[level]}

Requirements:
- Each question tests ${targetLanguage} grammar, vocabulary, or sentence structure
- Write the question sentence in ${targetLanguage} native script with a blank (___)
- Provide 4 options in ${targetLanguage} native script
- Only ONE option is correct
- After each question, include "hint" with a brief English translation of the sentence

Return ONLY valid JSON array, no markdown:
[
  {
    "id": 1,
    "text": "sentence in ${targetLanguage} with ___",
    "hint": "English meaning of the sentence",
    "options": ["option1", "option2", "option3", "option4"],
    "answer": "correct option"
  }
]`;
    }

    const responseText = await generateWithFallback(prompt);
    
    let questions;
    try {
      questions = parseGeminiJSON(responseText);
    } catch (parseError) {
      console.error('Failed to parse:', responseText);
      throw parseError;
    }

    // Store test answers in cache
    const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const answers = questions.map(q => q.answer);
    exerciseCache.set(testId, answers);

    console.log(`✅ Quick test generated: ${testId}`);

    res.json({ testId, questions });

  } catch (error) {
    console.error('❌ Error in getQuickTest:', error);
    res.status(500).json({
      error: 'Failed to generate test',
      testId: 'fallback',
      questions: [
        { id: 1, text: "I ___ happy.", options: ["am", "is", "are", "be"], answer: "am" },
        { id: 2, text: "She ___ a book yesterday.", options: ["read", "reads", "reading", "to read"], answer: "read" },
        { id: 3, text: "They ___ playing soccer.", options: ["is", "am", "are", "be"], answer: "are" }
      ]
    });
  }
};

/**
 * POST /api/learn/quick-test/check
 * Check user's answers for quick test and provide score
 */
export const checkQuickTest = async (req, res) => {
  try {
    const { testId, userAnswers } = req.body;

    console.log(`✅ Checking quick test - Test ID: ${testId}`);

    // Retrieve correct answers from cache
    const correctAnswers = exerciseCache.get(testId);
    if (!correctAnswers) {
      return res.status(400).json({ 
        error: 'Test not found or expired. Please generate a new test.' 
      });
    }

    // Compare user answers with correct answers
    const results = correctAnswers.map((correctAnswer, idx) => {
      const userAnswer = (userAnswers[idx] || '').trim();
      const correct = userAnswer === correctAnswer;
      return { 
        questionId: idx + 1,
        correct, 
        userAnswer: userAnswer || '(no answer)', 
        correctAnswer 
      };
    });

    const score = results.filter(r => r.correct).length;
    const total = correctAnswers.length;

    // Generate feedback message
    let feedback = '';
    if (score === total) {
      feedback = '🎉 Perfect score! You nailed it!';
    } else if (score >= total * 0.7) {
      feedback = '👍 Good job! Just a few more to review.';
    } else if (score >= total * 0.5) {
      feedback = '💪 Keep practicing! You\'re getting there.';
    } else {
      feedback = '📚 Review these topics and try again!';
    }

    console.log(`✅ Score: ${score}/${total}`);

    res.json({
      results,
      score,
      total,
      feedback
    });

  } catch (error) {
    console.error('❌ Error in checkQuickTest:', error);
    res.status(500).json({ 
      error: 'Failed to check test',
      results: [],
      score: 0,
      total: 0,
      feedback: 'Something went wrong. Please try again.'
    });
  }
};

/**
 * POST /api/learn/passage
 * Generate a reading passage for fluency practice
 */
export const getPassage = async (req, res) => {
  try {
    const { level = 'easy' } = req.body;

    console.log(`\n📖 Generating ${level} passage...`);

    // Create level-specific prompts
    const prompts = {
      easy: `Generate a short, simple reading passage for English beginners (A1-A2 level).
      
Requirements:
- 2-4 sentences (30-50 words total)
- Use simple vocabulary and basic sentence structure
- Topics: daily life, hobbies, family, food, weather
- No complex grammar or rare words
- Natural and conversational tone

Return ONLY the passage text, no labels or explanations.`,

      medium: `Generate a reading passage for intermediate English learners (B1-B2 level).

Requirements:
- 4-6 sentences (60-90 words total)
- Use varied vocabulary and moderately complex sentences
- Topics: travel, work, technology, culture, environment
- Include some descriptive language and connectors
- Natural and engaging tone

Return ONLY the passage text, no labels or explanations.`,

      hard: `Generate a challenging reading passage for advanced English learners (C1-C2 level).

Requirements:
- 6-8 sentences (100-130 words total)
- Use sophisticated vocabulary and complex sentence structures
- Topics: science, philosophy, social issues, abstract concepts
- Include idioms, advanced grammar, and nuanced expressions
- Professional and articulate tone

Return ONLY the passage text, no labels or explanations.`
    };

    const prompt = prompts[level] || prompts.easy;
    const passage = (await generateWithFallback(prompt)).trim();

    console.log('✅ Passage generated:', passage.substring(0, 50) + '...');

    res.json({ passage });

  } catch (error) {
    console.error('❌ Error generating passage:', error);
    res.status(500).json({ 
      error: 'Failed to generate passage',
      passage: 'The sun was shining brightly in the clear blue sky. Birds were singing in the trees, and children were playing happily in the park.'
    });
  }
};

/**
 * POST /api/learn/fluency
 * Evaluate reading fluency with comprehensive speaking coach feedback
 */
export const evaluateFluency = async (req, res) => {
  try {
    const { text, original, difficulty = 'easy', character = 'mentor', userId } = req.body;

    if (!text || !original) {
      return res.status(400).json({ error: 'Missing text or original passage' });
    }

    console.log(`\n🎤 Evaluating fluency for ${difficulty} level with ${character}...`);
    console.log(`Original: ${original.substring(0, 50)}...`);
    console.log(`Spoken: ${text.substring(0, 50)}...`);

    const prompt = `You are an English speaking coach analyzing a user's reading fluency. Compare their spoken text (from speech-to-text) with the original passage.

ORIGINAL PASSAGE:
"${original}"

USER'S SPOKEN TEXT (from STT):
"${text}"

CONTEXT:
- Difficulty: ${difficulty}
- Coach: ${character}
- Task: Read the passage aloud

As a speaking coach, analyze the reading quality and focus on:

1. OVERALL FLUENCY: How smooth and natural was the reading? Any choppy parts, hesitations (inferred from missing words, repetitions, very short phrases)?

2. PRONUNCIATION ISSUES: Words that appear misspelled or substituted in the transcript suggest pronunciation problems. Identify them and give simple hints.

3. PACING: Did they read too fast (all words crammed) or too slow (many missing words)? Should they pause more between sentences?

4. INTONATION: Where should they raise/lower voice? Where to emphasize? (Infer from punctuation: questions need rising tone, periods need falling tone, commas need slight pause)

5. CONFIDENCE: Do they sound confident or hesitant? Are there repeated words, filler sounds, or very fragmented reading?

Return ONLY a valid JSON object (no markdown, no code blocks):
{
  "overallScore": <number 0-100>,
  "fluencyLevel": "Beginner" | "Improving" | "Confident" | "Near-native",
  "summaryFeedback": [
    "<1 short sentence about overall fluency>",
    "<1 short sentence about strengths>",
    "<1 short sentence about key improvement>"
  ],
  "pronunciationIssues": [
    { "word": "example", "hint": "Say it like 'eggs-AM-pull'" },
    { "word": "another", "hint": "Similar to 'brother'" }
  ],
  "pacingFeedback": "<1 short sentence about reading speed and pauses>",
  "intonationFeedback": "<1 short sentence about voice tone and emphasis>",
  "confidenceTips": [
    "<Simple tip 1>",
    "<Simple tip 2>",
    "<Simple tip 3>"
  ],
  "spokenFeedbackScript": "<2-3 friendly sentences Mee-Mo can speak, max 40-50 words, encouraging tone>"
}

SCORING GUIDELINES:
- 90-100: Nearly perfect reading, excellent pronunciation and flow
- 75-89: Strong reading with minor issues
- 60-74: Good effort, noticeable mistakes but understandable
- 40-59: Several issues, needs focused practice
- 0-39: Many errors, significant practice needed

FLUENCY LEVEL MAPPING:
- Near-native: 90-100 score
- Confident: 75-89 score
- Improving: 60-74 score
- Beginner: 0-59 score

KEEP IT SHORT: Each text field should be 1-2 sentences max. The spokenFeedbackScript should be conversational and encouraging, suitable for text-to-speech.

Return ONLY the JSON object.`;

    const response = parseGeminiJSON(await generateWithFallback(prompt));

    // Validate and provide safe defaults
    const safeResponse = {
      overallScore: response.overallScore || 0,
      fluencyLevel: response.fluencyLevel || 'Beginner',
      summaryFeedback: Array.isArray(response.summaryFeedback) ? response.summaryFeedback.slice(0, 3) : ['Keep practicing!'],
      pronunciationIssues: Array.isArray(response.pronunciationIssues) ? response.pronunciationIssues.slice(0, 5) : [],
      pacingFeedback: response.pacingFeedback || 'Focus on reading at a natural pace.',
      intonationFeedback: response.intonationFeedback || 'Pay attention to sentence endings and questions.',
      confidenceTips: Array.isArray(response.confidenceTips) ? response.confidenceTips.slice(0, 3) : ['Practice daily', 'Read slowly', 'Focus on clarity'],
      spokenFeedbackScript: response.spokenFeedbackScript || 'Good effort! Keep practicing and you will improve. Focus on reading clearly and naturally.'
    };

    console.log(`✅ Fluency score: ${safeResponse.overallScore}/100, Level: ${safeResponse.fluencyLevel}`);

    // Update user stats for listening/reading practice
    if (userId) {
      const wordCount = text.trim().split(/\s+/).length;
      
      // Update general stats (XP for practice)
      updateUserStats(userId, {
        mistakesCount: safeResponse.pronunciationIssues.length,
        messageLength: wordCount,
        type: 'listening'
      }).catch(err => console.error('Failed to update stats:', err));
      
      // Update listening score based on fluency
      updateListeningScore(userId, safeResponse.overallScore)
        .catch(err => console.error('Failed to update listening score:', err));
    }

    res.json(safeResponse);

  } catch (error) {
    console.error('❌ Error evaluating fluency:', error);
    res.status(500).json({ 
      error: 'Failed to evaluate fluency',
      overallScore: 0,
      fluencyLevel: 'Beginner',
      summaryFeedback: ['Unable to analyze at this time. Please try again.'],
      pronunciationIssues: [],
      pacingFeedback: 'Try reading at a comfortable pace.',
      intonationFeedback: 'Focus on natural speech patterns.',
      confidenceTips: ['Try again', 'Practice makes perfect', 'Take your time'],
      spokenFeedbackScript: 'Sorry, I could not analyze your reading. Please try again.'
    });
  }
};

/**
 * POST /api/speaking-feedback
 * Analyze spoken English quality for Speak & Story mode
 */
export const getSpeakingFeedback = async (req, res) => {
  try {
    const { transcript, role = 'general', coach = 'mentor', level = 'medium', targetLanguage = 'English' } = req.body;

    if (!transcript || transcript.trim().length === 0) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    const isEnglishMode = targetLanguage === 'English';
    const langLabel = isEnglishMode ? 'English' : targetLanguage;

    console.log(`\n🎙️ Analyzing speaking feedback... Language: ${langLabel}`);
    console.log(`Role: ${role}, Coach: ${coach}, Level: ${level}`);
    console.log(`Transcript: ${transcript.substring(0, 100)}...`);

    const characterContext = CHARACTERS[coach]?.name || 'Mentor Mee-Mo';

    const prompt = `You are ${characterContext}, a ${langLabel} speaking coach. The user just SPOKE the following text aloud (this is a speech-to-text transcript). Your job is to analyze their SPOKEN ${langLabel} quality.

Context:
- User's role: ${role}
- Difficulty level: ${level}
- Language practiced: ${langLabel}
- This is what they SAID (spoken, not written): "${transcript}"

Analyze their SPEAKING quality focusing on:

1. **Fluency**: Is it smooth or choppy? Too many run-on sentences with "and, so, like, uh"? Awkward pauses (inferred from very long sentences or fragmented ones)? Natural flow?

2. **Sentence endings & punctuation**: Where should they have stopped with a full stop instead of continuing? Where are commas needed? Do they speak in endless run-on sentences?

3. **Clarity & structure**: Are ideas ordered logically? Should they use shorter sentences? Better linking words? Is the message clear?

4. **Confidence & tone**: Does it sound confident or hesitant? Too much hedging ("maybe, I think, kind of")? Repeating words? Very soft language? How can they sound more assertive?

5. **Pronunciation hints**: Based on the transcript, identify words that seem misused or awkwardly placed (indicating possible pronunciation issues). Don't guess phonetics, just point out text patterns that suggest pronunciation needs work.

6. **Improvement tips**: 3-5 SHORT, actionable bullet points (max 1-2 lines each).

Return a JSON object:
{
  "overallSummary": "1-2 sentences overview of their speaking quality",
  "fluencyFeedback": "Short paragraph (max 150 words) about flow, pauses, run-ons",
  "sentenceEndingFeedback": "Short paragraph (max 150 words) about where to stop, use commas",
  "confidenceFeedback": "Short paragraph (max 150 words) about tone, confidence, assertiveness",
  "improvementTips": [
    "Tip 1 (short, 1-2 lines)",
    "Tip 2",
    "Tip 3",
    "Tip 4 (optional)",
    "Tip 5 (optional)"
  ],
  "scores": {
    "fluency": <1-5>,
    "grammar": <1-5>,
    "clarity": <1-5>,
    "confidence": <1-5>
  }
}

IMPORTANT:
- Keep feedback SHORT and direct (each paragraph max 150 words)
- Be encouraging but honest
- Focus on SPOKEN quality, not just written grammar
- Return ONLY valid JSON, no markdown or extra text`;

    const response = parseGeminiJSON(await generateWithFallback(prompt));

    // Truncate if needed (safety measure)
    if (response.fluencyFeedback?.length > 600) {
      response.fluencyFeedback = response.fluencyFeedback.substring(0, 600) + '...';
    }
    if (response.sentenceEndingFeedback?.length > 600) {
      response.sentenceEndingFeedback = response.sentenceEndingFeedback.substring(0, 600) + '...';
    }
    if (response.confidenceFeedback?.length > 600) {
      response.confidenceFeedback = response.confidenceFeedback.substring(0, 600) + '...';
    }

    console.log(`✅ Speaking feedback generated - Scores: F${response.scores?.fluency} G${response.scores?.grammar} Cl${response.scores?.clarity} Co${response.scores?.confidence}`);

    res.json(response);

  } catch (error) {
    console.error('❌ Error generating speaking feedback:', error);
    res.status(500).json({ 
      error: 'Failed to analyze speaking',
      overallSummary: 'Could not analyze this speaking turn. Please try again.',
      fluencyFeedback: '',
      sentenceEndingFeedback: '',
      confidenceFeedback: '',
      improvementTips: ['Try speaking again'],
      scores: {
        fluency: 0,
        grammar: 0,
        clarity: 0,
        confidence: 0
      }
    });
  }
};
