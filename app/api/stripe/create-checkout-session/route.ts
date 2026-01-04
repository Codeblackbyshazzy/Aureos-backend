import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createCheckoutSession } from '@/lib/stripe';
import { createCheckoutSessionSchema } from '@/lib/validation';
import { handleError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    
    const validated = createCheckoutSessionSchema.parse(body);
    
    const sessionId = await createCheckoutSession(
      user.id,
      user.email,
      validated.plan,
      validated.interval
    );
    
    return NextResponse.json({
      success: true,
      data: { sessionId },
    });
  } catch (error) {
    return handleError(error);
  }
}
