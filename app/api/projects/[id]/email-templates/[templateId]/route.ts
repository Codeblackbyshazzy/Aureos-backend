import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, updateLastActive } from '@/lib/auth';
import { getProjectWithAccess } from '@/lib/project-utils';
import { handleError } from '@/lib/errors';
import { applyRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';
import { updateEmailTemplateSchema } from '@/lib/validation-phase2';
import { updateEmailTemplate } from '@/lib/email';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string }> }
) {
  try {
    const { id: projectId, templateId } = await params;
    const user = await requireAuth();
    const project = await getProjectWithAccess(projectId, { id: user.id, role: user.role });

    const rateLimit = await applyRateLimit(user.id, user.role, project.plan);

    const body = await req.json();
    const validated = updateEmailTemplateSchema.parse(body);

    const template = await updateEmailTemplate({
      projectId,
      templateId,
      userId: user.id,
      name: validated.name,
      subject: validated.subject,
      bodyHtml: validated.bodyHtml === undefined ? undefined : validated.bodyHtml,
      bodyText: validated.bodyText === undefined ? undefined : validated.bodyText,
    });

    await updateLastActive(user.id);

    return NextResponse.json({ success: true, data: template }, { headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    return handleError(error);
  }
}
