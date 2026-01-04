import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, updateLastActive } from '@/lib/auth';
import { getProjectWithAccess } from '@/lib/project-utils';
import { handleError } from '@/lib/errors';
import { applyRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';
import { createEmailTemplateSchema } from '@/lib/validation-phase2';
import { createEmailTemplate, listEmailTemplates } from '@/lib/email';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const user = await requireAuth();
    const project = await getProjectWithAccess(projectId, { id: user.id, role: user.role });

    const rateLimit = await applyRateLimit(user.id, user.role, project.plan);

    const body = await req.json();
    const validated = createEmailTemplateSchema.parse(body);

    const template = await createEmailTemplate({
      projectId,
      userId: user.id,
      name: validated.name,
      subject: validated.subject,
      bodyHtml: validated.bodyHtml ?? null,
      bodyText: validated.bodyText ?? null,
    });

    await updateLastActive(user.id);

    return NextResponse.json({ success: true, data: template }, { headers: getRateLimitHeaders(rateLimit) });
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

    const templates = await listEmailTemplates(projectId);

    await updateLastActive(user.id);

    return NextResponse.json({ success: true, data: templates }, { headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    return handleError(error);
  }
}
