import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { handleError } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    
    const { id: userId } = await params;
    const adminClient = createAdminClient();
    
    // Get user basic info
    const { data: user, error: userError } = await adminClient
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (userError || !user) {
      throw new Error('User not found');
    }
    
    // Get projects with stats
    const { data: projects } = await adminClient
      .from('projects')
      .select('id, name, created_at')
      .eq('user_id', userId);
    
    const projectsWithStats = await Promise.all(
      (projects || []).map(async (project) => {
        const { count: feedbackCount } = await adminClient
          .from('feedback_items')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', project.id)
          .is('deleted_at', null);
        
        const { count: clusterCount } = await adminClient
          .from('feedback_clusters')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', project.id);
        
        return {
          ...project,
          feedback_count: feedbackCount || 0,
          cluster_count: clusterCount || 0,
        };
      })
    );
    
    // Get subscription history
    const { data: subscriptionHistory } = await adminClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    // Get API usage breakdown
    const { data: apiUsage } = await adminClient
      .from('api_usage_logs')
      .select('service, cost_estimate')
      .eq('user_id', userId);
    
    const apiUsageBreakdown = {
      gemini: { total_spend: 0, call_count: 0 },
      deepseek: { total_spend: 0, call_count: 0 },
      firecrawl: { total_spend: 0, call_count: 0 },
    };
    
    (apiUsage || []).forEach((log) => {
      const service = log.service as 'gemini' | 'deepseek' | 'firecrawl';
      apiUsageBreakdown[service].total_spend += log.cost_estimate;
      apiUsageBreakdown[service].call_count += 1;
    });
    
    return NextResponse.json({
      success: true,
      data: {
        user,
        projects: projectsWithStats,
        subscription_history: subscriptionHistory || [],
        api_usage_breakdown: apiUsageBreakdown,
        recent_activity: user.last_active_at,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
