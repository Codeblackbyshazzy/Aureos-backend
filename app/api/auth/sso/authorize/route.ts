import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '@/lib/errors';
import { applyAnonymousRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';
import { getClientIdentifier } from '@/lib/request-utils';
import { ssoAuthorizeSchema } from '@/lib/validation-phase2';
import { createSsoAuthorization } from '@/lib/sso';

export async function POST(req: NextRequest) {
  try {
    const rateLimit = applyAnonymousRateLimit(getClientIdentifier(req), 30);

    const body = await req.json();
    const validated = ssoAuthorizeSchema.parse(body);

    const result = await createSsoAuthorization(validated.projectId);

    return NextResponse.json({ success: true, data: result }, { headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    return handleError(error);
  }
}
