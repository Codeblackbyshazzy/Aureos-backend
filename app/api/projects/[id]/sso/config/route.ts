import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, updateLastActive } from '@/lib/auth';
import { getProjectWithAccess } from '@/lib/project-utils';
import { handleError } from '@/lib/errors';
import { applyRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';
import { getSsoConfiguration } from '@/lib/sso';

function sanitizeSsoConfig(config: Record<string, unknown>): Record<string, unknown> {
  const providerType = config.provider_type;

  if (providerType === 'oidc') {
    return {
      ...config,
      oidc_client_secret: null,
      has_client_secret: Boolean(config.oidc_client_secret),
    };
  }

  return config;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const user = await requireAuth();
    const project = await getProjectWithAccess(projectId, { id: user.id, role: user.role });

    const rateLimit = await applyRateLimit(user.id, user.role, project.plan);

    const config = await getSsoConfiguration(projectId);

    await updateLastActive(user.id);

    return NextResponse.json(
      { success: true, data: sanitizeSsoConfig(config as unknown as Record<string, unknown>) },
      { headers: getRateLimitHeaders(rateLimit) }
    );
  } catch (error) {
    return handleError(error);
  }
}
