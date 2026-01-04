import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getProjectWithOwnership, requirePaidPlan } from '@/lib/project-utils';
import { createAdminClient } from '@/lib/supabase';
import { clusterFeedbackWithFallback } from '@/lib/ai-services';
import { logApiUsage } from '@/lib/usage-logger';
import { handleError } from '@/lib/errors';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const user = await requireAuth();
    const project = await getProjectWithOwnership(projectId, user.id);
    
    // Require paid plan for AI clustering
    requirePaidPlan(project.plan);
    
    const adminClient = createAdminClient();
    
    // Fetch all non-deleted feedback for the project
    const { data: feedbackItems, error: fetchError } = await adminClient
      .from('feedback_items')
      .select('id, text')
      .eq('project_id', projectId)
      .is('deleted_at', null);
    
    if (fetchError || !feedbackItems || feedbackItems.length === 0) {
      throw new Error('No feedback items found to cluster');
    }
    
    // Call AI service with fallback
    const result = await clusterFeedbackWithFallback(feedbackItems);
    
    // Create cluster records
    const clustersToInsert = result.clusters.map(cluster => ({
      project_id: projectId,
      name: cluster.name,
      description: cluster.description,
      feedback_count: cluster.feedbackIds.length,
    }));
    
    const { data: createdClusters, error: insertError } = await adminClient
      .from('feedback_clusters')
      .insert(clustersToInsert)
      .select();
    
    if (insertError || !createdClusters) {
      throw new Error('Failed to create clusters');
    }
    
    // Create cluster-feedback relationships
    const relationships = [];
    for (let i = 0; i < result.clusters.length; i++) {
      const cluster = result.clusters[i];
      const createdCluster = createdClusters[i];
      
      for (const feedbackId of cluster.feedbackIds) {
        relationships.push({
          cluster_id: createdCluster.id,
          feedback_id: feedbackId,
        });
      }
    }
    
    if (relationships.length > 0) {
      await adminClient
        .from('cluster_feedback_items')
        .insert(relationships);
    }
    
    // Log API usage
    await logApiUsage({
      userId: user.id,
      projectId,
      service: result.service,
      tokensOrCredits: (result.inputTokens || 0) + (result.outputTokens || 0) + (result.totalTokens || 0),
      endpoint: '/api/projects/[id]/cluster',
      metadata: {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalTokens: result.totalTokens,
        clusterCount: createdClusters.length,
      },
    });
    
    return NextResponse.json({
      success: true,
      data: {
        clusters: createdClusters,
        service: result.service,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
