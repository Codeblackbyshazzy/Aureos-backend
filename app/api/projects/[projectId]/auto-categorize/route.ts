import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/auth';
import { autoCategorizeFeedback } from '@/lib/auto-categorize';
import { handleError } from '@/lib/errors';
import { z } from 'zod';
import { AutoCategorizeRequest } from '@/types';
import { checkPlanLimit } from '@/lib/project-utils';

const autoCategorizeSchema = z.object({
  feedback_ids: z.array(z.string().uuid()).min(1).max(50)
});

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params;
    const user = await requireProjectAccess(request, projectId);

    // Check if AI categorization is allowed for this plan
    const limitCheck = await checkPlanLimit(user.userId, 'ai_analysis');
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { success: false, error: limitCheck.message },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = autoCategorizeSchema.parse(body) as AutoCategorizeRequest;

    const results = await autoCategorizeFeedback(validatedData.feedback_ids, projectId);

    return NextResponse.json({
      success: true,
      data: {
        categorizations: results,
        processed_count: results.length
      }
    });
  } catch (error) {
    return handleError(error);
  }
}