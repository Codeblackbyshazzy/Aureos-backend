import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  retryAfter?: number;
}

export function handleError(error: unknown): NextResponse<ErrorResponse> {
  console.error('API Error:', error);

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
