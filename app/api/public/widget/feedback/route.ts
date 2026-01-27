import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { handleError } from '@/lib/errors';
import { z } from 'zod';

/**
 * POST /api/public/widget/feedback
 * Submit feedback via the embeddable widget (no authentication required)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = createServerClient();
    
    // Parse and validate request body
    const body = await request.json();
    
    const feedbackSchema = z.object({
      project_id: z.string().uuid('Invalid project ID'),
      email: z.string().email().optional().nullable(),
      feedback: z.string().min(1, 'Feedback is required').max(5000, 'Feedback too long'),
      source: z.string().default('widget')
    });
    
    const validatedData = feedbackSchema.parse(body);
    
    // Verify project exists
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', validatedData.project_id)
      .single();
    
    if (projectError || !project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }
    
    // Create feedback item
    const { data: feedback, error: feedbackError } = await supabase
      .from('feedback_items')
      .insert({
        project_id: validatedData.project_id,
        text: validatedData.feedback,
        source_type: 'manual',
        metadata: {
          email: validatedData.email,
          source: validatedData.source,
          user_agent: request.headers.get('user-agent'),
          submitted_via: 'widget'
        }
      })
      .select()
      .single();
    
    if (feedbackError) {
      return handleError(feedbackError);
    }
    
    return NextResponse.json({
      success: true,
      data: {
        id: feedback.id,
        message: 'Feedback submitted successfully'
      }
    });
    
  } catch (error) {
    return handleError(error);
  }
}