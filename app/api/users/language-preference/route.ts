import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { handleError } from '@/lib/errors';
import { UserLanguagePreference, ApiResponse } from '@/types';

/**
 * GET /api/users/language-preference
 * Get current user's language preferences
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse<UserLanguagePreference[]>>> {
  try {
    const { user } = await requireAuth();
    
    const supabase = createServerClient();
    
    // Fetch user's language preferences
    const { data: preferences, error: preferencesError } = await supabase
      .from('user_language_preferences')
      .select('*')
      .eq('user_id', user.id)
      .order('preference_level', { ascending: false });
    
    if (preferencesError) {
      return handleError(preferencesError);
    }
    
    return NextResponse.json({
      success: true,
      data: preferences || []
    });
    
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PUT /api/users/language-preference
 * Update current user's language preferences
 */
export async function PUT(
  request: NextRequest
): Promise<NextResponse<ApiResponse<UserLanguagePreference>>> {
  try {
    const { user } = await requireAuth();
    const supabase = createServerClient();
    
    // Parse and validate request body
    const body = await request.json();
    
    // Validate required fields
    if (!body.language_code || !body.preference_level) {
      return NextResponse.json(
        {
          success: false,
          error: 'language_code and preference_level are required',
          code: 'MISSING_REQUIRED_FIELDS'
        },
        { status: 400 }
      );
    }
    
    const languageCode = String(body.language_code);
    const preferenceLevel = parseInt(body.preference_level);
    
    // Validate preference level range
    if (preferenceLevel < 1 || preferenceLevel > 5) {
      return NextResponse.json(
        {
          success: false,
          error: 'preference_level must be between 1 and 5',
          code: 'INVALID_PREFERENCE_LEVEL'
        },
        { status: 400 }
      );
    }
    
    // Upsert language preference
    const { data: preference, error: preferenceError } = await supabase
      .from('user_language_preferences')
      .upsert({
        user_id: user.id,
        language_code: languageCode,
        preference_level: preferenceLevel,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,language_code'
      })
      .select()
      .single();
    
    if (preferenceError) {
      return handleError(preferenceError);
    }
    
    return NextResponse.json({
      success: true,
      data: preference
    });
    
  } catch (error) {
    return handleError(error);
  }
}