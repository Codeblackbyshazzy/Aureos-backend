import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, updateLastActive } from '@/lib/auth';
import { getProjectWithAccess } from '@/lib/project-utils';
import { handleError } from '@/lib/errors';
import { applyRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';
import { createGuestAccessSchema } from '@/lib/validation-phase2';
import { createGuestAccessToken, listGuestSessions } from '@/lib/guest-auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const user = await requireAuth();
    const project = await getProjectWithAccess(projectId, { id: user.id, role: user.role });

    const rateLimit = await applyRateLimit(user.id, user.role, project.plan);

    const body = await req.json();
    const validated = createGuestAccessSchema.parse(body);

    const expiresAtIso = validated.expiresAt
      ? new Date(validated.expiresAt).toISOString()
      : new Date(Date.now() + validated.expiresInMinutes! * 60 * 1000).toISOString();

    const result = await createGuestAccessToken({
      projectId,
      createdBy: user.id,
      permissions: validated.permissions,
      oneTime: validated.oneTime,
      expiresAtIso,
    });

    await updateLastActive(user.id);

    return NextResponse.json({ success: true, data: result }, { headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    return handleError(error);
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const user = await requireAuth();
    const project = await getProjectWithAccess(projectId, { id: user.id, role: user.role });

    const rateLimit = await applyRateLimit(user.id, user.role, project.plan);

    const sessions = await listGuestSessions(projectId);

    await updateLastActive(user.id);

    return NextResponse.json({ success: true, data: sessions }, { headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    return handleError(error);
  }
}
