import express from 'express';
import { translateAndUpgrade } from '../controllers/translateController.js';

const router = express.Router();

router.post('/translate-upgrade', translateAndUpgrade);

export default router;
