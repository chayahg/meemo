// Vercel Serverless Function — catch-all handler for /api/*
// The [...path] filename tells Vercel to route ALL /api/* requests here
import app from '../server/index.js';

export default function handler(req, res) {
  return app(req, res);
}
