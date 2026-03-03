import { GoogleGenerativeAI } from '@google/generative-ai';

const TRANSLATE_MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash-lite', 'gemma-3-27b-it', 'gemma-3-12b-it'];

const translateWithFallback = async (prompt, timeoutMs = 30000) => {
  if (!process.env.GEMINI_API_KEY) throw new Error('Gemini API key not configured');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const tryAllModels = async () => {
    let lastError = null;
    for (const modelName of TRANSLATE_MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await Promise.race([
          model.generateContent(prompt),
          new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs))
        ]);
        console.log(`✅ Translate: got response from ${modelName}`);
        return result.response.text();
      } catch (err) {
        lastError = err;
        const isRateLimit = err.message?.includes('429') || err.message?.includes('quota') || err.message?.includes('rate');
        console.warn(`⚠️ Translate model ${modelName} failed: ${isRateLimit ? 'Rate limited' : err.message}`);
        if (!isRateLimit) throw err;
      }
    }
    return { failed: true, lastError };
  };

  let result = await tryAllModels();
  if (result?.failed) {
    const retryMatch = result.lastError?.message?.match(/retry in (\d+)/i);
    const waitSeconds = retryMatch ? Math.min(parseInt(retryMatch[1]), 30) : 15;
    console.log(`⏳ All translate models rate-limited. Waiting ${waitSeconds}s before retry...`);
    await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
    result = await tryAllModels();
    if (result?.failed) throw result.lastError;
  }
  return result;
};

