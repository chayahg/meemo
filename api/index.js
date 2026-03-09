// Vercel Serverless Function — handles ALL /api/* routes
import app from '../server/index.js';

export default function handler(req, res) {
  return app(req, res);
}
