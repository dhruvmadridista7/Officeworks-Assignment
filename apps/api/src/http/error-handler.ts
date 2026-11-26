import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import {
  CategoryNotFoundError,
  ProductNotFoundError,
  UpstreamError,
  ValidationError,
} from '../domain/errors';
import type { RequestLogger } from './request-logger';

type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'PRODUCT_NOT_FOUND'
  | 'CATEGORY_NOT_FOUND'
  | 'ROUTE_NOT_FOUND'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL_ERROR';

type ApiError = {
  error: {
    code: ErrorCode;
    message: string;
    details?: { field: string; message: string }[];
  };
};

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

function getErrorResponse(error: unknown): { status: number; body: ApiError } {
  if (error instanceof ZodError) {
    return {
      status: 400,
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed.',
          details: error.issues.map((issue) => ({
            field: issue.path.join('.') || 'request',
            message: issue.message,
          })),
        },
      },
    };
  }
  if (error instanceof ValidationError) {
    return {
      status: 400,
      body: { error: { code: 'VALIDATION_ERROR', message: error.message } },
    };
  }
  if (error instanceof ProductNotFoundError) {
    return {
      status: 404,
      body: {
        error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' },
      },
    };
  }
  if (error instanceof CategoryNotFoundError) {
    return {
      status: 404,
      body: {
        error: { code: 'CATEGORY_NOT_FOUND', message: 'Category not found.' },
      },
    };
  }
  if (error instanceof UpstreamError) {
    return {
      status: 502,
      body: {
        error: {
          code: 'UPSTREAM_ERROR',
          message: 'The product service is temporarily unavailable.',
        },
      },
    };
  }
  if (error instanceof HttpError) {
    return {
      status: error.status,
      body: { error: { code: error.code, message: error.message } },
    };
  }
  if (typeof error === 'object' && error !== null && 'type' in error) {
    const parserError = error as { type?: unknown };
    if (
      parserError.type === 'entity.too.large' ||
      parserError.type === 'entity.parse.failed'
    ) {
      return {
        status: 400,
        body: {
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body.' },
        },
      };
    }
  }
  return {
    status: 500,
    body: {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
      },
    },
  };
}

export function createErrorHandler(logger: RequestLogger): ErrorRequestHandler {
  return (error: unknown, _request, response, _next): void => {
    void _next;
    const result = getErrorResponse(error);
    if (result.status === 500) {
      logger.error(
        {
          errorName: error instanceof Error ? error.name : 'UnknownError',
          errorMessage: error instanceof Error ? error.message : 'Unknown error value',
        },
        'Unhandled request error',
      );
    }
    response.status(result.status).json(result.body);
  };
}
