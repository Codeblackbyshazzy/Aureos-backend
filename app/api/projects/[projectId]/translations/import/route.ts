import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { handleError } from '@/lib/errors';
import { importTranslationsSchema } from '@/lib/validation';

/**
 * POST /api/projects/[projectId]/translations/import
 * Import translations from various formats (JSON, CSV, PO)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse<import('@/types').ApiResponse<{
  success: boolean;
  imported_count: number;
  errors: string[];
}>>> {
  try {
    const { user } = await requireAuth();
    const supabase = createServerClient();
    
    // Parse and validate request body
    const body = await request.json();
    const validatedData = importTranslationsSchema.parse(body);
    
    let translations: Array<{ key: string; value: string; context?: string }> = [];
    let errors: string[] = [];
    
    try {
      switch (validatedData.format) {
        case 'json':
          const jsonData = JSON.parse(validatedData.content);
          if (typeof jsonData === 'object' && jsonData !== null) {
            translations = Object.entries(jsonData).map(([key, value]) => ({
              key,
              value: typeof value === 'string' ? value : JSON.stringify(value)
            }));
          } else {
            errors.push('Invalid JSON format');
          }
          break;
          
        case 'csv':
          const lines = validatedData.content.split('\n').filter(line => line.trim());
          if (lines.length > 0) {
            const header = lines[0].split(',');
            const keyIndex = header.findIndex(h => h.toLowerCase().includes('key'));
            const valueIndex = header.findIndex(h => h.toLowerCase().includes('value'));
            
            if (keyIndex >= 0 && valueIndex >= 0) {
              for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',');
                if (values[keyIndex] && values[valueIndex]) {
                  translations.push({
                    key: values[keyIndex].trim(),
                    value: values[valueIndex].trim()
                  });
                }
              }
            } else {
              errors.push('CSV must contain "key" and "value" columns');
            }
          }
          break;
          
        case 'po':
          // Simple PO file parser
          const poLines = validatedData.content.split('\n');
          let currentKey = '';
          let currentValue = '';
          
          for (const line of poLines) {
            const trimmedLine = line.trim();
            
            if (trimmedLine.startsWith('msgid "')) {
              currentKey = trimmedLine.slice(7, -1); // Remove 'msgid "' and closing '"'
            } else if (trimmedLine.startsWith('msgstr "')) {
              currentValue = trimmedLine.slice(8, -1); // Remove 'msgstr "' and closing '"'
              
              if (currentKey && currentValue) {
                translations.push({
                  key: currentKey,
                  value: currentValue
                });
              }
            }
          }
          break;
          
        default:
          errors.push(`Unsupported format: ${validatedData.format}`);
      }
    } catch (parseError) {
      errors.push(`Failed to parse ${validatedData.format} format: ${parseError}`);
    }
    
    if (translations.length === 0 && errors.length === 0) {
      errors.push('No valid translations found');
    }
    
    let importedCount = 0;
    
    // Import translations
    for (const translation of translations) {
      try {
        const { error } = await supabase
          .from('translations')
          .upsert({
            project_id: params.projectId,
            language_code: validatedData.language_code,
            key: translation.key,
            value: translation.value,
            context: translation.context || null,
            is_approved: false,
            created_by: user.id,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'project_id,language_code,key'
          });
        
        if (!error) {
          importedCount++;
        } else {
          errors.push(`Failed to import "${translation.key}": ${error.message}`);
        }
      } catch (importError) {
        errors.push(`Failed to import "${translation.key}": ${importError}`);
      }
    }
    
    return NextResponse.json({
      success: true,
      data: {
        success: true,
        imported_count: importedCount,
        errors
      }
    });
    
  } catch (error) {
    return handleError(error);
  }
}