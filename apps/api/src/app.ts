import express, { type Express } from 'express';

export function buildApp(): Express {
  const app = express();

  app.get('/api/health', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  return app;
}
