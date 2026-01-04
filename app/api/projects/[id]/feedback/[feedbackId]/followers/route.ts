import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { handleError } from '@/lib/errors';
import { createServerClient } from '@/lib/supabase';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; feedbackId: string }> }
) {
  try {
    const { feedbackId } = await params;
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    const supabase = await createServerClient();

    const { data: followers, error, count } = await supabase
      .from('feedback_followers')
      .select('id, created_at, user:users(id, email)', { count: 'exact' })
      .eq('feedback_id', feedbackId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      followers: (followers || []).map((f: any) => ({
        id: f.user.id,
        email: f.user.email,
        name: f.user.name,
        followedAt: f.created_at
      })),
      total: count || 0
    });
  } catch (error) {
    return handleError(error);
  }
}
