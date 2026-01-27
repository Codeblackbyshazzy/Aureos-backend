import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { handleError, createRateLimitResponse } from '@/lib/errors';
import { getClientIp } from '@/lib/ip-utils';
import { checkAnonymousRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';
import { sanitizeText } from '@/lib/html-sanitizer';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    // Rate limiting for public endpoint (100/min per IP)
    const ipHash = await getClientIp(req);
    const rateLimitResult = await checkAnonymousRateLimit(ipHash, 100);
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult.resetAt);
    }

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

    // Sanitize output
    const sanitizedRoadmapItems = (roadmapItems || []).map(item => ({
      ...item,
      title: sanitizeText(item.title),
      description: item.description ? sanitizeText(item.description) : item.description,
    }));

    return NextResponse.json(
      {
        success: true,
        data: {
          project: {
            name: project.name,
            slug: project.slug,
          },
          roadmap: sanitizedRoadmapItems,
        },
      },
      { headers: getRateLimitHeaders(rateLimitResult) }
    );
  } catch (error) {
    return handleError(error);
  }
}
