import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { handleError } from '@/lib/errors';
import { analyticsQuerySchema } from '@/lib/validation';
import { ApiResponse } from '@/types';

/**
 * GET /api/projects/[projectId]/analytics/compare
 * Compare analytics between different time periods or projects
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse<ApiResponse<{
  comparison_type: 'time_periods' | 'projects';
  period_1: {
    start_date: string;
    end_date: string;
    metrics: {
      total_feedback: number;
      total_events: number;
      unique_users: number;
      engagement_rate: number;
    };
  };
  period_2?: {
    start_date: string;
    end_date: string;
    metrics: {
      total_feedback: number;
      total_events: number;
      unique_users: number;
      engagement_rate: number;
    };
  };
  comparison_project?: {
    project_id: string;
    metrics: {
      total_feedback: number;
      total_events: number;
      unique_users: number;
      engagement_rate: number;
    };
  };
  insights: Array<{
    metric: string;
    change_type: 'increase' | 'decrease' | 'no_change';
    change_percentage: number;
    description: string;
  }>;
}>>> {
  try {
    await requireAuth();
    
    const supabase = createServerClient();
    
    // Parse query parameters
    const url = new URL(request.url);
    const comparisonType = url.searchParams.get('type') || 'time_periods';
    const period1Start = url.searchParams.get('period1_start');
    const period1End = url.searchParams.get('period1_end');
    const period2Start = url.searchParams.get('period2_start');
    const period2End = url.searchParams.get('period2_end');
    const comparisonProjectId = url.searchParams.get('project_id');
    
    // Validate query parameters
    const queryParams = analyticsQuerySchema.parse({
      metric: comparisonType
    });
    
    // Helper function to get metrics for a given project and time period
    const getMetricsForPeriod = async (projectId: string, startDate?: string, endDate?: string) => {
      let dateFilter = '';
      if (startDate && endDate) {
        dateFilter = `AND created_at >= '${startDate}' AND created_at <= '${endDate}'`;
      } else if (startDate) {
        dateFilter = `AND created_at >= '${startDate}'`;
      } else if (endDate) {
        dateFilter = `AND created_at <= '${endDate}'`;
      } else {
        // Default to last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        dateFilter = `AND created_at >= '${thirtyDaysAgo.toISOString()}'`;
      }
      
      // Get feedback count
      const { count: totalFeedback, error: feedbackError } = await supabase
        .from('feedback_items')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .gte('created_at', dateFilter.replace('AND ', ''));
      
      if (feedbackError) {
        throw feedbackError;
      }
      
      // Get events count
      const { count: totalEvents, error: eventsError } = await supabase
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .gte('timestamp', dateFilter.replace('AND ', ''));
      
      if (eventsError) {
        throw eventsError;
      }
      
      // Get unique users
      const { count: uniqueUsers, error: usersError } = await supabase
        .from('analytics_events')
        .select('user_id', { count: 'exact' })
        .eq('project_id', projectId)
        .not('user_id', 'is', null)
        .gte('timestamp', dateFilter.replace('AND ', ''));
      
      if (usersError) {
        throw usersError;
      }
      
      // Calculate engagement rate
      const engagementRate = totalEvents && totalEvents > 0 
        ? Math.round((totalFeedback || 0) / totalEvents * 100) 
        : 0;
      
      return {
        total_feedback: totalFeedback || 0,
        total_events: totalEvents || 0,
        unique_users: uniqueUsers || 0,
        engagement_rate: engagementRate
      };
    };
    
    if (comparisonType === 'time_periods') {
      // Compare time periods for the same project
      if (!period1Start || !period1End || !period2Start || !period2End) {
        return NextResponse.json(
          {
            success: false,
            error: 'All period dates are required for time period comparison',
            code: 'MISSING_DATES'
          },
          { status: 400 }
        );
      }
      
      const [period1Metrics, period2Metrics] = await Promise.all([
        getMetricsForPeriod(params.projectId, period1Start, period1End),
        getMetricsForPeriod(params.projectId, period2Start, period2End)
      ]);
      
      // Calculate insights
      const insights = [
        {
          metric: 'Total Feedback',
          change_type: period2Metrics.total_feedback > period1Metrics.total_feedback ? 'increase' as const : 
                      period2Metrics.total_feedback < period1Metrics.total_feedback ? 'decrease' as const : 'no_change' as const,
          change_percentage: period1Metrics.total_feedback > 0 ? 
            Math.round(((period2Metrics.total_feedback - period1Metrics.total_feedback) / period1Metrics.total_feedback) * 100) : 0,
          description: `Feedback ${period2Metrics.total_feedback > period1Metrics.total_feedback ? 'increased' : 'decreased'} by ${Math.abs(Math.round(((period2Metrics.total_feedback - period1Metrics.total_feedback) / (period1Metrics.total_feedback || 1)) * 100))}%`
        },
        {
          metric: 'User Engagement',
          change_type: period2Metrics.engagement_rate > period1Metrics.engagement_rate ? 'increase' as const : 
                      period2Metrics.engagement_rate < period1Metrics.engagement_rate ? 'decrease' as const : 'no_change' as const,
          change_percentage: period1Metrics.engagement_rate > 0 ? 
            Math.round(((period2Metrics.engagement_rate - period1Metrics.engagement_rate) / period1Metrics.engagement_rate) * 100) : 0,
          description: `Engagement ${period2Metrics.engagement_rate > period1Metrics.engagement_rate ? 'increased' : 'decreased'} by ${Math.abs(Math.round(((period2Metrics.engagement_rate - period1Metrics.engagement_rate) / (period1Metrics.engagement_rate || 1)) * 100))}%`
        },
        {
          metric: 'Active Users',
          change_type: period2Metrics.unique_users > period1Metrics.unique_users ? 'increase' as const : 
                      period2Metrics.unique_users < period1Metrics.unique_users ? 'decrease' as const : 'no_change' as const,
          change_percentage: period1Metrics.unique_users > 0 ? 
            Math.round(((period2Metrics.unique_users - period1Metrics.unique_users) / period1Metrics.unique_users) * 100) : 0,
          description: `Active users ${period2Metrics.unique_users > period1Metrics.unique_users ? 'increased' : 'decreased'} by ${Math.abs(Math.round(((period2Metrics.unique_users - period1Metrics.unique_users) / (period1Metrics.unique_users || 1)) * 100))}%`
        }
      ];
      
      const comparison = {
        comparison_type: 'time_periods' as const,
        period_1: {
          start_date: period1Start,
          end_date: period1End,
          metrics: period1Metrics
        },
        period_2: {
          start_date: period2Start,
          end_date: period2End,
          metrics: period2Metrics
        },
        insights
      };
      
      return NextResponse.json({
        success: true,
        data: comparison
      });
      
    } else if (comparisonType === 'projects') {
      // Compare with another project
      if (!comparisonProjectId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Comparison project ID is required for project comparison',
            code: 'MISSING_PROJECT_ID'
          },
          { status: 400 }
        );
      }
      
      const [currentMetrics, comparisonMetrics] = await Promise.all([
        getMetricsForPeriod(params.projectId),
        getMetricsForPeriod(comparisonProjectId)
      ]);
      
      // Calculate insights
      const insights = [
        {
          metric: 'Total Feedback',
          change_type: comparisonMetrics.total_feedback > currentMetrics.total_feedback ? 'increase' as const : 
                      comparisonMetrics.total_feedback < currentMetrics.total_feedback ? 'decrease' as const : 'no_change' as const,
          change_percentage: currentMetrics.total_feedback > 0 ? 
            Math.round(((comparisonMetrics.total_feedback - currentMetrics.total_feedback) / currentMetrics.total_feedback) * 100) : 0,
          description: `Comparison project has ${comparisonMetrics.total_feedback > currentMetrics.total_feedback ? 'more' : 'less'} feedback (${Math.abs(Math.round(((comparisonMetrics.total_feedback - currentMetrics.total_feedback) / (currentMetrics.total_feedback || 1)) * 100))}% difference)`
        },
        {
          metric: 'User Engagement',
          change_type: comparisonMetrics.engagement_rate > currentMetrics.engagement_rate ? 'increase' as const : 
                      comparisonMetrics.engagement_rate < currentMetrics.engagement_rate ? 'decrease' as const : 'no_change' as const,
          change_percentage: currentMetrics.engagement_rate > 0 ? 
            Math.round(((comparisonMetrics.engagement_rate - currentMetrics.engagement_rate) / currentMetrics.engagement_rate) * 100) : 0,
          description: `Comparison project has ${comparisonMetrics.engagement_rate > currentMetrics.engagement_rate ? 'higher' : 'lower'} engagement (${Math.abs(Math.round(((comparisonMetrics.engagement_rate - currentMetrics.engagement_rate) / (currentMetrics.engagement_rate || 1)) * 100))}% difference)`
        }
      ];
      
      const comparison = {
        comparison_type: 'projects' as const,
        period_1: {
          start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          end_date: new Date().toISOString(),
          metrics: currentMetrics
        },
        comparison_project: {
          project_id: comparisonProjectId,
          metrics: comparisonMetrics
        },
        insights
      };
      
      return NextResponse.json({
        success: true,
        data: comparison
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid comparison type',
          code: 'INVALID_COMPARISON_TYPE'
        },
        { status: 400 }
      );
    }
    
  } catch (error) {
    return handleError(error);
  }
}