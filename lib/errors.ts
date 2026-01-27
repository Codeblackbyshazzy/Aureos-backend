import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export const ErrorCodes = {
  ALREADY_VOTED: 'ALREADY_VOTED',
  NOT_FOLLOWING: 'NOT_FOLLOWING',
  DUPLICATE_TOPIC: 'DUPLICATE_TOPIC',
  MAX_TOPICS_EXCEEDED: 'MAX_TOPICS_EXCEEDED',
  CANNOT_DELETE_DEFAULT_STATUS: 'CANNOT_DELETE_DEFAULT_STATUS',
  COMMENT_NOT_FOUND: 'COMMENT_NOT_FOUND',
  ALREADY_FOLLOWING: 'ALREADY_FOLLOWING',
  VOTE_NOT_FOUND: 'VOTE_NOT_FOUND',
  STATUS_NOT_FOUND: 'STATUS_NOT_FOUND',
  TOPIC_NOT_FOUND: 'TOPIC_NOT_FOUND',
  MAX_STATUSES_EXCEEDED: 'MAX_STATUSES_EXCEEDED',
} as const;

export interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  retryAfter?: number;
}

export class RateLimitError extends Error {
  public readonly resetAt: number;

  constructor(resetAt: number) {
    super('Rate limit exceeded');
    this.resetAt = resetAt;
  }
}

export function sanitizeErrorMessage(text: string): string {
  if (!text) return text;
  
  return text
    .replace(/(api_key|secret|token|password|authorization)[:=\s]+\S+/gi, (match, p1) => `${p1}: [REDACTED]`)
    .replace(/process\.env\.\w+/g, '[REDACTED_ENV]')
    .substring(0, 500);
}

export const logger = {
  error: (message: string, error: any, context?: any) => {
    console.error(message, {
      ...context,
      error: error instanceof Error ? {
        message: sanitizeErrorMessage(error.message),
        name: error.name,
      } : error,
      timestamp: new Date().toISOString(),
    });
  }
};

export function handleError(error: unknown): NextResponse<ErrorResponse> {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';

  if (error instanceof RateLimitError) {
    return createRateLimitResponse(error.resetAt);
  }

  if (error instanceof ZodError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
  } else if (error instanceof Error) {
    message = error.message;
    code = 'ERROR';
    statusCode = 400;

    if (message === 'Unauthorized') {
      statusCode = 401;
      code = 'UNAUTHORIZED';
      message = 'Authentication required';
    } else if (message.startsWith('Forbidden')) {
      statusCode = 403;
      code = 'FORBIDDEN';
    } else if (message.includes('not found')) {
      statusCode = 404;
      code = 'NOT_FOUND';
    } else if (message.includes('limit reached') || message.includes('requires')) {
      statusCode = 403;
      code = 'PLAN_LIMIT_EXCEEDED';
    } else if (message.includes('AI services failed') || message.includes('failed to')) {
      statusCode = 503;
      code = 'SERVICE_ERROR';
    }
  }

  logger.error('API error occurred', error, {
    code: 'API_ERROR',
    message: sanitizeErrorMessage(error instanceof Error ? error.message : String(error)),
    status: statusCode
  });

  return NextResponse.json(
    {
      success: false,
      error: message,
      code: code,
    },
    { status: statusCode }
  );
}

export function createRateLimitResponse(retryAfter: number): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter,
    },
    {
      status: 429,
      headers: {
        'Retry-After': Math.ceil((retryAfter - Date.now()) / 1000).toString(),
      },
    }
  );
}
