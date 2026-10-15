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

// Health Check Endpoints (both /api/health and /health)
app.get(['/api/health', '/health'], (_req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'production',
    serverless: Boolean(process.env.VERCEL),
    time: new Date().toISOString(),
  });
});

// Mount Public & Protected API Router on both '/api' and '/'
// This ensures compatibility with direct Vite dev server, Express production,
// and Vercel serverless rewrites regardless of whether '/api' prefix is stripped.
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Global JSON 404 Handler for API requests
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `API endpoint ${req.method} ${req.originalUrl || req.url} not found.`,
    },
  });
});

// Global JSON Error Handler (Prevents any HTML/plain text error leakage to frontend)
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[API] Server error caught:', err);
  const statusCode = typeof err?.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;
  
  res.status(statusCode).json({
    success: false,
    error: {
      code: err?.code || (statusCode === 400 ? 'INVALID_REQUEST' : 'SERVER_ERROR'),
      message: err?.message || 'A server error occurred processing your request. Please try again.',
    },
  });
});

export default app;
