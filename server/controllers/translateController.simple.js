import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const translateAndUpgrade = async (req, res) => {
  console.log('🌐 Translate & Upgrade endpoint hit');
  try {
    const { text } = req.body;

    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Text is required' });
    }

    console.log('📝 Processing:', text);

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Detect the language of this text and translate it to English if needed: "${text}". Return ONLY a JSON object with this format: {"detectedLanguage":"language name","directEnglish":"simple translation","upgradedEnglish":"improved translation","vocabTips":["tip1","tip2","tip3"]}`;

    console.log('🤖 Calling API...');
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let responseText = response.text();

    console.log('✅ Got response');

    // Clean up
    responseText = responseText
      .replace(/```json\n?/gi, '')
      .replace(/```\n?/gi, '')
      .trim();

    const parsedResponse = JSON.parse(responseText);

    res.json({
      original: text,
      detectedLanguage: parsedResponse.detectedLanguage,
      directEnglish: parsedResponse.directEnglish,
      upgradedEnglish: parsedResponse.upgradedEnglish,
      vocabTips: parsedResponse.vocabTips
    });

    console.log('✅ Success');

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ 
      error: 'Failed to process translation',
      details: error.message
    });
  }
};
