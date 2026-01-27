import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { sanitizeForLog } from '@/lib/sanitizer';

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

export function handleError(error: unknown): NextResponse<ErrorResponse> {
  // Sanitize error message before logging
  let sanitizedMessage = '';
  
  if (error instanceof Error) {
    sanitizedMessage = sanitizeForLog(error.message);
  } else {
    sanitizedMessage = sanitizeForLog(String(error));
  }
  
  console.error('API error', {
    message: sanitizedMessage,
    code: 'API_ERROR',
    timestamp: new Date().toISOString(),
  });
  
  // Don't expose internal errors to client
  if (error instanceof ZodError) {
    return NextResponse.json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
    }, { status: 400 });
  }
  
  if (error instanceof RateLimitError) {
    return createRateLimitResponse(error.resetAt);
  }

  // Handle specific safe errors if needed, but the requirement says generic error
  if (error instanceof Error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      }, { status: 401 });
    }
    if (error.message.startsWith('Forbidden')) {
      return NextResponse.json({
        success: false,
        error: 'Access denied',
        code: 'FORBIDDEN',
      }, { status: 403 });
    }
    if (error.message.includes('not found')) {
      return NextResponse.json({
        success: false,
        error: 'Resource not found',
        code: 'NOT_FOUND',
      }, { status: 404 });
    }
  }
  
  // Generic error (never expose details)
  return NextResponse.json({
    success: false,
    error: 'An error occurred. Please try again.',
    code: 'INTERNAL_ERROR',
  }, { status: 500 });
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
