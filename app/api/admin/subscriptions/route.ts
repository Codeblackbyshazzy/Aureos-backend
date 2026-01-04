import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { handleError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    
    const adminClient = createAdminClient();
    
    // Get all subscriptions
    const { data: subscriptions } = await adminClient
      .from('subscriptions')
      .select('*');
    
    if (!subscriptions) {
      throw new Error('Failed to fetch subscriptions');
    }
    
    // Calculate active count
    const activeCount = subscriptions.filter(s => s.status === 'active').length;
    
    // Calculate churned count (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const churnedCount = subscriptions.filter(
      s => s.status === 'cancelled' && new Date(s.updated_at) >= thirtyDaysAgo
    ).length;
    
    // Calculate revenue
    const planPrices = {
      starter: { monthly: 29, yearly: 290 },
      pro: { monthly: 99, yearly: 990 },
    };
    
    let totalMrr = 0;
    let totalArr = 0;
    const revenueByPlan = {
      starter: { mrr: 0, arr: 0 },
      pro: { mrr: 0, arr: 0 },
    };
    const revenueByInterval = {
      monthly: { count: 0, mrr: 0 },
      yearly: { count: 0, arr: 0 },
    };
    
    subscriptions
      .filter(s => s.status === 'active')
      .forEach(sub => {
        const price = planPrices[sub.plan as 'starter' | 'pro'];
        if (!price) return;
        
        if (sub.billing_interval === 'monthly') {
          const mrr = price.monthly;
          totalMrr += mrr;
          totalArr += mrr * 12;
          revenueByPlan[sub.plan as 'starter' | 'pro'].mrr += mrr;
          revenueByPlan[sub.plan as 'starter' | 'pro'].arr += mrr * 12;
          revenueByInterval.monthly.count += 1;
          revenueByInterval.monthly.mrr += mrr;
        } else {
          const arr = price.yearly;
          const mrr = arr / 12;
          totalMrr += mrr;
          totalArr += arr;
          revenueByPlan[sub.plan as 'starter' | 'pro'].mrr += mrr;
          revenueByPlan[sub.plan as 'starter' | 'pro'].arr += arr;
          revenueByInterval.yearly.count += 1;
          revenueByInterval.yearly.arr += arr;
        }
      });
    
    // Status distribution
    const statusDistribution = {
      active: subscriptions.filter(s => s.status === 'active').length,
      cancelled: subscriptions.filter(s => s.status === 'cancelled').length,
      past_due: subscriptions.filter(s => s.status === 'past_due').length,
      paused: subscriptions.filter(s => s.status === 'paused').length,
    };
    
    return NextResponse.json({
      success: true,
      data: {
        active_count: activeCount,
        churned_count: churnedCount,
        revenue_summary: {
          total_mrr: Math.round(totalMrr * 100) / 100,
          total_arr: Math.round(totalArr * 100) / 100,
          revenue_by_plan: revenueByPlan,
          revenue_by_interval: revenueByInterval,
        },
        status_distribution: statusDistribution,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
