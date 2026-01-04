import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, updateLastActive } from '@/lib/auth';
import { handleError } from '@/lib/errors';
import { applyRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';
import { subscribeToAnnouncementsSchema } from '@/lib/validation-phase2';
import { getAnnouncement, setAnnouncementSubscription } from '@/lib/announcements';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; announcementId: string }> }
) {
  try {
    const { id: projectId, announcementId } = await params;
    const user = await requireAuth();

    const rateLimit = await applyRateLimit(user.id, user.role);

    const body = await req.json();
    const validated = subscribeToAnnouncementsSchema.parse(body);

    // Ensure announcement exists
    await getAnnouncement({ projectId, announcementId });

    const result = await setAnnouncementSubscription({
      projectId,
      userId: user.id,
      subscribed: validated.subscribed,
    });

    await updateLastActive(user.id);

    return NextResponse.json({ success: true, data: result }, { headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    return handleError(error);
  }
}
