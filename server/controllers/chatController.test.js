import { GoogleGenerativeAI } from '@google/generative-ai';

console.log('Loading controller...');

// Initialize Gemini AI client (dotenv is already configured in index.js)
const getGenAI = () => {
  console.log('getGenAI called, API key:', process.env.GEMINI_API_KEY ? 'EXISTS' : 'MISSING');
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in .env file');
  }
  return new GoogleGenerativeAI(apiKey);
};

console.log('Testing getGenAI...');
try {
  const genAI = getGenAI();
  console.log('getGenAI worked:', genAI ? 'YES' : 'NO');
} catch (error) {
  console.error('getGenAI error:', error);
}

console.log('Controller loaded successfully!');

export const testChat = (req, res) => {
  res.json({ message: 'Test chat works!' });
};
