import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, updateLastActive } from '@/lib/auth';
import { handleError } from '@/lib/errors';
import { applyRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';
import { ssoLogoutSchema } from '@/lib/validation-phase2';
import { revokeSsoSession } from '@/lib/sso';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const rateLimit = await applyRateLimit(user.id, user.role);

    const body = await req.json();
    const validated = ssoLogoutSchema.parse(body);

    await revokeSsoSession(validated.sessionId);
    await updateLastActive(user.id);

    return NextResponse.json(
      { success: true, data: { message: 'Logged out' } },
      { headers: getRateLimitHeaders(rateLimit) }
    );
  } catch (error) {
    return handleError(error);
  }
}
