import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, updateLastActive } from '@/lib/auth';
import { handleError } from '@/lib/errors';
import { applyRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';
import { emailPreferencesSchema } from '@/lib/validation-phase2';
import { getEmailPreferences, updateEmailPreferences } from '@/lib/email';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const rateLimit = await applyRateLimit(user.id, user.role);

    const prefs = await getEmailPreferences(user.id);

    await updateLastActive(user.id);

    return NextResponse.json({ success: true, data: prefs }, { headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireAuth();
    const rateLimit = await applyRateLimit(user.id, user.role);

    const body = await req.json();
    const validated = emailPreferencesSchema.parse(body);

    const prefs = await updateEmailPreferences({
      userId: user.id,
      announcementsEnabled: validated.announcementsEnabled,
      feedbackEnabled: validated.feedbackEnabled,
      marketingEnabled: validated.marketingEnabled,
    });

    await updateLastActive(user.id);

    return NextResponse.json({ success: true, data: prefs }, { headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    return handleError(error);
  }
}
