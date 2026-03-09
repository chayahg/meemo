export const ping = (req, res) => {
  res.json({
    message: 'Mee-Mo backend running',
    geminiKey: process.env.GEMINI_API_KEY ? 'SET ✅' : 'MISSING ❌',
    nodeEnv: process.env.NODE_ENV || 'not set',
    vercel: process.env.VERCEL || 'not set',
    nodeVersion: process.version,
  });
};
