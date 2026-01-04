import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, updateLastActive } from '@/lib/auth';
import { getProjectWithAccess } from '@/lib/project-utils';
import { handleError } from '@/lib/errors';
import { applyRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';
import { configureSsoSchema } from '@/lib/validation-phase2';
import { upsertSsoConfiguration } from '@/lib/sso';

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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const user = await requireAuth();
    const project = await getProjectWithAccess(projectId, { id: user.id, role: user.role });

    const rateLimit = await applyRateLimit(user.id, user.role, project.plan);

    const body = await req.json();
    const validated = configureSsoSchema.parse(body);

    const config = await upsertSsoConfiguration({
      projectId,
      userId: user.id,
      providerType: validated.providerType,
      name: validated.name,
      enabled: validated.enabled,
      attributeMapping: validated.attributeMapping,
      oidc:
        validated.providerType === 'oidc'
          ? {
              issuerUrl: validated.oidc!.issuerUrl,
              clientId: validated.oidc!.clientId,
              clientSecret: validated.oidc!.clientSecret,
              redirectUrl: validated.oidc!.redirectUrl,
              scopes: validated.oidc!.scopes ?? ['openid', 'email', 'profile'],
            }
          : undefined,
      saml:
        validated.providerType === 'saml'
          ? {
              entityId: validated.saml!.entityId,
              ssoUrl: validated.saml!.ssoUrl,
              certificate: validated.saml!.certificate,
            }
          : undefined,
    });

    await updateLastActive(user.id);

    return NextResponse.json(
      { success: true, data: sanitizeSsoConfig(config as unknown as Record<string, unknown>) },
      { headers: getRateLimitHeaders(rateLimit) }
    );
  } catch (error) {
    return handleError(error);
  }
}
