import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getProjectWithOwnership, requireProPlan } from '@/lib/project-utils';
import { createAdminClient } from '@/lib/supabase';
import { batchScrapeUrls } from '@/lib/ai-services';
import { logApiUsage, batchLogApiUsage } from '@/lib/usage-logger';
import { webImportSchema } from '@/lib/validation';
import { handleError } from '@/lib/errors';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const user = await requireAuth();
    const project = await getProjectWithOwnership(projectId, user.id);
    
    // Require Pro plan for web scraping
    requireProPlan(project.plan);
    
    const body = await req.json();
    const validated = webImportSchema.parse(body);
    
    // Scrape all URLs
    const scrapeResults = await batchScrapeUrls(validated.urls);
    
    const adminClient = createAdminClient();
    
    // Create feedback items from scraped content
    const feedbackItems = scrapeResults.map((result, index) => ({
      project_id: projectId,
      text: result.text,
      source_type: 'web' as const,
      source_url: validated.urls[index],
    }));
    
    const { data: createdFeedback, error } = await adminClient
      .from('feedback_items')
      .insert(feedbackItems)
      .select();
    
    if (error) {
      throw new Error('Failed to create feedback items from scraped content');
    }
    
    // Log API usage for each scrape
    const totalCredits = scrapeResults.reduce((sum, r) => sum + r.creditsUsed, 0);
    
    await batchLogApiUsage(
      scrapeResults.map((result, index) => ({
        userId: user.id,
        projectId,
        service: 'firecrawl' as const,
        tokensOrCredits: result.creditsUsed,
        endpoint: '/api/projects/[id]/import/web',
        metadata: {
          url: validated.urls[index],
          textLength: result.text.length,
        },
      }))
    );
    
    return NextResponse.json({
      success: true,
      data: {
        feedbackCount: createdFeedback?.length || 0,
        creditsUsed: totalCredits,
        feedback: createdFeedback,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
