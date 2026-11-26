import rateLimit from 'express-rate-limit';
import { HttpError } from './error-handler';

export function createEnquiryRateLimiter(limit: number, windowMs: number) {
  return rateLimit({
    limit,
    windowMs,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_request, _response, next) => {
      next(
        new HttpError(
          429,
          'RATE_LIMITED',
          'Too many enquiries. Please try again later.',
        ),
      );
    },
  });
}
