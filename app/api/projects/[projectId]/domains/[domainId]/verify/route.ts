import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/auth';
import { verifyCustomDomain } from '@/lib/domains';
import { handleError } from '@/lib/errors';

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string; domainId: string } }
) {
  try {
    const { projectId, domainId } = params;
    await requireProjectAccess(request, projectId);

    const result = await verifyCustomDomain(domainId);

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    return handleError(error);
  }
}
