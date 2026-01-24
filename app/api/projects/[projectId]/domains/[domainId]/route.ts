import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/auth';
import { getCustomDomainById, updateCustomDomainSettings, deleteCustomDomain } from '@/lib/domains';
import { handleError } from '@/lib/errors';
import { z } from 'zod';
import { UpdateCustomDomainRequest } from '@/types';

const updateDomainSchema = z.object({
  branding_settings: z.record(z.any()).optional(),
  custom_css: z.string().optional(),
  custom_js: z.string().optional()
});

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string; domainId: string } }
) {
  try {
    const { projectId, domainId } = params;
    await requireProjectAccess(request, projectId);

    const domain = await getCustomDomainById(domainId);

    return NextResponse.json({
      success: true,
      data: domain
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { projectId: string; domainId: string } }
) {
  try {
    const { projectId, domainId } = params;
    await requireProjectAccess(request, projectId);

    const body = await request.json();
    const validatedData = updateDomainSchema.parse(body) as UpdateCustomDomainRequest;

    const result = await updateCustomDomainSettings(domainId, validatedData);

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectId: string; domainId: string } }
) {
  try {
    const { projectId, domainId } = params;
    await requireProjectAccess(request, projectId);

    await deleteCustomDomain(domainId);

    return NextResponse.json({
      success: true,
      data: { message: 'Domain deleted successfully' }
    });
  } catch (error) {
    return handleError(error);
  }
}
