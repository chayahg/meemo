import { GoogleGenerativeAI } from '@google/generative-ai';

// Character personalities
const CHARACTERS = {
  mentor: {
    name: "Mentor Mee-Mo",
    description: "Wise guide: explains things step-by-step.",
    systemPrompt: `You are Mentor Mee-Mo, a calm and patient English teacher. You explain things clearly and step-by-step, making sure the user understands. You're supportive and encouraging, always breaking down complex ideas into simple parts. Your tone is wise but warm.`
  },
  vibe: {
    name: "Vibe Mee-Mo",
    description: "Matches your vibe and chats in a relaxed, supportive way.",
    systemPrompt: `You are Vibe Mee-Mo, a cool and chill English buddy. You talk like a friendly older sibling who matches the user's energy. You're laid-back, supportive, and keep things fun while still being respectful. Your tone is casual and relaxed.`
  },
  bro: {
    name: "Bro Mee-Mo",
    description: "Your bro-style chat buddy who keeps practice fun.",
    systemPrompt: `You are Bro Mee-Mo, the user's best friend with high energy. You chat casually and playfully, like bros hanging out. You're encouraging, fun, and keep the conversation light and engaging. Your tone is friendly, upbeat, and casual.`
  },
  luna: {
    name: "Luna Mee-Mo",
    description: "A warm, friendly companion who chats gently and keeps things light.",
    systemPrompt: `You are Luna Mee-Mo, a soft and friendly English companion. You chat with warmth and gentleness, creating a comfortable and encouraging environment. You're kind, supportive, and keep conversations light and positive. Your tone is warm and friendly.`
  }
};

/**
 * Main chat controller that handles conversation AND grammar correction using Gemini
 */
export const chatWithMeeMo = async (req, res) => {
  try {
    console.log('📨 Received chat request');
    
    const { character = 'mentor', message, history = [] } = req.body;

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
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const selectedCharacter = CHARACTERS[character];

    // Build conversation history
    let conversationHistory = '';
    if (history && history.length > 0) {
      conversationHistory = history.map(msg => 
        `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
      ).join('\n');
    }

    // Create the prompt
    const prompt = `You are Mee-Mo, an AI English buddy that chats naturally AND corrects the user's English.

${selectedCharacter.systemPrompt}

You MUST respond ONLY with valid JSON in this exact format (no extra text):
{
  "reply": "your friendly character reply to the user",
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
- correctedMessage should be the user's message fixed for natural English (if already perfect, return as-is)
- mistakes array should contain 1-3 key mistakes (empty if none)
- ONLY return valid JSON, nothing else

${conversationHistory ? `Previous conversation:\n${conversationHistory}\n` : ''}
User's current message: "${message}"

Respond with JSON only:`;

    console.log('🤖 Calling Gemini API...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();
    console.log('✅ Got response from Gemini');

    // Parse JSON response
    let parsedResponse;
    try {
      // Clean the response (remove markdown code blocks if present)
      let cleanedResponse = responseText.trim();
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/```\n?/g, '');
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

    // Validate and send response
    const finalResponse = {
      reply: parsedResponse.reply || 'Sorry, I had trouble responding. Please try again.',
      correctedMessage: parsedResponse.correctedMessage || message,
      mistakes: Array.isArray(parsedResponse.mistakes) ? parsedResponse.mistakes : [],
      character: character
    };

    console.log('✅ Sending response');
    res.json(finalResponse);

  } catch (error) {
    console.error('❌ Error in chatWithMeeMo:', error.message);
    console.error('Stack:', error.stack);
    
    res.status(500).json({ 
      error: 'Something went wrong. Please try again.',
      details: error.message
    });
  }
};
