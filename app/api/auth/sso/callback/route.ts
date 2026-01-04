import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '@/lib/errors';
import { applyAnonymousRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';
import { getClientIdentifier } from '@/lib/request-utils';
import { ssoCallbackSchema } from '@/lib/validation-phase2';
import { handleSsoCallback } from '@/lib/sso';

export async function POST(req: NextRequest) {
  try {
    const rateLimit = applyAnonymousRateLimit(getClientIdentifier(req), 30);

    const body = await req.json();
    const validated = ssoCallbackSchema.parse(body);

    const result = await handleSsoCallback({
      projectId: validated.projectId,
      state: validated.state,
      providerType: validated.providerType,
      code: validated.code,
      idToken: validated.idToken,
      email: validated.email,
      externalUserId: validated.externalUserId,
    });

    return NextResponse.json({ success: true, data: result }, { headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    return handleError(error);
  }
}
