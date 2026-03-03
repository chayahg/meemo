import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const translateAndUpgrade = async (req, res) => {
  console.log('🌐 Translate & Upgrade endpoint hit');
  try {
    const { text } = req.body;

    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Text is required' });
    }

    console.log('📝 Processing text:', text.substring(0, 50) + '...');

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `You are an English language learning assistant. A user has provided text that may be:
- In their native language using native script (Kannada: ನಾನು, Tamil: நான், Telugu, Malayalam, Hindi, Spanish, French, etc.)
- In their native language written in ENGLISH LETTERS (transliterated/Romanized): "Naanu", "Naan", "main", etc.
- Already in English

Your task:
1. Detect what language the input is in. If it's transliterated (Indian language written in English letters), specify that clearly (e.g., "Kannada (transliterated)", "Tamil (Romanized)")
2. If it's NOT proper English, translate it into simple, clear, correct English (B1-B2 level)
3. Then upgrade that English translation into more advanced, natural English (B2-C1 level) with richer vocabulary but still conversational
4. Provide 3-5 useful vocabulary tips explaining key words or phrases used

User's input: "${text}"

IMPORTANT: You MUST respond with ONLY a valid JSON object. No explanations, no markdown, no code blocks, just pure JSON.

JSON Format:
{
  "detectedLanguage": "language name in English (e.g., Kannada, Tamil, Telugu, Malayalam, Hindi, Spanish, etc.)",
  "directEnglish": "simple, clear English translation (B1-B2 level)",
  "upgradedEnglish": "more advanced, natural English version (B2-C1 level)",
  "vocabTips": [
    "Tip 1 explaining a useful word or phrase",
    "Tip 2 explaining another useful word or phrase",
    "Tip 3 explaining another useful word or phrase"
  ]
}

Rules:
- If input is already in English, set detectedLanguage to "English" and improve it progressively from directEnglish to upgradedEnglish
- Keep directEnglish simple and clear (B1-B2 level)
- Keep upgradedEnglish natural and conversational (B2-C1 level), not too formal
- Each vocab tip should be ONE short sentence (maximum 15 words)
- Preserve the user's intended meaning accurately
- Do NOT use rare or obscure vocabulary
- Return ONLY the JSON object, nothing else`;

    console.log('🤖 Calling Gemini API...');
    
    let result;
    try {
      result = await Promise.race([
        model.generateContent(prompt),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini API timeout after 30 seconds')), 30000))
      ]);
    } catch (apiError) {
      console.error('❌ Gemini API call failed:', apiError.message);
      throw apiError;
    }
    
    console.log('✅ Gemini API responded');
    
    const response = await result.response;
    let responseText = response.text();

    console.log('📝 Raw Gemini response (first 500 chars):', responseText.substring(0, 500));

    // Clean up response (remove markdown code blocks if present)
    responseText = responseText
      .replace(/```json\n?/gi, '')
      .replace(/```\n?/gi, '')
      .replace(/^[^{]*/, '') // Remove any text before first {
      .replace(/[^}]*$/, '') // Remove any text after last }
      .trim();

    console.log('📝 Cleaned response (first 500 chars):', responseText.substring(0, 500));

    // Parse JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError.message);
      console.error('Response text (first 1000 chars):', responseText.substring(0, 1000));
      return res.status(500).json({ 
        error: 'Failed to parse AI response. The AI returned an unexpected format. Please try again.' 
      });
    }

    // Validate response structure
    if (!parsedResponse.detectedLanguage || !parsedResponse.directEnglish || 
        !parsedResponse.upgradedEnglish || !parsedResponse.vocabTips) {
      console.error('❌ Invalid response structure:', parsedResponse);
      return res.status(500).json({ 
        error: 'AI response is missing required fields. Please try again.' 
      });
    }

    // Return successful response
    res.json({
      original: text,
      detectedLanguage: parsedResponse.detectedLanguage,
      directEnglish: parsedResponse.directEnglish,
      upgradedEnglish: parsedResponse.upgradedEnglish,
      vocabTips: parsedResponse.vocabTips
    });

    console.log('✅ Translate & Upgrade successful');

  } catch (error) {
    console.error('❌ Translate & Upgrade error:', error);
    console.error('❌ Error stack:', error.stack);
    
    // Check if response was already sent
    if (res.headersSent) {
      console.error('❌ Headers already sent, cannot send error response');
      return;
    }
    
    res.status(500).json({ 
      error: 'Failed to process translation. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
