import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getProjectWithOwnership } from '@/lib/project-utils';
import { createAdminClient } from '@/lib/supabase';
import { createRoadmapItemSchema, paginationSchema } from '@/lib/validation';
import { handleError } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const user = await requireAuth();
    await getProjectWithOwnership(projectId, user.id);
    
    const { searchParams } = new URL(req.url);
    const query = paginationSchema.parse({
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
    });
    
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    
    const adminClient = createAdminClient();
    
    let queryBuilder = adminClient
      .from('roadmap_items')
      .select('*', { count: 'exact' })
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    
    if (status) {
      queryBuilder = queryBuilder.eq('status', status);
    }
    
    if (priority) {
      queryBuilder = queryBuilder.eq('priority', priority);
    }
    
    const offset = (query.page - 1) * query.limit;
    queryBuilder = queryBuilder.range(offset, offset + query.limit - 1);
    
    const { data: items, count, error } = await queryBuilder;
    
    if (error) {
      throw new Error('Failed to fetch roadmap items');
    }
    
    return NextResponse.json({
      success: true,
      data: {
        data: items || [],
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const user = await requireAuth();
    await getProjectWithOwnership(projectId, user.id);
    
    const body = await req.json();
    const validated = createRoadmapItemSchema.parse(body);
    
    const adminClient = createAdminClient();
    
    const { data: item, error } = await adminClient
      .from('roadmap_items')
      .insert({
        project_id: projectId,
        cluster_id: validated.clusterId || null,
        title: validated.title,
        description: validated.description || null,
        status: validated.status,
        priority: validated.priority,
        votes: 0,
      })
      .select()
      .single();
    
    if (error) {
      throw new Error('Failed to create roadmap item');
    }
    
    return NextResponse.json({
      success: true,
      data: item,
    });
  } catch (error) {
    return handleError(error);
  }
}
