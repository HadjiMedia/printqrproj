import express from 'express';
import dotenv from 'dotenv';
import apiRouter from './routes';
import { initDatabase } from './db';

dotenv.config();

const app = express();

// Initialize database schema (Neon or local fallback)
initDatabase().catch(err => {
  console.error('[DB] Startup init error:', err);
});

// Middleware: Request Body Parsers (support documents & images up to 50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health Check Endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'production',
    serverless: Boolean(process.env.VERCEL),
    time: new Date().toISOString(),
  });
});

// Mount Public & Protected API Router
app.use('/api', apiRouter);

export default app;
