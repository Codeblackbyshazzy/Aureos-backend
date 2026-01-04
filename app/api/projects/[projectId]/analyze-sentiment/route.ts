import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/auth';
import { batchAnalyzeSentiment } from '@/lib/sentiment';
import { handleError } from '@/lib/errors';
import { z } from 'zod';
import { SentimentAnalysisRequest } from '@/types';
import { checkPlanLimit } from '@/lib/project-utils';

const sentimentAnalysisSchema = z.object({
  feedback_ids: z.array(z.string().uuid()).min(1).max(100)
});

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params;
    const user = await requireProjectAccess(request, projectId);

    // Check if AI analysis is allowed for this plan
    const limitCheck = await checkPlanLimit(user.userId, 'ai_analysis');
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { success: false, error: limitCheck.message },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = sentimentAnalysisSchema.parse(body) as SentimentAnalysisRequest;

    const results = await batchAnalyzeSentiment(validatedData.feedback_ids);

    return NextResponse.json({
      success: true,
      data: {
        analyses: results,
        processed_count: results.length
      }
    });
  } catch (error) {
    return handleError(error);
  }
}