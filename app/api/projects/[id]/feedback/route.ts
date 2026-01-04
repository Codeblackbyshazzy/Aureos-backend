import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, updateLastActive } from '@/lib/auth';
import { getProjectWithOwnership, checkFeedbackLimit } from '@/lib/project-utils';
import { createAdminClient } from '@/lib/supabase';
import { createFeedbackSchema, feedbackQuerySchema } from '@/lib/validation';
import { handleError, createRateLimitResponse } from '@/lib/errors';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const user = await requireAuth();
    const project = await getProjectWithOwnership(projectId, user.id);
    
    // Rate limiting
    const rateLimitResult = checkRateLimit(user.id, project.plan);
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult.resetAt);
    }
    
    // Check feedback limit for plan
    await checkFeedbackLimit(projectId, project.plan);
    
    const body = await req.json();
    const validated = createFeedbackSchema.parse(body);
    
    const adminClient = createAdminClient();
    
    const { data: feedback, error } = await adminClient
      .from('feedback_items')
      .insert({
        project_id: projectId,
        text: validated.text,
        source_type: validated.sourceType || 'manual',
        source_url: validated.sourceUrl || null,
      })
      .select()
      .single();
    
    if (error) {
      throw new Error('Failed to create feedback item');
    }
    
    await updateLastActive(user.id);
    
    return NextResponse.json(
      {
        success: true,
        data: feedback,
      },
      { headers: getRateLimitHeaders(rateLimitResult) }
    );
  } catch (error) {
    return handleError(error);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const user = await requireAuth();
    await getProjectWithOwnership(projectId, user.id);
    
    const { searchParams } = new URL(req.url);
    const query = feedbackQuerySchema.parse({
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
      sentiment: searchParams.get('sentiment') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    });
    
    const adminClient = createAdminClient();
    
    let queryBuilder = adminClient
      .from('feedback_items')
      .select('*', { count: 'exact' })
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    
    if (query.sentiment) {
      queryBuilder = queryBuilder.eq('sentiment', query.sentiment);
    }
    
    if (query.startDate) {
      queryBuilder = queryBuilder.gte('created_at', query.startDate);
    }
    
    if (query.endDate) {
      queryBuilder = queryBuilder.lte('created_at', query.endDate);
    }
    
    const offset = (query.page - 1) * query.limit;
    queryBuilder = queryBuilder.range(offset, offset + query.limit - 1);
    
    const { data: feedback, count, error } = await queryBuilder;
    
    if (error) {
      throw new Error('Failed to fetch feedback');
    }
    
    await updateLastActive(user.id);
    
    return NextResponse.json({
      success: true,
      data: {
        data: feedback || [],
        total: count || 0,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil((count || 0) / query.limit),
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
