import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { handleError } from '@/lib/errors';
import { z } from 'zod';

/**
 * POST /api/projects/[projectId]/surveys/nps
 * Create a new NPS survey with pre-configured settings
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse> {
  try {
    const { user } = await requireAuth();
    const supabase = createServerClient();
    
    // Parse and validate request body
    const body = await request.json();
    
    const npsSchema = z.object({
      title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
      description: z.string().max(1000, 'Description too long').optional(),
      followUpQuestion: z.string().max(500, 'Follow-up question too long').optional(),
      settings: z.record(z.string(), z.any()).optional()
    });
    
    const validatedData = npsSchema.parse(body);
    
    // Create the NPS survey
    const { data: survey, error: surveyError } = await supabase
      .from('surveys')
      .insert({
        project_id: params.projectId,
        title: validatedData.title,
        description: validatedData.description || null,
        status: 'active',
        is_nps: true,
        settings: {
          ...validatedData.settings,
          nps_type: 'standard',
          allow_retraction: false,
          anonymous: true
        },
        created_by: user.id
      })
      .select()
      .single();
    
    if (surveyError) {
      return handleError(surveyError);
    }
    
    // Create the NPS question (0-10 scale)
    const { error: questionError } = await supabase
      .from('survey_questions')
      .insert({
        survey_id: survey.id,
        question_text: 'How likely are you to recommend us to a friend or colleague?',
        question_type: 'rating',
        options: [
          { min_rating: 0, max_rating: 10, labels: { 0: 'Not at all likely', 10: 'Extremely likely' } }
        ],
        required: true,
        order_index: 0
      });
    
    if (questionError) {
      // Clean up survey if question creation fails
      await supabase.from('surveys').delete().eq('id', survey.id);
      return handleError(questionError);
    }
    
    // Create follow-up question if provided
    if (validatedData.followUpQuestion) {
      const { error: followUpError } = await supabase
        .from('survey_questions')
        .insert({
          survey_id: survey.id,
          question_text: validatedData.followUpQuestion,
          question_type: 'text',
          required: false,
          order_index: 1
        });
      
      if (followUpError) {
        console.warn('Follow-up question creation failed:', followUpError);
        // Don't fail the entire request for this
      }
    }
    
    return NextResponse.json({
      success: true,
      data: survey
    });
    
  } catch (error) {
    return handleError(error);
  }
}

/**
 * GET /api/projects/[projectId]/surveys/nps/analytics/[surveyId]
 * Get NPS-specific analytics and scoring
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string; surveyId: string } }
): Promise<NextResponse> {
  try {
    await requireAuth();
    
    const supabase = createServerClient();
    
    // Verify survey exists and is NPS
    const { data: survey, error: surveyError } = await supabase
      .from('surveys')
      .select('id, title, is_nps')
      .eq('project_id', params.projectId)
      .eq('id', params.surveyId)
      .eq('is_nps', true)
      .single();
    
    if (surveyError || !survey) {
      return NextResponse.json(
        { success: false, error: 'NPS survey not found' },
        { status: 404 }
      );
    }
    
    // Get all responses for this survey
    const { data: responses, error: responsesError } = await supabase
      .from('survey_responses')
      .select(`
        id,
        submitted_at,
        metadata,
        survey_answers (
          question_id,
          answer_value,
          answer_text
        )
      `)
      .eq('survey_id', params.surveyId)
      .order('submitted_at', { ascending: false });
    
    if (responsesError) {
      return handleError(responsesError);
    }
    
    // Calculate NPS metrics
    const npsScores = [];
    const distribution = { detractors: 0, passives: 0, promoters: 0 };
    const dailyScores = {};
    
    responses?.forEach(response => {
      const npsAnswer = response.survey_answers?.find(answer => 
        answer.answer_value !== null && 
        typeof answer.answer_value === 'number'
      );
      
      if (npsAnswer && typeof npsAnswer.answer_value === 'number') {
        const score = npsAnswer.answer_value;
        npsScores.push(score);
        
        // Categorize score
        if (score >= 0 && score <= 6) {
          distribution.detractors++;
        } else if (score >= 7 && score <= 8) {
          distribution.passives++;
        } else if (score >= 9 && score <= 10) {
          distribution.promoters++;
        }
        
        // Track daily scores
        const date = new Date(response.submitted_at).toISOString().split('T')[0];
        if (!dailyScores[date]) {
          dailyScores[date] = { scores: [], total: 0 };
        }
        dailyScores[date].scores.push(score);
        dailyScores[date].total++;
      }
    });
    
    // Calculate NPS score
    const totalResponses = npsScores.length;
    const promoters = distribution.promoters;
    const detractors = distribution.detractors;
    const passives = distribution.passives;
    
    const npsScore = totalResponses > 0 
      ? Math.round(((promoters - detractors) / totalResponses) * 100)
      : 0;
    
    // Calculate percentages
    const promoterPercentage = totalResponses > 0 
      ? Math.round((promoters / totalResponses) * 100)
      : 0;
    
    const passivePercentage = totalResponses > 0
      ? Math.round((passives / totalResponses) * 100)
      : 0;
    
    const detractorPercentage = totalResponses > 0
      ? Math.round((detractors / totalResponses) * 100)
      : 0;
    
    // Calculate trend data
    const trendData = Object.entries(dailyScores)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        responses: data.total,
        npsScore: data.scores.length > 0 
          ? Math.round(((data.scores.filter(s => s >= 9).length - data.scores.filter(s => s <= 6).length) / data.scores.length) * 100)
          : 0
      }));
    
    // Get recent feedback for follow-up questions
    const followUpResponses = responses?.filter(response => 
      response.survey_answers?.some(answer => 
        answer.answer_text && 
        answer.answer_text.trim().length > 0
      )
    ).slice(0, 10) || [];
    
    return NextResponse.json({
      success: true,
      data: {
        survey: {
          id: survey.id,
          title: survey.title,
          totalResponses
        },
        nps: {
          score: npsScore,
          classification: npsScore >= 70 ? 'Excellent' : 
                         npsScore >= 50 ? 'Very Good' :
                         npsScore >= 30 ? 'Good' :
                         npsScore >= 0 ? 'Needs Improvement' : 'Critical'
        },
        distribution: {
          promoters: {
            count: promoters,
            percentage: promoterPercentage,
            range: '9-10'
          },
          passives: {
            count: passives,
            percentage: passivePercentage,
            range: '7-8'
          },
          detractors: {
            count: detractors,
            percentage: detractorPercentage,
            range: '0-6'
          }
        },
        statistics: {
          averageScore: totalResponses > 0 
            ? Math.round((npsScores.reduce((sum, score) => sum + score, 0) / totalResponses) * 100) / 100
            : 0,
          medianScore: totalResponses > 0
            ? npsScores.sort((a, b) => a - b)[Math.floor(totalResponses / 2)]
            : 0,
          responseRate: '100%' // Since all responses are complete
        },
        trend: trendData,
        recentFeedback: followUpResponses.map(response => ({
          id: response.id,
          submittedAt: response.submitted_at,
          score: response.survey_answers?.find(answer => 
            typeof answer.answer_value === 'number'
          )?.answer_value,
          feedback: response.survey_answers?.find(answer => 
            answer.answer_text && answer.answer_text.trim().length > 0
          )?.answer_text
        }))
      }
    });
    
  } catch (error) {
    return handleError(error);
  }
}