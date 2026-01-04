import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { handleError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    
    const adminClient = createAdminClient();
    
    // Users metrics
    const { count: totalUsers } = await adminClient
      .from('users')
      .select('id', { count: 'exact', head: true });
    
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    const { count: activeThisMonth } = await adminClient
      .from('users')
      .select('id', { count: 'exact', head: true })
      .gte('last_active_at', oneMonthAgo.toISOString());
    
    const { count: newThisMonth } = await adminClient
      .from('users')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', oneMonthAgo.toISOString());
    
    // Revenue metrics
    const { data: activeSubscriptions } = await adminClient
      .from('subscriptions')
      .select('plan, billing_interval')
      .eq('status', 'active');
    
    const planPrices = {
      starter: { monthly: 29, yearly: 290 },
      pro: { monthly: 99, yearly: 990 },
    };
    
    let currentMrr = 0;
    let arr = 0;
    
    (activeSubscriptions || []).forEach(sub => {
      const price = planPrices[sub.plan as 'starter' | 'pro'];
      if (!price) return;
      
      if (sub.billing_interval === 'monthly') {
        currentMrr += price.monthly;
        arr += price.monthly * 12;
      } else {
        currentMrr += price.yearly / 12;
        arr += price.yearly;
      }
    });
    
    // Calculate growth rate (simplified - compare to last month)
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    
    const { data: lastMonthSubs } = await adminClient
      .from('subscriptions')
      .select('plan, billing_interval')
      .eq('status', 'active')
      .lte('created_at', oneMonthAgo.toISOString());
    
    let lastMonthMrr = 0;
    (lastMonthSubs || []).forEach(sub => {
      const price = planPrices[sub.plan as 'starter' | 'pro'];
      if (!price) return;
      
      if (sub.billing_interval === 'monthly') {
        lastMonthMrr += price.monthly;
      } else {
        lastMonthMrr += price.yearly / 12;
      }
    });
    
    const growthRate = lastMonthMrr > 0 
      ? ((currentMrr - lastMonthMrr) / lastMonthMrr) * 100 
      : 0;
    
    // Feedback metrics
    const { count: totalFeedback } = await adminClient
      .from('feedback_items')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null);
    
    const { count: totalProjects } = await adminClient
      .from('projects')
      .select('id', { count: 'exact', head: true });
    
    const avgFeedbackPerProject = totalProjects && totalProjects > 0
      ? (totalFeedback || 0) / totalProjects
      : 0;
    
    // Project metrics
    const { count: totalClusters } = await adminClient
      .from('feedback_clusters')
      .select('id', { count: 'exact', head: true });
    
    const avgClustersPerProject = totalProjects && totalProjects > 0
      ? (totalClusters || 0) / totalProjects
      : 0;
    
    // Conversion metrics
    const { count: freeUsers } = await adminClient
      .from('projects')
      .select('user_id', { count: 'exact', head: true })
      .eq('plan', 'free');
    
    const { count: starterUsers } = await adminClient
      .from('projects')
      .select('user_id', { count: 'exact', head: true })
      .eq('plan', 'starter');
    
    const { count: proUsers } = await adminClient
      .from('projects')
      .select('user_id', { count: 'exact', head: true })
      .eq('plan', 'pro');
    
    const paidUsers = (starterUsers || 0) + (proUsers || 0);
    const conversionRate = totalUsers && totalUsers > 0
      ? (paidUsers / totalUsers) * 100
      : 0;
    
    return NextResponse.json({
      success: true,
      data: {
        users: {
          total_all_time: totalUsers || 0,
          active_this_month: activeThisMonth || 0,
          this_month_new: newThisMonth || 0,
        },
        revenue: {
          current_mrr: Math.round(currentMrr * 100) / 100,
          arr: Math.round(arr * 100) / 100,
          growth_rate_percent: Math.round(growthRate * 100) / 100,
        },
        feedback: {
          total_processed: totalFeedback || 0,
          avg_per_project: Math.round(avgFeedbackPerProject * 100) / 100,
        },
        projects: {
          total_active: totalProjects || 0,
          avg_feedback_per_project: Math.round(avgFeedbackPerProject * 100) / 100,
          avg_clusters_per_project: Math.round(avgClustersPerProject * 100) / 100,
        },
        conversion: {
          free_to_paid_count: paidUsers,
          conversion_rate_percent: Math.round(conversionRate * 100) / 100,
        },
        plans: {
          free_count: freeUsers || 0,
          starter_count: starterUsers || 0,
          pro_count: proUsers || 0,
        },
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