export const translateAndUpgrade = async (req, res) => {
  console.log('🌐 Translate & Upgrade endpoint hit');
  try {
    const { text, targetLanguage = 'English' } = req.body;
    const isEnglishMode = targetLanguage === 'English';

    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Text is required' });
    }

    console.log('📝 Processing text:', text.substring(0, 50) + '...', 'Target:', targetLanguage);

    let prompt;

    if (isEnglishMode) {
      prompt = `You are a multilingual translation expert. A user has provided text in ANY language. Your job is to:
1. ACCURATELY detect the input language by analyzing the script/characters used
2. Translate to simple English (B1-B2)
3. Provide an upgraded English version (B2-C1)

CRITICAL — Language Detection Rules:
- Kannada script (ಅ ಆ ಇ ಈ ಉ ಊ ಕ ಗ ನ): detect as "Kannada" — NOT Tamil!
- Tamil script (அ ஆ இ ஈ உ ஊ க ங ன): detect as "Tamil"
- Telugu script (అ ఆ ఇ ఈ ఉ ఊ క గ న): detect as "Telugu"
- Malayalam script (അ ആ ഇ ഈ ഉ ഊ ക ഗ ന): detect as "Malayalam"
- Devanagari script (अ आ इ ई उ ऊ क ग न): detect as "Hindi" (or Marathi/Sanskrit if context suggests)
- Bengali script (অ আ ই ঈ উ ঊ ক গ ন): detect as "Bengali"
- Gujarati script (અ આ ઇ ઈ ઉ ઊ ક ગ ન): detect as "Gujarati"
- Arabic script (ع غ ف ق ك ل م ن): detect as "Arabic" or "Urdu" based on context
- Japanese (ひらがな カタカナ 漢字): detect as "Japanese"
- Korean (한글): detect as "Korean"
- Chinese (汉字): detect as "Chinese"
- Cyrillic (А Б В Г Д): detect as "Russian" or appropriate Slavic language
- If written in English/Latin letters but not English (transliterated), identify the actual language (e.g., "Kannada (transliterated)", "Hindi (transliterated)")

Each Indian language has a DISTINCT script. Do NOT confuse them. Look at the actual character shapes carefully.

User's input: "${text}"

IMPORTANT: You MUST respond with ONLY a valid JSON object. No explanations, no markdown, no code blocks, just pure JSON.

JSON Format:
{
  "detectedLanguage": "exact language name in English (e.g., Kannada, Tamil, Hindi, Spanish, etc.)",
  "directEnglish": "simple, clear English translation (B1-B2 level)",
  "upgradedEnglish": "more advanced, natural English version (B2-C1 level)",
  "vocabTips": [
    "Tip 1 explaining a useful word or phrase",
    "Tip 2 explaining another useful word or phrase",
    "Tip 3 explaining another useful word or phrase"
  ]
}

Rules:
- FIRST identify the script, THEN the language — never guess
- If input is already in English, set detectedLanguage to "English" and improve it
- Keep directEnglish simple and clear (B1-B2 level)
- Keep upgradedEnglish natural and conversational (B2-C1 level), not too formal
- Each vocab tip should be ONE short sentence (maximum 15 words)
- Preserve the user's intended meaning accurately
- Do NOT use rare or obscure vocabulary
- Return ONLY the JSON object, nothing else`;
    } else {
      // Foreign language mode: translate TO the target language
      prompt = `You are a multilingual translation expert. A user wants to translate text into ${targetLanguage}.

CRITICAL — First, ACCURATELY detect the input language by analyzing the script/characters:
- Kannada script (ಅ ಆ ಇ ಈ ಕ ಗ ನ): "Kannada" — NOT Tamil, NOT Telugu
- Tamil script (அ ஆ இ ஈ க ங ன): "Tamil" — NOT Kannada
- Telugu script (అ ఆ ఇ ఈ క గ న): "Telugu" — NOT Kannada
- Malayalam script (അ ആ ഇ ഈ ക ഗ ന): "Malayalam"
- Devanagari (अ आ इ ई क ग न): "Hindi"
- Japanese (ひらがな カタカナ 漢字): "Japanese"
- Korean (한글): "Korean"
- Chinese (汉字): "Chinese"
Each script is DISTINCT. Look at character shapes carefully before identifying.

The user's text may be in English, in another language, or already in ${targetLanguage}.

Your task:
1. Detect the input language accurately based on the script
2. Translate it into simple, clear ${targetLanguage} (beginner-friendly, B1-B2 equivalent)
3. Provide a more natural, advanced ${targetLanguage} version (B2-C1 equivalent) — how a native speaker would say it
4. For non-Latin scripts, provide romanization/pronunciation in Latin letters
5. Provide 3-5 useful ${targetLanguage} vocabulary tips

User's input: "${text}"

IMPORTANT: You MUST respond with ONLY a valid JSON object. No explanations, no markdown, no code blocks, just pure JSON.

JSON Format:
{
  "detectedLanguage": "exact language name of the input (e.g., Kannada, English, Hindi)",
  "directEnglish": "simple ${targetLanguage} translation in native script (romanization)",
  "upgradedEnglish": "natural, advanced ${targetLanguage} version in native script (romanization)",
  "vocabTips": [
    "${targetLanguage} word/phrase — pronunciation — English meaning",
    "Another ${targetLanguage} word — pronunciation — meaning",
    "Another ${targetLanguage} word — pronunciation — meaning"
  ]
}

Rules:
- FIRST identify the script, THEN the language — never guess or confuse similar scripts
- directEnglish should be the SIMPLE ${targetLanguage} translation with romanization in parentheses
- upgradedEnglish should be the NATURAL ${targetLanguage} version with romanization in parentheses
- If input is already in ${targetLanguage}, detect it correctly and still provide simple vs natural versions
- Each vocab tip: ${targetLanguage} word — romanization — English meaning (max 15 words each)
- Preserve the user's intended meaning accurately
- Return ONLY the JSON object, nothing else`;
    }

    console.log('🤖 Calling Gemini API...');
    
    let responseText;
    try {
      responseText = await translateWithFallback(prompt);
    } catch (apiError) {
      console.error('❌ Gemini API call failed:', apiError.message);
      throw apiError;
    }
    
    console.log('✅ Gemini API responded');
    
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
