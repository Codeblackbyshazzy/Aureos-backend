import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '@/lib/errors';
import { applyAnonymousRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';
import { getClientIdentifier } from '@/lib/request-utils';
import { verifyGuestTokenSchema } from '@/lib/validation-phase2';
import { verifyGuestToken } from '@/lib/guest-auth';

export async function POST(req: NextRequest) {
  try {
    const rateLimit = applyAnonymousRateLimit(getClientIdentifier(req), 60);

    const body = await req.json();
    const validated = verifyGuestTokenSchema.parse(body);

    const result = await verifyGuestToken(validated.token);

    return NextResponse.json(
      {
        success: true,
        data: {
          projectId: result.session.project_id,
          sessionId: result.session.id,
          permissions: result.session.permissions,
          expiresAt: result.session.expires_at,
        },
      },
      { headers: getRateLimitHeaders(rateLimit) }
    );
  } catch (error) {
    return handleError(error);
  }
}
