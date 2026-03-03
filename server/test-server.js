import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Test server works!' });
});

app.post('/api/test', (req, res) => {
  console.log('Test endpoint hit');
  res.json({ success: true, body: req.body });
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Test server on http://localhost:${PORT}`);
});
