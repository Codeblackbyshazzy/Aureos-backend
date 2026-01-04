import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/auth';
import { verifyDomain } from '@/lib/domains';
import { handleError } from '@/lib/errors';
import { z } from 'zod';
import { VerifyDomainRequest } from '@/types';

const verifyDomainSchema = z.object({
  verification_token: z.string().min(1)
});

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params;
    const user = await requireProjectAccess(request, projectId);

    const body = await request.json();
    const validatedData = verifyDomainSchema.parse(body) as VerifyDomainRequest;

    const result = await verifyDomain(projectId, validatedData.verification_token);

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Domain verified successfully! Your custom domain is now active.'
    });
  } catch (error) {
    return handleError(error);
  }
}