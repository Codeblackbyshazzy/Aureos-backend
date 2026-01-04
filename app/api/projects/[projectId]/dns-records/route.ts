import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/auth';
import { getDNSRecords } from '@/lib/domains';
import { handleError } from '@/lib/errors';

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params;
    const user = await requireProjectAccess(request, projectId);

    const dnsRecords = await getDNSRecords(projectId);

    return NextResponse.json({
      success: true,
      data: dnsRecords
    });
  } catch (error) {
    return handleError(error);
  }
}