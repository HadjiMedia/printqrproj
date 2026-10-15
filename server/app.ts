import express from 'express';
import dotenv from 'dotenv';
import apiRouter from './routes.js';
import { ensureDatabaseReady } from './db.js';

dotenv.config();

const app = express();


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

// Every request waits for DB bootstrap (important on serverless cold starts)
app.use(async (_req, _res, next) => {
  try {
    await ensureDatabaseReady();
    next();
  } catch (err) {
    next(err);
  }
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

  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: { code: 'INVALID_JSON', message: 'The request could not be read. Please try again.' } });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ success: false, error: { code: 'PAYLOAD_TOO_LARGE', message: 'The upload is too large. Please use smaller files.' } });
  }

  const statusCode = typeof err?.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;
  const knownOperationalCode = ['DATABASE_NOT_CONFIGURED', 'DATABASE_UNAVAILABLE'].includes(err?.code) ? err.code : null;
  // Only expose explicitly safe operational messages; never leak raw database errors, tokens, or paths.
  res.status(statusCode).json({
    success: false,
    error: {
      code: knownOperationalCode || (statusCode >= 500 ? 'SERVER_ERROR' : (err?.code && typeof err.code === 'string' ? err.code : 'INVALID_REQUEST')),
      message: knownOperationalCode ? err.message : (statusCode >= 500 ? 'A server error occurred. Please try again.' : (err?.message || 'Invalid request.')),
    },
  });
});

export default app;
