import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());

// Serve static frontend build
app.use(express.static('dist'));

const secretClient = new SecretManagerServiceClient();
let ai;

async function getApiKey() {
  if (process.env.K_SERVICE) {
    console.log('Detected Google Cloud environment, fetching secret...');
    try {
      const name = 'projects/151337636767/secrets/GEMINI_API_KEY/versions/latest';
      const [version] = await secretClient.accessSecretVersion({ name });
      return version.payload.data.toString();
    } catch (error) {
      console.error('CRITICAL: Error fetching secret from Secret Manager:', error);
      throw error;
    }
  }
  return process.env.GEMINI_API_KEY;
}

// Health check endpoint for Cloud Run
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Route to handle front-end requests for tokens
app.get('/api/token', async (req, res) => {
  try {
    if (!ai) {
      const apiKey = await getApiKey();
      if (!apiKey) throw new Error('GEMINI_API_KEY not found');
      ai = new GoogleGenAI({ apiKey });
    }

    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: expireTime,
        httpOptions: { apiVersion: 'v1alpha' }
      }
    });
    res.json({ token: token.name });
  } catch (error) {
    console.error("Error creating token:", error);
    res.status(500).json({ error: error.message });
  }
});

// For Cloud Run, use a middleware fallback for SPA support (avoids Express 5 regex issues)
app.use((req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error sending index.html:', err);
      res.status(404).send('Not Found');
    }
  });
});

const PORT = process.env.PORT || 8080;
// Cloud Run requires listening on 0.0.0.0
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server starting on port ${PORT}...`);
  console.log(`Environment: ${process.env.K_SERVICE ? 'Cloud Run' : 'Local'}`);
});
