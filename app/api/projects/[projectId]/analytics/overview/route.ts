import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { handleError } from '@/lib/errors';
import { analyticsQuerySchema } from '@/lib/validation';
import { AnalyticsOverview, ApiResponse } from '@/types';

/**
 * GET /api/projects/[projectId]/analytics/overview
 * Get overview analytics for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse<ApiResponse<AnalyticsOverview>>> {
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
      dateFilter = `AND timestamp >= '${queryParams.startDate}' AND timestamp <= '${queryParams.endDate}'`;
    } else if (queryParams.startDate) {
      dateFilter = `AND timestamp >= '${queryParams.startDate}'`;
    } else if (queryParams.endDate) {
      dateFilter = `AND timestamp <= '${queryParams.endDate}'`;
    } else {
      // Default to last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      dateFilter = `AND timestamp >= '${thirtyDaysAgo.toISOString()}'`;
    }
    
    // Get total events count
    const { count: totalEvents, error: eventsError } = await supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', params.projectId)
      .gte('timestamp', dateFilter.replace('AND ', ''));
    
    if (eventsError) {
      return handleError(eventsError);
    }
    
    // Get unique users count
    const { count: uniqueUsers, error: usersError } = await supabase
      .from('analytics_events')
      .select('user_id', { count: 'exact' })
      .eq('project_id', params.projectId)
      .gte('timestamp', dateFilter.replace('AND ', ''))
      .not('user_id', 'is', null);
    
    if (usersError) {
      return handleError(usersError);
    }
    
    // Get page views (events with page_view event type)
    const { count: pageViews, error: pageViewsError } = await supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', params.projectId)
      .eq('event_type', 'page_view')
      .gte('timestamp', dateFilter.replace('AND ', ''));
    
    if (pageViewsError) {
      return handleError(pageViewsError);
    }
    
    // Get feedback created count
    const { count: feedbackCreated, error: feedbackError } = await supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', params.projectId)
      .eq('event_name', 'feedback_created')
      .gte('timestamp', dateFilter.replace('AND ', ''));
    
    if (feedbackError) {
      return handleError(feedbackError);
    }
    
    // Get top events
    const { data: topEventsData, error: topEventsError } = await supabase
      .from('analytics_events')
      .select('event_name')
      .eq('project_id', params.projectId)
      .gte('timestamp', dateFilter.replace('AND ', ''))
      .group('event_name')
      .order('count', { ascending: false })
      .limit(10);
    
    if (topEventsError) {
      return handleError(topEventsError);
    }
    
    // Format top events
    const topEvents = topEventsData?.map(item => ({
      event_name: item.event_name,
      count: item.count || 0
    })) || [];
    
    // Calculate engagement rate (feedback_created / total_events * 100)
    const engagementRate = totalEvents && totalEvents > 0 
      ? Math.round((feedbackCreated || 0) / totalEvents * 100) 
      : 0;
    
    // Get trend data for the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data: trendData, error: trendError } = await supabase
      .from('analytics_events')
      .select('timestamp')
      .eq('project_id', params.projectId)
      .gte('timestamp', sevenDaysAgo.toISOString())
      .order('timestamp', { ascending: true });
    
    if (trendError) {
      return handleError(trendError);
    }
    
    // Group trend data by day
    const trendByDay: Record<string, number> = {};
    trendData?.forEach(event => {
      const date = new Date(event.timestamp).toISOString().split('T')[0];
      trendByDay[date] = (trendByDay[date] || 0) + 1;
    });
    
    const trendArray = Object.entries(trendByDay).map(([date, value]) => ({
      date,
      value
    }));
    
    const overview: AnalyticsOverview = {
      total_events: totalEvents || 0,
      unique_users: uniqueUsers || 0,
      page_views: pageViews || 0,
      feedback_created: feedbackCreated || 0,
      engagement_rate: engagementRate,
      top_events: topEvents,
      trend_data: trendArray
    };
    
    return NextResponse.json({
      success: true,
      data: overview
    });
    
  } catch (error) {
    return handleError(error);
  }
}