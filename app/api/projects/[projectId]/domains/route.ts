import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/auth';
import { createCustomDomain, getCustomDomains, validateDomain } from '@/lib/domains';
import { handleError } from '@/lib/errors';
import { z } from 'zod';
import { CreateCustomDomainRequest } from '@/types';

const createDomainSchema = z.object({
  domain: z.string().min(1).max(255),
  verification_method: z.enum(['dns-txt', 'dns-cname', 'http']).optional()
});

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params;
    await requireProjectAccess(request, projectId);

    const body = await request.json();
    const validatedData = createDomainSchema.parse(body) as CreateCustomDomainRequest;

    const validation = validateDomain(validatedData.domain);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const domain = await createCustomDomain(
      projectId,
      validatedData.domain,
      validatedData.verification_method
    );

    return NextResponse.json({
      success: true,
      data: domain
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params;
    await requireProjectAccess(request, projectId);

    const domains = await getCustomDomains(projectId);

    return NextResponse.json({
      success: true,
      data: domains
    });
  } catch (error) {
    return handleError(error);
  }
}
