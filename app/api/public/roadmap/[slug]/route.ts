import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { handleError } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const adminClient = createAdminClient();
    
    // Find project by slug
    const { data: project, error: projectError } = await adminClient
      .from('projects')
      .select('id, name, slug')
      .eq('slug', slug)
      .single();
    
    if (projectError || !project) {
      return NextResponse.json(
        {
          success: false,
          error: 'Project not found',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }
    
    // Fetch public roadmap items
    const { data: roadmapItems, error: itemsError } = await adminClient
      .from('roadmap_items')
      .select('id, title, description, status, priority, votes, created_at, updated_at')
      .eq('project_id', project.id)
      .order('priority', { ascending: false })
      .order('votes', { ascending: false });
    
    if (itemsError) {
      throw new Error('Failed to fetch roadmap items');
    }
    
    return NextResponse.json({
      success: true,
      data: {
        project: {
          name: project.name,
          slug: project.slug,
        },
        roadmap: roadmapItems || [],
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
