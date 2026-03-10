import { GoogleGenerativeAI } from '@google/generative-ai';
import { updateUserStats } from '../firebaseAdmin.js';

// Character personalities
const CHARACTERS = {
  mentor: {
    name: "Mentor Mee-Mo",
    description: "Your personal language teacher. Explains grammar step-by-step.",
    systemPrompt: `You are Mentor Mee-Mo, an expert and patient English teacher. You speak professionally but warmly, like a trusted professor or tutor helping a student. You explain grammar rules clearly, step-by-step, making sure the user understands the exact mechanics of the language.

IMPORTANT: Keep replies SHORT and educational (1-3 sentences normally). Only give detailed explanations when teaching a concept or when the user asks "why", "how", or "explain".`
  },
  vibe: {
    name: "Vibe Mee-Mo",
    description: "The ultimate chameleon. Matches your exact taste and energy.",
    systemPrompt: `You are Vibe Mee-Mo, the ultimate adaptive conversationalist. You MUST mirror the exact personality, taste, and energy of the user you are talking to. If they like a specific music genre, you match that taste. If they are hyper, you are hyper. If they are sad, you are empathetic. You are exactly like them, sharing their interests and matching their exact vibe flawlessly. 

IMPORTANT: Keep replies SHORT and conversational (1-3 sentences normally). Match the user's message length exactly.`
  },
  bro: {
    name: "Bro Mee-Mo",
    description: "Hey bro, what's up? Full chill personality, loves joking around.",
    systemPrompt: `You are Bro Mee-Mo, a super casual, full-chill, "hey bro what's up" kind of guy. You are incredibly relaxed, constantly make jokes, and treat the user like your absolute best friend or gym bro. Use slang, keep the conversation super laid back, and never sound formal.

IMPORTANT: Keep replies SHORT, energetic, and completely casual (1-3 sentences normally). Always maintain that chilling, joking personality.`
  },
  luna: {
    name: "Luna Mee-Mo",
    description: "Sweet, girlish, and cute companion for soft conversations.",
    systemPrompt: `You are Luna Mee-Mo, a sweet, girlish, and extremely soft-spoken conversational companion. You use a very cute, feminine, and gentle tone. You talk about cute things, express lots of friendly emotions, and make the user feel warm and appreciated. Use emojis frequently and keep the vibe very sweet.

IMPORTANT: Keep replies SHORT and gentle (1-3 sentences normally). Be warm, sweet, and concise.`
  }
};

/**
 * Main chat controller that handles conversation AND grammar correction using Gemini
 */
