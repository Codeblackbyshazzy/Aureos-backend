import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getProjectWithOwnership, checkPlanLimit } from '@/lib/project-utils';
import { handleError, createRateLimitResponse } from '@/lib/errors';
import { analyzeFeedback } from '@/lib/feedback-analysis';
import { z } from 'zod';
import { checkAnonymousRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';

const analyzeRequestSchema = z.object({
  projectId: z.string().uuid()
});

/**
 * POST /api/projects/[projectId]/analyze
 *
 * Performs automated feedback clustering, theme extraction, and roadmap prioritization
 * using AI analysis (Gemini/DeepSeek).
 *
 * @param request - Next.js request object
 * @param params - Route parameters containing projectId
 * @returns Analysis results with clusters and roadmap items
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params;

    // Auth check - user must have access to project
    const user = await requireAuth();
    const project = await getProjectWithOwnership(projectId, user.id);

    // Rate limit to 5/min per user for AI analysis (expensive operation)
    const rateLimitResult = await checkAnonymousRateLimit(user.id, 5);
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult.resetAt);
    }

    // Check plan limit for AI analysis feature
    const limitCheck = await checkPlanLimit(user.id, 'ai_analysis');
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { 
          success: false, 
          error: limitCheck.message,
          code: 'PLAN_LIMIT_EXCEEDED'
        },
        { status: 403 }
      );
    }

    // Validate request body
    const body = await request.json();
    const validatedData = analyzeRequestSchema.parse({
      ...body,
      projectId
    });

    // Perform the feedback analysis
    const analysis = await analyzeFeedback(validatedData.projectId, user.id);

    return NextResponse.json(
      {
        success: true,
        data: analysis
      },
      {
        headers: getRateLimitHeaders(rateLimitResult)
      }
    );

  } catch (error) {
    return handleError(error);
  }
}