import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { handleError } from '@/lib/errors';
import { 
  bulkUpdateTranslationsSchema, 
  paginationSchema 
} from '@/lib/validation';
import { 
  Translation, 
  ApiResponse, 
  PaginatedResponse 
} from '@/types';

/**
 * GET /api/projects/[projectId]/translations
 * Get all translations for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse<ApiResponse<PaginatedResponse<Translation>>>> {
  try {
    await requireAuth();
    
    const supabase = createServerClient();
    
    // Parse query parameters
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const languageCode = url.searchParams.get('language_code');
    const key = url.searchParams.get('key');
    
    // Validate pagination parameters
    const paginationResult = paginationSchema.parse({ page, limit });
    
    // Calculate offset
    const offset = (paginationResult.page - 1) * paginationResult.limit;
    
    // Build query
    let query = supabase
      .from('translations')
      .select('*', { count: 'exact' })
      .eq('project_id', params.projectId)
      .order('language_code', { ascending: true })
      .order('key', { ascending: true })
      .range(offset, offset + paginationResult.limit - 1);
    
    // Apply filters
    if (languageCode) {
      query = query.eq('language_code', languageCode);
    }
    
    if (key) {
      query = query.ilike('key', `%${key}%`);
    }
    
    // Fetch translations with pagination
    const { data: translations, error: translationsError, count } = await query;
    
    if (translationsError) {
      return handleError(translationsError);
    }
    
    const totalPages = Math.ceil((count || 0) / paginationResult.limit);
    
    return NextResponse.json({
      success: true,
      data: {
        data: translations || [],
        total: count || 0,
        page: paginationResult.page,
        limit: paginationResult.limit,
        totalPages
      }
    });
    
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PUT /api/projects/[projectId]/translations
 * Bulk update translations for a project
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse<ApiResponse<{ success: boolean; updated_count: number }>>> {
  try {
    const { user } = await requireAuth();
    const supabase = createServerClient();
    
    // Parse and validate request body
    const body = await request.json();
    const validatedData = bulkUpdateTranslationsSchema.parse(body);
    
    let updatedCount = 0;
    
    // Update each translation
    for (const translation of validatedData.translations) {
      const { error: updateError } = await supabase
        .from('translations')
        .update({
          value: translation.value,
          context: translation.context || null,
          updated_at: new Date().toISOString()
        })
        .eq('project_id', params.projectId)
        .eq('key', translation.key);
      
      if (!updateError) {
        updatedCount++;
      }
    }
    
    return NextResponse.json({
      success: true,
      data: {
        success: true,
        updated_count: updatedCount
      }
    });
    
  } catch (error) {
    return handleError(error);
  }
}