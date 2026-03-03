import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import apiRoutes from './routes/api.js';
import chatRoutes from './routes/chatRoutes.js';
import learnRoutes from './routes/learnRoutes.js';
import translateRoutes from './routes/translateRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

// Debug: Check if Gemini API key is loaded
console.log('🔑 Gemini API Key loaded:', process.env.GEMINI_API_KEY ? 'YES ✅' : 'NO ❌');
console.log('Environment:', process.env.NODE_ENV);

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ UNCAUGHT EXCEPTION:', error);
  console.error(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION at:', promise);
  console.error('Reason:', reason);
});

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  process.env.CLIENT_URL, // Set this in Vercel env vars to your domain
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(allowed => origin.startsWith(allowed)) || origin.includes('vercel.app')) {
      return callback(null, true);
    }
    callback(null, true); // Allow all for now; tighten after deployment
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== Per-User Rate Limiting (Free Tier Protection) =====
const userRequestLog = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 10;      // 10 messages per minute per user
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Clean up old entries every 5 min

// Periodically clean stale entries to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of userRequestLog.entries()) {
    const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length === 0) userRequestLog.delete(key);
    else userRequestLog.set(key, recent);
  }
}, CLEANUP_INTERVAL_MS);

const rateLimiter = (req, res, next) => {
  const userId = req.body?.userId || req.ip || 'anonymous';
  const now = Date.now();
  const timestamps = (userRequestLog.get(userId) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);

  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    const waitTime = Math.ceil((timestamps[0] + RATE_LIMIT_WINDOW_MS - now) / 1000);
    return res.status(429).json({
      error: `Slow down! You can send ${MAX_REQUESTS_PER_WINDOW} messages per minute. Try again in ${waitTime}s.`
    });
  }

  timestamps.push(now);
  userRequestLog.set(userId, timestamps);
  next();
};

// Apply rate limiter to AI-powered endpoints only
app.use('/api/chat', rateLimiter);
app.use('/api/learn', rateLimiter);
app.use('/api/translate', rateLimiter);

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api', apiRoutes);
app.use('/api', chatRoutes);
app.use('/api', learnRoutes);
app.use('/api', translateRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Mee-Mo Server API' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Express error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start server only when running locally (not on Vercel)
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Export for Vercel serverless
export default app;
