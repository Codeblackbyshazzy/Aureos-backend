import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { handleError } from '@/lib/errors';
import { analyticsQuerySchema } from '@/lib/validation';

/**
 * GET /api/projects/[projectId]/analytics/export
 * Export analytics data for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse> {
  try {
    await requireAuth();
    
    const supabase = createServerClient();
    
    // Parse query parameters
    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'json';
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const metric = url.searchParams.get('metric') || 'all';
    
    // Validate query parameters
    const queryParams = analyticsQuerySchema.parse({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      metric: metric || undefined
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
    
    // Fetch analytics data based on metric type
    let exportData: any = {};
    
    if (metric === 'all' || metric === 'feedback') {
      // Get feedback data
      const { data: feedbackData, error: feedbackError } = await supabase
        .from('feedback_items')
        .select(`
          id,
          text,
          source_type,
          sentiment,
          vote_count,
          comment_count,
          created_at,
          metadata
        `)
        .eq('project_id', params.projectId)
        .is('deleted_at', null)
        .gte('created_at', dateFilter.replace('AND ', ''))
        .order('created_at', { ascending: false });
      
      if (feedbackError) {
        return handleError(feedbackError);
      }
      
      exportData.feedback = feedbackData || [];
    }
    
    if (metric === 'all' || metric === 'events') {
      // Get analytics events
      const { data: eventsData, error: eventsError } = await supabase
        .from('analytics_events')
        .select(`
          id,
          event_type,
          event_name,
          user_id,
          session_id,
          properties,
          timestamp,
          ip_address,
          user_agent
        `)
        .eq('project_id', params.projectId)
        .gte('timestamp', dateFilter.replace('AND ', ''))
        .order('timestamp', { ascending: false });
      
      if (eventsError) {
        return handleError(eventsError);
      }
      
      exportData.events = eventsData || [];
    }
    
    if (metric === 'all' || metric === 'aggregates') {
      // Get analytics aggregates
      const { data: aggregatesData, error: aggregatesError } = await supabase
        .from('analytics_aggregates')
        .select(`
          id,
          metric_name,
          date,
          hour,
          value,
          dimensions
        `)
        .eq('project_id', params.projectId)
        .gte('date', dateFilter.split('AND ')[1]?.split(' ')[2] || '1970-01-01')
        .order('date', { ascending: false });
      
      if (aggregatesError) {
        return handleError(aggregatesError);
      }
      
      exportData.aggregates = aggregatesData || [];
    }
    
    // Add metadata
    exportData.metadata = {
      project_id: params.projectId,
      export_date: new Date().toISOString(),
      date_range: {
        start: queryParams.startDate || dateFilter.split('AND ')[1]?.split(' ')[2] || '1970-01-01',
        end: queryParams.endDate || new Date().toISOString()
      },
      format,
      metric
    };
    
    // Set appropriate headers based on format
    const filename = `analytics-${params.projectId}-${new Date().toISOString().split('T')[0]}`;
    
    if (format === 'csv') {
      // Convert to CSV (simplified)
      let csv = 'type,data\n';
      
      if (exportData.feedback) {
        csv += 'feedback,' + JSON.stringify(exportData.feedback) + '\n';
      }
      if (exportData.events) {
        csv += 'events,' + JSON.stringify(exportData.events) + '\n';
      }
      if (exportData.aggregates) {
        csv += 'aggregates,' + JSON.stringify(exportData.aggregates) + '\n';
      }
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}.csv"`
        }
      });
    } else {
      // Default to JSON
      return NextResponse.json({
        success: true,
        data: exportData
      }, {
        headers: {
          'Content-Disposition': `attachment; filename="${filename}.json"`
        }
      });
    }
    
  } catch (error) {
    return handleError(error);
  }
}