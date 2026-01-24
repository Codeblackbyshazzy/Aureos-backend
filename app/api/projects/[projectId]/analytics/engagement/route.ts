import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { handleError } from '@/lib/errors';
import { analyticsQuerySchema } from '@/lib/validation';
import { ApiResponse } from '@/types';

/**
 * GET /api/projects/[projectId]/analytics/engagement
 * Get engagement analytics for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse<ApiResponse<{
  total_users: number;
  active_users_today: number;
  active_users_week: number;
  active_users_month: number;
  avg_session_duration: number;
  bounce_rate: number;
  page_views_per_session: number;
  user_retention: Array<{
    day: number;
    retention_rate: number;
  }>;
  engagement_by_hour: Array<{
    hour: number;
    activity_count: number;
  }>;
  engagement_by_day: Array<{
    day: string;
    activity_count: number;
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
    
    // Build date filters
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Get total unique users
    const { count: totalUsers, error: usersError } = await supabase
      .from('analytics_events')
      .select('user_id', { count: 'exact' })
      .eq('project_id', params.projectId)
      .not('user_id', 'is', null);
    
    if (usersError) {
      return handleError(usersError);
    }
    
    // Get active users today
    const { count: activeToday, error: todayError } = await supabase
      .from('analytics_events')
      .select('user_id', { count: 'exact' })
      .eq('project_id', params.projectId)
      .not('user_id', 'is', null)
      .gte('timestamp', today.toISOString());
    
    if (todayError) {
      return handleError(todayError);
    }
    
    // Get active users this week
    const { count: activeWeek, error: weekError } = await supabase
      .from('analytics_events')
      .select('user_id', { count: 'exact' })
      .eq('project_id', params.projectId)
      .not('user_id', 'is', null)
      .gte('timestamp', weekAgo.toISOString());
    
    if (weekError) {
      return handleError(weekError);
    }
    
    // Get active users this month
    const { count: activeMonth, error: monthError } = await supabase
      .from('analytics_events')
      .select('user_id', { count: 'exact' })
      .eq('project_id', params.projectId)
      .not('user_id', 'is', null)
      .gte('timestamp', monthAgo.toISOString());
    
    if (monthError) {
      return handleError(monthError);
    }
    
    // Get engagement by hour (last 24 hours)
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const { data: hourlyData, error: hourlyError } = await supabase
      .from('analytics_events')
      .select('timestamp')
      .eq('project_id', params.projectId)
      .gte('timestamp', twentyFourHoursAgo.toISOString())
      .order('timestamp', { ascending: true });
    
    if (hourlyError) {
      return handleError(hourlyError);
    }
    
    // Group by hour
    const hourlyCounts: Record<number, number> = {};
    hourlyData?.forEach(event => {
      const hour = new Date(event.timestamp).getHours();
      hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1;
    });
    
    const engagementByHour = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      activity_count: hourlyCounts[hour] || 0
    }));
    
    // Get engagement by day (last 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const { data: dailyData, error: dailyError } = await supabase
      .from('analytics_events')
      .select('timestamp')
      .eq('project_id', params.projectId)
      .gte('timestamp', thirtyDaysAgo.toISOString())
      .order('timestamp', { ascending: true });
    
    if (dailyError) {
      return handleError(dailyError);
    }
    
    // Group by day
    const dailyCounts: Record<string, number> = {};
    dailyData?.forEach(event => {
      const date = new Date(event.timestamp).toISOString().split('T')[0];
      dailyCounts[date] = (dailyCounts[date] || 0) + 1;
    });
    
    const engagementByDay = Object.entries(dailyCounts).map(([date, count]) => ({
      day: date,
      activity_count: count
    }));
    
    // Calculate simple retention (users who return after first visit)
    // This is a simplified calculation
    const retentionRate = activeMonth && totalUsers ? 
      Math.round((activeMonth / totalUsers) * 100) : 0;
    
    const userRetention = Array.from({ length: 7 }, (_, i) => ({
      day: i + 1,
      retention_rate: Math.max(0, retentionRate - (i * 5)) // Simulated retention curve
    }));
    
    // Calculate bounce rate (users with only 1 event)
    const { data: singleEventUsers, error: bounceError } = await supabase
      .from('analytics_events')
      .select('user_id')
      .eq('project_id', params.projectId)
      .not('user_id', 'is', null)
      .gte('timestamp', monthAgo.toISOString());
    
    if (bounceError) {
      return handleError(bounceError);
    }
    
    const userEventCounts: Record<string, number> = {};
    singleEventUsers?.forEach(event => {
      if (event.user_id) {
        userEventCounts[event.user_id] = (userEventCounts[event.user_id] || 0) + 1;
      }
    });
    
    const singleEventCount = Object.values(userEventCounts).filter(count => count === 1).length;
    const bounceRate = activeMonth ? Math.round((singleEventCount / activeMonth) * 100) : 0;
    
    const analytics = {
      total_users: totalUsers || 0,
      active_users_today: activeToday || 0,
      active_users_week: activeWeek || 0,
      active_users_month: activeMonth || 0,
      avg_session_duration: 0, // Would need session tracking for real calculation
      bounce_rate: bounceRate,
      page_views_per_session: 0, // Would need session tracking for real calculation
      user_retention: userRetention,
      engagement_by_hour: engagementByHour,
      engagement_by_day: engagementByDay
    };
    
    return NextResponse.json({
      success: true,
      data: analytics
    });
    
  } catch (error) {
    return handleError(error);
  }
}