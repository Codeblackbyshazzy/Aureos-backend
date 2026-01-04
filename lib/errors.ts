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

export function handleError(error: unknown): NextResponse<ErrorResponse> {
  console.error('API Error:', error);

  if (error instanceof RateLimitError) {
    return createRateLimitResponse(error.resetAt);
  }

  // Validation errors
  if (error instanceof ZodError) {
    const zodError = error as ZodError;
    return NextResponse.json(
      {
        success: false,
        error: zodError.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        code: 'VALIDATION_ERROR',
      },
      { status: 400 }
    );
  }

  // Known errors with messages
  if (error instanceof Error) {
    const message = error.message;

    // Auth errors
    if (message === 'Unauthorized') {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    if (message.startsWith('Forbidden')) {
      return NextResponse.json(
        {
          success: false,
          error: message,
          code: 'FORBIDDEN',
        },
        { status: 403 }
      );
    }

    // Not found errors
    if (message.includes('not found')) {
      return NextResponse.json(
        {
          success: false,
          error: message,
          code: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // Plan limit errors
    if (message.includes('limit reached') || message.includes('requires')) {
      return NextResponse.json(
        {
          success: false,
          error: message,
          code: 'PLAN_LIMIT_EXCEEDED',
        },
        { status: 403 }
      );
    }

    // AI service errors
    if (message.includes('AI services failed') || message.includes('failed to')) {
      return NextResponse.json(
        {
          success: false,
          error: message,
          code: 'SERVICE_ERROR',
        },
        { status: 503 }
      );
    }

    // Generic error with message
    return NextResponse.json(
      {
        success: false,
        error: message,
        code: 'ERROR',
      },
      { status: 400 }
    );
  }

  // Unknown errors
  return NextResponse.json(
    {
      success: false,
      error: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
    },
    { status: 500 }
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
