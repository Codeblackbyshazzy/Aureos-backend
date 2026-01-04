import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { apiUsageQuerySchema } from '@/lib/validation';
import { handleError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    
    const { searchParams } = new URL(req.url);
    const query = apiUsageQuerySchema.parse({
      service: searchParams.get('service') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      userId: searchParams.get('userId') || undefined,
      limit: searchParams.get('limit') || '100',
    });
    
    const adminClient = createAdminClient();
    
    // Build base query
    let logsQuery = adminClient
      .from('api_usage_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(query.limit);
    
    if (query.service) {
      logsQuery = logsQuery.eq('service', query.service);
    }
    
    if (query.userId) {
      logsQuery = logsQuery.eq('user_id', query.userId);
    }
    
    if (query.startDate) {
      logsQuery = logsQuery.gte('timestamp', query.startDate);
    }
    
    if (query.endDate) {
      logsQuery = logsQuery.lte('timestamp', query.endDate);
    }
    
    const { data: logs, count } = await logsQuery;
    
    if (!logs) {
      throw new Error('Failed to fetch API usage logs');
    }
    
    // Calculate service breakdown
    const serviceBreakdown = {
      gemini: {
        call_count: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
        estimated_cost: 0,
      },
      deepseek: {
        call_count: 0,
        total_tokens: 0,
        estimated_cost: 0,
      },
      firecrawl: {
        call_count: 0,
        total_credits: 0,
        estimated_cost: 0,
      },
    };
    
    logs.forEach(log => {
      if (log.service === 'gemini') {
        serviceBreakdown.gemini.call_count += 1;
        serviceBreakdown.gemini.total_input_tokens += log.metadata?.inputTokens || 0;
        serviceBreakdown.gemini.total_output_tokens += log.metadata?.outputTokens || 0;
        serviceBreakdown.gemini.estimated_cost += log.cost_estimate;
      } else if (log.service === 'deepseek') {
        serviceBreakdown.deepseek.call_count += 1;
        serviceBreakdown.deepseek.total_tokens += log.tokens_or_credits;
        serviceBreakdown.deepseek.estimated_cost += log.cost_estimate;
      } else if (log.service === 'firecrawl') {
        serviceBreakdown.firecrawl.call_count += 1;
        serviceBreakdown.firecrawl.total_credits += log.tokens_or_credits;
        serviceBreakdown.firecrawl.estimated_cost += log.cost_estimate;
      }
    });
    
    // Get top users by spend
    const userSpendMap = new Map<string, { email: string; spend: number; callCount: number; service: string }>();
    
    for (const log of logs) {
      if (!log.user_id) continue;
      
      const existing = userSpendMap.get(log.user_id);
      if (existing) {
        existing.spend += log.cost_estimate;
        existing.callCount += 1;
      } else {
        // Fetch user email
        const { data: user } = await adminClient
          .from('users')
          .select('email')
          .eq('id', log.user_id)
          .single();
        
        userSpendMap.set(log.user_id, {
          email: user?.email || 'Unknown',
          spend: log.cost_estimate,
          callCount: 1,
          service: log.service,
        });
      }
    }
    
    const topUsers = Array.from(userSpendMap.entries())
      .map(([userId, data]) => ({
        user_id: userId,
        email: data.email,
        service: data.service,
        spend: Math.round(data.spend * 100) / 100,
        call_count: data.callCount,
      }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 10);
    
    // Calculate cost trends (daily aggregation)
    const trendMap = new Map<string, { gemini: number; deepseek: number; firecrawl: number }>();
    
    logs.forEach(log => {
      const date = new Date(log.timestamp).toISOString().split('T')[0];
      const existing = trendMap.get(date) || { gemini: 0, deepseek: 0, firecrawl: 0 };
      const service = log.service as 'gemini' | 'deepseek' | 'firecrawl';
      existing[service] += log.cost_estimate;
      trendMap.set(date, existing);
    });
    
    const costTrends = Array.from(trendMap.entries())
      .map(([date, costs]) => ({
        date,
        gemini_cost: Math.round(costs.gemini * 100) / 100,
        deepseek_cost: Math.round(costs.deepseek * 100) / 100,
        firecrawl_cost: Math.round(costs.firecrawl * 100) / 100,
        total: Math.round((costs.gemini + costs.deepseek + costs.firecrawl) * 100) / 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    return NextResponse.json({
      success: true,
      data: {
        total_usage: count || logs.length,
        service_breakdown: serviceBreakdown,
        top_users: topUsers,
        cost_trends: costTrends,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
