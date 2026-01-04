import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getProjectWithOwnership, requirePaidPlan } from '@/lib/project-utils';
import { createAdminClient } from '@/lib/supabase';
import { prioritizeClustersWithFallback } from '@/lib/ai-services';
import { logApiUsage } from '@/lib/usage-logger';
import { prioritizeClustersSchema } from '@/lib/validation';
import { handleError } from '@/lib/errors';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const user = await requireAuth();
    const project = await getProjectWithOwnership(projectId, user.id);
    
    // Require paid plan for AI prioritization
    requirePaidPlan(project.plan);
    
    const body = await req.json();
    const validated = prioritizeClustersSchema.parse(body);
    
    const adminClient = createAdminClient();
    
    // Fetch clusters
    let queryBuilder = adminClient
      .from('feedback_clusters')
      .select('id, name, description, feedback_count')
      .eq('project_id', projectId);
    
    if (validated.clusterIds && validated.clusterIds.length > 0) {
      queryBuilder = queryBuilder.in('id', validated.clusterIds);
    }
    
    const { data: clusters, error: fetchError } = await queryBuilder;
    
    if (fetchError || !clusters || clusters.length === 0) {
      throw new Error('No clusters found to prioritize');
    }
    
    // Call AI service with fallback
    const result = await prioritizeClustersWithFallback(
      clusters.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        feedbackCount: c.feedback_count,
      }))
    );
    
    // Update clusters with priority scores
    const updates = result.priorities.map(priority => ({
      id: priority.clusterId,
      priority_score: priority.score,
    }));
    
    for (const update of updates) {
      await adminClient
        .from('feedback_clusters')
        .update({ priority_score: update.priority_score })
        .eq('id', update.id);
    }
    
    // Fetch updated clusters
    const { data: updatedClusters } = await adminClient
      .from('feedback_clusters')
      .select('*')
      .in('id', updates.map(u => u.id))
      .order('priority_score', { ascending: false });
    
    // Log API usage
    await logApiUsage({
      userId: user.id,
      projectId,
      service: result.service,
      tokensOrCredits: (result.inputTokens || 0) + (result.outputTokens || 0) + (result.totalTokens || 0),
      endpoint: '/api/projects/[id]/prioritize',
      metadata: {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalTokens: result.totalTokens,
        clusterCount: updates.length,
      },
    });
    
    return NextResponse.json({
      success: true,
      data: {
        clusters: updatedClusters,
        priorities: result.priorities,
        service: result.service,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
