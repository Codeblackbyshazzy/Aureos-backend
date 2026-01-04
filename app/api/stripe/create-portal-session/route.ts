import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createPortalSession, getSubscriptionInfo } from '@/lib/stripe';
import { handleError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    
    const subscription = await getSubscriptionInfo(user.id);
    
    if (!subscription) {
      throw new Error('No active subscription found');
    }
    
    const url = await createPortalSession(subscription.stripe_customer_id);
    
    return NextResponse.json({
      success: true,
      data: { url },
    });
  } catch (error) {
    return handleError(error);
  }
}
