import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { changePlanSchema } from '@/lib/validation';
import { handleError } from '@/lib/errors';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    
    const { id: userId } = await params;
    const body = await req.json();
    const validated = changePlanSchema.parse(body);
    
    const adminClient = createAdminClient();
    
    // Update all user's projects to new plan
    const { error: projectError } = await adminClient
      .from('projects')
      .update({ plan: validated.plan })
      .eq('user_id', userId);
    
    if (projectError) {
      throw new Error('Failed to update user projects');
    }
    
    // If downgrading to free, cancel any active subscriptions
    if (validated.plan === 'free') {
      await adminClient
        .from('subscriptions')
        .update({ status: 'cancelled' })
        .eq('user_id', userId)
        .eq('status', 'active');
    }
    
    return NextResponse.json({
      success: true,
      data: {
        message: `User plan changed to ${validated.plan}`,
        plan: validated.plan,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
