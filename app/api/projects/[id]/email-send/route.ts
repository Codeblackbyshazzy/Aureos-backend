import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, updateLastActive } from '@/lib/auth';
import { getProjectWithAccess } from '@/lib/project-utils';
import { handleError } from '@/lib/errors';
import { applyRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';
import { sendEmailSchema } from '@/lib/validation-phase2';
import { sendEmail } from '@/lib/email';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const user = await requireAuth();
    const project = await getProjectWithAccess(projectId, { id: user.id, role: user.role });

    // Rate limit: uses the standard per-plan limiter.
    const rateLimit = await applyRateLimit(user.id, user.role, project.plan);

    const body = await req.json();
    const validated = sendEmailSchema.parse(body);

    const result = await sendEmail({
      projectId,
      templateId: validated.templateId,
      to: validated.to,
      subject: validated.subject,
      html: validated.html,
      text: validated.text,
      variables: validated.variables,
    });

    await updateLastActive(user.id);

    return NextResponse.json({ success: true, data: result }, { headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    return handleError(error);
  }
}
