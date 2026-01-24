import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { handleError } from '@/lib/errors';
import { analyticsQuerySchema } from '@/lib/validation';
import { ApiResponse } from '@/types';

/**
 * GET /api/projects/[projectId]/analytics/feedback
 * Get feedback-related analytics for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse<ApiResponse<{
  total_feedback: number;
  feedback_by_sentiment: Array<{
    sentiment: string;
    count: number;
    percentage: number;
  }>;
  feedback_by_source: Array<{
    source_type: string;
    count: number;
    percentage: number;
  }>;
  feedback_trends: Array<{
    date: string;
    count: number;
  }>;
  top_feedback_items: Array<{
    id: string;
    text: string;
    vote_count: number;
    created_at: string;
  }>;
}>>> {
  try {
    await requireAuth();
    
    const supabase = createServerClient();
    
    // Parse query parameters
    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    
    // Validate query parameters
    const queryParams = analyticsQuerySchema.parse({
      startDate: startDate || undefined,
      endDate: endDate || undefined
    });
    
    // Build date filter
    let dateFilter = '';
    if (queryParams.startDate && queryParams.endDate) {
      dateFilter = `AND created_at >= '${queryParams.startDate}' AND created_at <= '${queryParams.endDate}'`;
    } else if (queryParams.startDate) {
      dateFilter = `AND created_at >= '${queryParams.startDate}'`;
    } else if (queryParams.endDate) {
      dateFilter = `AND created_at <= '${queryParams.endDate}'`;
    } else {
      // Default to last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      dateFilter = `AND created_at >= '${thirtyDaysAgo.toISOString()}'`;
    }
    
    // Get total feedback count
    const { count: totalFeedback, error: feedbackError } = await supabase
      .from('feedback_items')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', params.projectId)
      .is('deleted_at', null)
      .gte('created_at', dateFilter.replace('AND ', ''));
    
    if (feedbackError) {
      return handleError(feedbackError);
    }
    
    // Get feedback by sentiment
    const { data: sentimentData, error: sentimentError } = await supabase
      .from('feedback_items')
      .select('sentiment')
      .eq('project_id', params.projectId)
      .is('deleted_at', null)
      .not('sentiment', 'is', null)
      .gte('created_at', dateFilter.replace('AND ', ''));
    
    if (sentimentError) {
      return handleError(sentimentError);
    }
    
    // Process sentiment data
    const sentimentCounts: Record<string, number> = {};
    sentimentData?.forEach(item => {
      const sentiment = item.sentiment || 'unknown';
      sentimentCounts[sentiment] = (sentimentCounts[sentiment] || 0) + 1;
    });
    
    const feedbackBySentiment = Object.entries(sentimentCounts).map(([sentiment, count]) => ({
      sentiment,
      count,
      percentage: totalFeedback ? Math.round((count / totalFeedback) * 100) : 0
    }));
    
    // Get feedback by source type
    const { data: sourceData, error: sourceError } = await supabase
      .from('feedback_items')
      .select('source_type')
      .eq('project_id', params.projectId)
      .is('deleted_at', null)
      .gte('created_at', dateFilter.replace('AND ', ''));
    
    if (sourceError) {
      return handleError(sourceError);
    }
    
    // Process source data
    const sourceCounts: Record<string, number> = {};
    sourceData?.forEach(item => {
      const source = item.source_type || 'unknown';
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    });
    
    const feedbackBySource = Object.entries(sourceCounts).map(([sourceType, count]) => ({
      source_type: sourceType,
      count,
      percentage: totalFeedback ? Math.round((count / totalFeedback) * 100) : 0
    }));
    
    // Get feedback trends (daily counts)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: trendData, error: trendError } = await supabase
      .from('feedback_items')
      .select('created_at')
      .eq('project_id', params.projectId)
      .is('deleted_at', null)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true });
    
    if (trendError) {
      return handleError(trendError);
    }
    
    // Group trend data by day
    const trendByDay: Record<string, number> = {};
    trendData?.forEach(item => {
      const date = new Date(item.created_at).toISOString().split('T')[0];
      trendByDay[date] = (trendByDay[date] || 0) + 1;
    });
    
    const feedbackTrends = Object.entries(trendByDay).map(([date, count]) => ({
      date,
      count
    }));
    
    // Get top feedback items by votes
    const { data: topFeedback, error: topFeedbackError } = await supabase
      .from('feedback_items')
      .select('id, text, vote_count, created_at')
      .eq('project_id', params.projectId)
      .is('deleted_at', null)
      .gte('created_at', dateFilter.replace('AND ', ''))
      .order('vote_count', { ascending: false })
      .limit(10);
    
    if (topFeedbackError) {
      return handleError(topFeedbackError);
    }
    
    const analytics = {
      total_feedback: totalFeedback || 0,
      feedback_by_sentiment: feedbackBySentiment,
      feedback_by_source: feedbackBySource,
      feedback_trends: feedbackTrends,
      top_feedback_items: topFeedback || []
    };
    
    return NextResponse.json({
      success: true,
      data: analytics
    });
    
  } catch (error) {
    return handleError(error);
  }
}