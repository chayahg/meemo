import express from 'express';
import { chatWithMeeMo, generateChatTitle } from '../controllers/chatController.js';

const router = express.Router();

// POST /api/chat - Main chat endpoint with grammar correction
router.post('/chat', chatWithMeeMo);

// POST /api/generate-title - Generate chat session title
router.post('/generate-title', generateChatTitle);

export default router;