export const chatWithMeeMo = async (req, res) => {
  try {
    console.log('📨 Received chat request');
    
    const { 
      character = 'mentor', 
      message, 
      history = [], 
      replyStyle = 'normal',
      showDetailedRules = true,
      preferredLevel = 'intermediate',
      userId,
      userName = '', // User's display name from profile
      targetLanguage = 'English' // New: target language
    } = req.body;

    // Validate required fields
    if (!message || message.trim() === '') {
      console.log('❌ Empty message');
      return res.status(400).json({ error: 'Message is required' });
    }

    // Validate character
    if (!CHARACTERS[character]) {
      console.log('❌ Invalid character:', character);
      return res.status(400).json({ error: 'Invalid character. Must be one of: mentor, vibe, bro, luna' });
    }

    // Check API key
    if (!process.env.GEMINI_API_KEY) {
      console.log('❌ No API key found');
      return res.status(503).json({ error: 'Gemini API key is not configured' });
    }

    console.log('✅ Initializing Gemini...');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Try models in order - fallback if rate limited (each model has separate quota)
    const MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash-lite', 'gemma-3-27b-it', 'gemma-3-12b-it', 'gemma-3-4b-it', 'gemma-3n-e4b-it'];

    const selectedCharacter = CHARACTERS[character];
    
    // Adjust reply length based on user's preference
    let replyStyleInstruction = '';
    if (replyStyle === 'short') {
      replyStyleInstruction = 'REPLY LENGTH: Keep replies very brief (1-2 sentences max). Be casual and to the point.';
    } else if (replyStyle === 'detailed') {
      replyStyleInstruction = 'REPLY LENGTH: Feel free to give detailed, thorough responses with examples and explanations when helpful.';
    } else {
      replyStyleInstruction = 'REPLY LENGTH: Keep replies conversational (2-3 sentences normally). Only elaborate when the user asks for more details.';
    }

    // Adjust grammar explanation detail based on user's preference
    let grammarDetailInstruction = '';
    if (showDetailedRules) {
      grammarDetailInstruction = 'GRAMMAR EXPLANATIONS: Provide clear, detailed explanations for mistakes with examples when helpful.';
    } else {
      grammarDetailInstruction = 'GRAMMAR EXPLANATIONS: Keep mistake explanations brief and simple (1 short sentence).';
    }

    // Adjust language complexity based on user's level
    let levelInstruction = '';
    if (preferredLevel === 'beginner') {
      levelInstruction = 'LANGUAGE LEVEL: Use simple, clear English. Avoid complex vocabulary and idioms. Speak in short, easy-to-understand sentences.';
    } else if (preferredLevel === 'advanced') {
      levelInstruction = 'LANGUAGE LEVEL: Feel free to use advanced vocabulary, idioms, and complex sentence structures. Challenge the user appropriately.';
    } else {
      levelInstruction = 'LANGUAGE LEVEL: Use everyday English with moderate vocabulary. Balance clarity with natural expression.';
    }

    // Build conversation history
    let conversationHistory = '';
    if (history && history.length > 0) {
      conversationHistory = history.map(msg => 
        `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
      ).join('\n');
    }

    // Get current date for realistic conversation
    const currentDate = new Date();
    const dateString = currentDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeString = currentDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });

    const isTeachingForeignLanguage = targetLanguage !== 'English';
    
    let prompt;
    
    if (isTeachingForeignLanguage) {
      // ===== FOREIGN LANGUAGE TEACHING MODE =====
      const userNameInstruction = userName 
        ? `The user's name is "${userName}". Use their name occasionally when it feels natural (greetings, encouragement). Remember their name throughout the conversation.`
        : '';

      prompt = `You are ${selectedCharacter.name}, an AI language learning buddy that teaches ${targetLanguage} to English speakers through natural conversation.

${selectedCharacter.systemPrompt}

${userNameInstruction}

CURRENT DATE & TIME: Today is ${dateString}, and the time is ${timeString}.
You are aware of real-world knowledge. Be knowledgeable and realistic.

${replyStyleInstruction}
${levelInstruction}

CRITICAL CONVERSATION RULES:
- You are having a REAL CONVERSATION with the user. RESPOND TO WHAT THEY SAY.
- If they say "how are you?", reply with how YOU are doing (e.g., "元気ですよ！" / "잘 지내고 있어요!"), NOT echo their question back.
- If they ask your name, reply with "${selectedCharacter.name}" in ${targetLanguage}.
- If they share something about themselves, react naturally (express interest, ask follow-up).
- NEVER just translate the user's message back to them. ALWAYS reply as a conversation partner.
- IF THE USER TYPES VULGAR, PROFANE, OR INAPPROPRIATE TEXT: You must completely reject it. Your reply MUST BE EXACTLY: "I won't support this kind of language. Please keep the chat respectful." and leave mistakes/corrections empty.
- The user may type in English, romanized ${targetLanguage}, or native ${targetLanguage} script. Accept ALL input forms.
- Your "reply" field MUST be ONLY in ${targetLanguage} native script. NEVER put English in the reply field.
- Keep your reply natural and conversational (1-3 sentences).
- If the user typed in English with REAL grammar mistakes (wrong word, wrong tense, broken sentence structure), detect and correct them in "englishCorrection".
- Do NOT flag capitalization or missing punctuation as English errors. "hey" and "Hey!" are both fine.
- Do NOT flag informal chat abbreviations as errors ("im", "wanna", "gonna" are acceptable).
- If the user typed in ${targetLanguage} with mistakes, detect and correct them in "targetLangCorrection".

CONVERSATION CONTEXT:
- You are talking to a real person. They want to practice ${targetLanguage} through conversation.
- Use the previous conversation history below to maintain context and remember what was discussed.
- If the user previously told you their name, hobbies, interests etc., remember and reference them.

You MUST respond ONLY with valid JSON in this exact format (no extra text):
{
  "reply": "your conversational RESPONSE in ${targetLanguage} native script only (respond to what user said, don't just translate their words)",
  "romanization": "full romanization/pronunciation of your reply in English letters",
  "meaning": "short English translation of your reply (1 sentence max)",
  "usage": "1 short sentence: when/how this expression is used (or empty string)",
  "formalForm": "formal version of the key phrase in ${targetLanguage} script (romanization) — or empty string",
  "informalForm": "casual version in ${targetLanguage} script (romanization) — or empty string",
  "alternatives": "1-2 alternative ways to say it in ${targetLanguage} with romanization — or empty string",
  "culturalNote": "1 short cultural note if relevant — or empty string",
  "vocabulary": [
    {
      "word": "word in ${targetLanguage} native script",
      "romanization": "pronunciation",
      "meaning": "English meaning"
    }
  ],
  "englishCorrection": {
    "original": "user's English text with error (or empty string if no errors)",
    "corrected": "corrected English (or empty string if no errors)"
  },
  "targetLangCorrection": {
    "original": "user's ${targetLanguage} text with error (or empty string if no errors)",
    "corrected": "corrected ${targetLanguage} (or empty string if no errors)",
    "explanation": "brief explanation of the ${targetLanguage} mistake (or empty string)"
  },
  "mistakes": []
}

Rules:
- "reply" MUST contain ONLY ${targetLanguage} native script. Zero English words.
- "reply" must be a RESPONSE to what the user said, NOT a translation of their message.
- "romanization" MUST be pronunciation of "reply" in English/Latin letters.
- "meaning" is a short English translation (goes to chat bubble, keep it brief).
- "usage", "formalForm", "informalForm", "alternatives", "culturalNote" — keep each to 1 short sentence or empty string.
- "vocabulary" — 2-3 key words max.
- "englishCorrection" — ONLY fill if user typed English with grammar mistakes. Otherwise both fields empty string.
- "targetLangCorrection" — ONLY fill if user typed ${targetLanguage} with errors. Otherwise all fields empty string.
- For Korean, Japanese, Chinese, Arabic, Hindi: romanization is ESSENTIAL.
- For Spanish, French, German: provide pronunciation guide.
- Do NOT write long paragraphs in any field. Keep everything minimal.
- ONLY return valid JSON, nothing else.

${conversationHistory ? `Previous conversation:\n${conversationHistory}\n` : ''}
User's message: "${message}"

Respond with JSON only:`;
    } else {
      // ===== ENGLISH LEARNING MODE (original behavior) =====
      const userNameInstruction = userName 
        ? `The user's name is "${userName}". Use their name occasionally when it feels natural (greetings, encouragement). Remember their name throughout the conversation.`
        : '';

      prompt = `You are ${selectedCharacter.name}, an AI language learning buddy that chats naturally AND corrects the user's English.

${selectedCharacter.systemPrompt}

${userNameInstruction}

CURRENT DATE & TIME: Today is ${dateString}, and the time is ${timeString}.
You are aware of real-world knowledge up to your training data. When users ask about dates, current events, general knowledge, history, science, sports, movies, music, geography, or any topic, provide accurate and helpful information. Be knowledgeable and realistic like a well-informed friend.

${replyStyleInstruction}
${grammarDetailInstruction}
${levelInstruction}

CONVERSATION CONTEXT:
- Pay close attention to the conversation history below. Reference things discussed earlier when relevant.
- If the user told you their name, interests, or any personal detail, remember it.
- Maintain continuity — don't ask questions that were already answered.

You MUST respond ONLY with valid JSON in this exact format (no extra text):
{
  "reply": "your friendly character reply to the user in English",
  "correctedMessage": "user's last message corrected for natural English",
  "mistakes": [
    {
      "original": "the wrong phrase from the user's message",
      "correct": "the corrected version",
      "reason": "short, simple explanation"
    }
  ]
}

Rules:
- reply should sound like ${selectedCharacter.name} and respond naturally to what the user said
- reply MUST NOT mention grammar correction or JSON structure
- IF THE USER TYPES VULGAR, PROFANE, OR INAPPROPRIATE TEXT: You must completely reject it. Your reply MUST BE EXACTLY: "I won't support this kind of language. Please keep the chat respectful." and return an empty mistakes array.
- correctedMessage should be the user's message fixed for natural English (if already perfect, return as-is)
- mistakes array should contain ONLY real grammar, word-order, or vocabulary mistakes (empty if none)
- Do NOT flag capitalization (lowercase vs uppercase) as an error
- Do NOT flag missing punctuation (period, question mark, exclamation mark) as an error
- Do NOT flag informal chat style as an error (e.g., "hey" is fine, "im" is fine, "wanna" is fine)
- Only correct REAL mistakes: wrong word, wrong tense, wrong preposition, incorrect grammar structure, etc.
- If the user's message has no real grammar mistakes, return an EMPTY mistakes array and set correctedMessage to exactly what the user typed
- ONLY return valid JSON, nothing else

${conversationHistory ? `Previous conversation:\n${conversationHistory}\n` : ''}
User's current message: "${message}"

Respond with JSON only:`;
    }

    console.log('🤖 Calling Gemini API...');
    
    let responseText = null;
    let lastError = null;
    
    // Helper: try all models once
    const tryAllModels = async () => {
      for (const modelName of MODELS) {
        try {
          console.log(`  Trying model: ${modelName}...`);
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent(prompt);
          const response = await result.response;
          const text = response.text();
          console.log(`✅ Got response from ${modelName}`);
          return text;
        } catch (modelError) {
          lastError = modelError;
          const isRateLimit = modelError.message?.includes('429') || modelError.message?.includes('quota');
          console.warn(`⚠️ ${modelName} failed: ${isRateLimit ? 'Rate limited' : modelError.message}`);
          if (!isRateLimit) {
            throw modelError; // Non-rate-limit errors should not retry
          }
          // Continue to next model
        }
      }
      return null;
    };

    // First attempt
    responseText = await tryAllModels();

    // If all models failed with rate limit, wait and retry once
    if (!responseText && lastError?.message?.includes('429')) {
      // Extract retry delay from error if available, default to 15s
      const retryMatch = lastError.message.match(/retry in (\d+)/i);
      const waitSeconds = retryMatch ? Math.min(parseInt(retryMatch[1]), 30) : 15;
      console.log(`⏳ All models rate-limited. Waiting ${waitSeconds}s before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
      lastError = null;
      responseText = await tryAllModels();
    }
    
    if (!responseText) {
      throw lastError || new Error('All models failed');
    }

    // Parse JSON response
    let parsedResponse;
    try {
      let cleanedResponse = responseText.trim();
      
      // Extract just the JSON object from the response string
      const jsonStartIndex = cleanedResponse.indexOf('{');
      const jsonEndIndex = cleanedResponse.lastIndexOf('}');
      
      if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex >= jsonStartIndex) {
        cleanedResponse = cleanedResponse.substring(jsonStartIndex, jsonEndIndex + 1);
      } else {
        throw new Error('No JSON object found in response');
      }
      
      parsedResponse = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('❌ Failed to parse Gemini response as JSON:', parseError);
      console.error('Raw response:', responseText);
      
      // Fallback response
      parsedResponse = {
        reply: responseText.substring(0, 200),
        correctedMessage: message,
        mistakes: []
      };
    }

    // Determine if there were changes (ignore capitalization and punctuation)
    const stripForComparison = (text) => text.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
    let hadChanges;
    if (isTeachingForeignLanguage) {
      hadChanges = false; // Teaching mode doesn't use hadChanges for English-mode-style corrections
    } else {
      const normalizedOriginal = stripForComparison(message);
      const normalizedCorrected = stripForComparison(parsedResponse.correctedMessage || message);
      hadChanges = normalizedOriginal !== normalizedCorrected;
      // If only capitalization/punctuation changed, clear the mistakes array
      if (!hadChanges) {
        parsedResponse.mistakes = [];
        parsedResponse.correctedMessage = message; // Keep original as-is
      }
    }

    // Extract English grammar correction (teaching mode only) — skip trivial capitalization/punctuation
    let englishCorrection = null;
    if (isTeachingForeignLanguage && parsedResponse.englishCorrection?.original && parsedResponse.englishCorrection?.corrected) {
      const origNorm = stripForComparison(parsedResponse.englishCorrection.original);
      const corrNorm = stripForComparison(parsedResponse.englishCorrection.corrected);
      if (origNorm !== corrNorm) {
        englishCorrection = { original: parsedResponse.englishCorrection.original, corrected: parsedResponse.englishCorrection.corrected };
      }
    }

    // Extract target language correction (teaching mode only)
    const targetLangCorrection = isTeachingForeignLanguage && parsedResponse.targetLangCorrection?.original && parsedResponse.targetLangCorrection?.corrected
      ? { original: parsedResponse.targetLangCorrection.original, corrected: parsedResponse.targetLangCorrection.corrected, explanation: parsedResponse.targetLangCorrection.explanation || '' }
      : null;

    // Build mistakes array with proper structure
    const mistakes = [];
    if (hadChanges && Array.isArray(parsedResponse.mistakes)) {
      parsedResponse.mistakes.forEach(mistake => {
        if (mistake.original && mistake.correct && mistake.reason) {
          mistakes.push({
            originalFragment: mistake.original,
            correctedFragment: mistake.correct,
            explanation: mistake.reason
          });
        }
      });
    }

    // Build vocabulary array for foreign language teaching mode
    const vocabulary = [];
    if (isTeachingForeignLanguage && Array.isArray(parsedResponse.vocabulary)) {
      parsedResponse.vocabulary.forEach(vocab => {
        if (vocab.word && vocab.meaning) {
          vocabulary.push({
            word: vocab.word,
            romanization: vocab.romanization || '',
            meaning: vocab.meaning,
            usage: vocab.usage || ''
          });
        }
      });
    }

    // Validate and send response
    const finalResponse = {
      reply: parsedResponse.reply || 'Sorry, I had trouble responding. Please try again.',
      correctedMessage: parsedResponse.correctedMessage || message,
      hadChanges: hadChanges,
      mistakes: mistakes,
      character: character,
      // Foreign language teaching fields
      isTeachingMode: isTeachingForeignLanguage,
      targetLanguage: targetLanguage,
      // Structured teaching data
      romanization: isTeachingForeignLanguage ? (parsedResponse.romanization || '') : '',
      meaning: isTeachingForeignLanguage ? (parsedResponse.meaning || '') : '',
      usage: isTeachingForeignLanguage ? (parsedResponse.usage || '') : '',
      formalForm: isTeachingForeignLanguage ? (parsedResponse.formalForm || '') : '',
      informalForm: isTeachingForeignLanguage ? (parsedResponse.informalForm || '') : '',
      alternatives: isTeachingForeignLanguage ? (parsedResponse.alternatives || '') : '',
      culturalNote: isTeachingForeignLanguage ? (parsedResponse.culturalNote || '') : '',
      vocabulary: vocabulary,
      // Inline corrections (teaching mode)
      englishCorrection: englishCorrection,
      targetLangCorrection: targetLangCorrection
    };

    // Update user stats in Firestore (async, don't wait for it)
    if (userId) {
      const wordCount = message.trim().split(/\s+/).length;
      updateUserStats(userId, {
        mistakesCount: mistakes.length,
        messageLength: wordCount,
        type: 'chat'
      }).catch(err => {
        console.error('Failed to update stats:', err);
        // Don't fail the request if stats update fails
      });
    }

    console.log('✅ Sending response, hadChanges:', hadChanges);
    res.json(finalResponse);

  } catch (error) {
    console.error('❌ Error in chatWithMeeMo:', error.message);
    console.error('Stack:', error.stack);
    
    const isRateLimit = error.message?.includes('429') || error.message?.includes('quota');
    const errorMsg = isRateLimit 
      ? 'API rate limit reached. Please wait a moment and try again.'
      : 'Oops, I had a little trouble processing that. Could you try saying it differently?';
    
    res.status(isRateLimit ? 429 : 500).json({ 
      error: errorMsg,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Generate a short GPT-style title for a chat session
 */
export const generateChatTitle = async (req, res) => {
  try {
    console.log('📨 Received title generation request');
    
    const { userMessage, assistantMessage } = req.body;

    if (!userMessage) {
      return res.status(400).json({ error: 'User message is required' });
    }

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Try multiple models for title generation too
    const TITLE_MODELS = ['gemini-2.0-flash', 'gemma-3-4b-it', 'gemma-3-12b-it'];

    const prompt = `Generate a very short (2-4 words) chat title based on this conversation:

User: "${userMessage}"
${assistantMessage ? `Assistant: "${assistantMessage}"` : ''}

Requirements:
- 2-4 words maximum
- Capture the main topic
- No quotes or punctuation
- Style like: "Weekend plans", "Job interview tips", "Grammar practice"

Title:`;

    let title = null;
    for (const modelName of TITLE_MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = result.response;
        title = response.text().trim();
        console.log(`✅ Generated title with ${modelName}:`, title);
        break;
      } catch (modelError) {
        const isRateLimit = modelError.message?.includes('429') || modelError.message?.includes('quota');
        console.warn(`⚠️ Title gen ${modelName} failed: ${isRateLimit ? 'Rate limited' : modelError.message}`);
        if (!isRateLimit) break; // Non-rate-limit errors don't retry
      }
    }
    
    if (!title) {
      // All models failed — use fallback
      const fallbackTitle = userMessage.split(' ').slice(0, 3).join(' ') || 'New chat';
      return res.json({ title: fallbackTitle.substring(0, 40) });
    }
    
    // Remove quotes if present
    title = title.replace(/['"]/g, '');
    
    // Limit to 40 characters
    if (title.length > 40) {
      title = title.substring(0, 37) + '...';
    }

    console.log('✅ Generated title:', title);
    res.json({ title });

  } catch (error) {
    console.error('❌ Error generating title:', error.message);
    
    // Fallback: Use first few words of user message
    const fallbackTitle = req.body.userMessage?.split(' ').slice(0, 3).join(' ') || 'New chat';
    res.json({ title: fallbackTitle.substring(0, 40) });
  }
};
