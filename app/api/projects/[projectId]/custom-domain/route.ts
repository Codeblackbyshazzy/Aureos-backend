import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/auth';
import { addCustomDomain, getCustomDomain, validateDomain } from '@/lib/domains';
import { handleError } from '@/lib/errors';
import { z } from 'zod';
import { CustomDomainRequest } from '@/types';

const customDomainSchema = z.object({
  domain: z.string().min(1).max(255)
});

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params;
    const user = await requireProjectAccess(request, projectId);

    const body = await request.json();
    const validatedData = customDomainSchema.parse(body) as CustomDomainRequest;

    // Validate domain format
    const domainValidation = validateDomain(validatedData.domain);
    if (!domainValidation.valid) {
      return NextResponse.json(
        { success: false, error: domainValidation.error },
        { status: 400 }
      );
    }

    const result = await addCustomDomain(projectId, validatedData.domain);

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Custom domain added. Please verify DNS records to complete setup.'
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
    const user = await requireProjectAccess(request, projectId);

    const domain = await getCustomDomain(projectId);

    return NextResponse.json({
      success: true,
      data: domain
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params;
    const user = await requireProjectAccess(request, projectId);

    const { removeCustomDomain } = await import('@/lib/domains');
    await removeCustomDomain(projectId);

    return NextResponse.json({
      success: true,
      data: { message: 'Custom domain removed successfully' }
    });
  } catch (error) {
    return handleError(error);
  }
}