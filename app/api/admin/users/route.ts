import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { adminUsersQuerySchema } from '@/lib/validation';
import { handleError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    
    const { searchParams } = new URL(req.url);
    const query = adminUsersQuerySchema.parse({
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '50',
      search: searchParams.get('search') || undefined,
      sortBy: searchParams.get('sortBy') || 'created_at',
    });
    
    const adminClient = createAdminClient();
    
    // Base query for users
    let userQuery = adminClient
      .from('users')
      .select('*', { count: 'exact' });
    
    if (query.search) {
      userQuery = userQuery.ilike('email', `%${query.search}%`);
    }
    
    userQuery = userQuery.order(query.sortBy, { ascending: false });
    
    const offset = (query.page - 1) * query.limit;
    userQuery = userQuery.range(offset, offset + query.limit - 1);
    
    const { data: users, count, error } = await userQuery;
    
    if (error) {
      throw new Error('Failed to fetch users');
    }
    
    // Enrich users with stats
    const enrichedUsers = await Promise.all(
      (users || []).map(async (user) => {
        // Get project count
        const { count: projectCount } = await adminClient
          .from('projects')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id);
        
        // Get user's project IDs first
        const { data: userProjects } = await adminClient
          .from('projects')
          .select('id')
          .eq('user_id', user.id);
        
        const projectIds = (userProjects || []).map(p => p.id);
        
        // Get total feedback items
        let feedbackCount = 0;
        if (projectIds.length > 0) {
          const { count } = await adminClient
            .from('feedback_items')
            .select('id', { count: 'exact', head: true })
            .in('project_id', projectIds);
          feedbackCount = count || 0;
        }
        
        // Get active subscription for MRR
        const { data: subscription } = await adminClient
          .from('subscriptions')
          .select('plan, billing_interval')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();
        
        let mrrContribution = 0;
        let lifetimeRevenue = 0;
        
        if (subscription) {
          // Estimate MRR and lifetime revenue (simplified)
          const planPrices = {
            starter: { monthly: 29, yearly: 290 },
            pro: { monthly: 99, yearly: 990 },
          };
          
          const price = planPrices[subscription.plan as 'starter' | 'pro'];
          if (price) {
            mrrContribution = subscription.billing_interval === 'monthly' 
              ? price.monthly 
              : price.yearly / 12;
            
            // Estimate lifetime revenue (6 months average for simplicity)
            lifetimeRevenue = mrrContribution * 6;
          }
        }
        
        return {
          ...user,
          project_count: projectCount || 0,
          total_feedback_items: feedbackCount || 0,
          lifetime_revenue: lifetimeRevenue,
          mrr_contribution: mrrContribution,
        };
      })
    );
    
    return NextResponse.json({
      success: true,
      data: {
        data: enrichedUsers,
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
