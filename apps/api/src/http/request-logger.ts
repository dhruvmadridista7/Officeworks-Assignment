import type { NextFunction, Request, Response } from 'express';

export type RequestLogger = {
  info: (fields: Record<string, unknown>, message: string) => void;
  error: (fields: Record<string, unknown>, message: string) => void;
};

export const consoleLogger: RequestLogger = {
  info(fields, message) {
    process.stdout.write(
      `${JSON.stringify({ level: 'info', message, ...fields })}\n`,
    );
  },
  error(fields, message) {
    process.stderr.write(
      `${JSON.stringify({ level: 'error', message, ...fields })}\n`,
    );
  },
};

export function createRequestLogger(logger: RequestLogger) {
  return (_request: Request, response: Response, next: NextFunction): void => {
    const startedAt = Date.now();
    response.once('finish', () => {
      logger.info(
        {
          method: _request.method,
          path: new URL(_request.originalUrl, 'http://localhost').pathname,
          status: response.statusCode,
          responseTimeMs: Date.now() - startedAt,
        },
        'HTTP request completed',
      );
    });
    next();
  };
}
