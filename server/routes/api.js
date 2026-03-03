import express from 'express';
import { ping } from '../controllers/apiController.js';

const router = express.Router();

// GET /api/ping
router.get('/ping', ping);

export default router;
