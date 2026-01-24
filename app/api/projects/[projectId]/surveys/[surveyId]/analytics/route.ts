import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { handleError } from '@/lib/errors';
import { SurveyAnalytics, ApiResponse } from '@/types';

/**
 * GET /api/projects/[projectId]/surveys/[surveyId]/analytics
 * Get analytics for a survey
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string; surveyId: string } }
): Promise<NextResponse<ApiResponse<SurveyAnalytics>>> {
  try {
    await requireAuth();
    
    const supabase = createServerClient();
    
    // Get total responses count
    const { count: totalResponses, error: responsesError } = await supabase
      .from('survey_responses')
      .select('*', { count: 'exact', head: true })
      .eq('survey_id', params.surveyId);
    
    if (responsesError) {
      return handleError(responsesError);
    }
    
    // Get questions with their answers
    const { data: questions, error: questionsError } = await supabase
      .from('survey_questions')
      .select(`
        id,
        question_text,
        question_type,
        options,
        survey_answers (
          id,
          answer_text,
          answer_value
        )
      `)
      .eq('survey_id', params.surveyId)
      .order('order_index', { ascending: true });
    
    if (questionsError) {
      return handleError(questionsError);
    }
    
    // Calculate question analytics
    const questionAnalytics = questions?.map(question => {
      const answers = question.survey_answers || [];
      const totalAnswers = answers.length;
      
      let answerDistribution: Array<{
        answer: string;
        count: number;
        percentage: number;
      }> = [];
      
      // Handle different question types
      if (question.question_type === 'text') {
        // For text questions, show unique answers
        const textAnswers = answers
          .filter(a => a.answer_text && a.answer_text.trim())
          .map(a => a.answer_text!);
        const uniqueAnswers = [...new Set(textAnswers)];
        
        answerDistribution = uniqueAnswers.slice(0, 10).map(answer => ({
          answer,
          count: textAnswers.filter(a => a === answer).length,
          percentage: totalAnswers > 0 ? Math.round((textAnswers.filter(a => a === answer).length / totalAnswers) * 100) : 0
        }));
      } else if (question.question_type === 'rating') {
        // For rating questions (1-5 scale)
        const ratings = answers
          .filter(a => a.answer_text && !isNaN(Number(a.answer_text)))
          .map(a => Number(a.answer_text!));
        
        const ratingDistribution: Record<number, number> = {};
        ratings.forEach(rating => {
          ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
        });
        
        answerDistribution = Object.entries(ratingDistribution)
          .map(([rating, count]) => ({
            answer: `Rating ${rating}`,
            count,
            percentage: totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0
          }))
          .sort((a, b) => parseInt(a.answer.split(' ')[1]) - parseInt(b.answer.split(' ')[1]));
      } else if (question.question_type === 'yes_no') {
        // For yes/no questions
        const yesAnswers = answers.filter(a => 
          a.answer_text && ['yes', 'true', '1'].includes(a.answer_text.toLowerCase())
        ).length;
        const noAnswers = answers.filter(a => 
          a.answer_text && ['no', 'false', '0'].includes(a.answer_text.toLowerCase())
        ).length;
        
        answerDistribution = [
          {
            answer: 'Yes',
            count: yesAnswers,
            percentage: totalAnswers > 0 ? Math.round((yesAnswers / totalAnswers) * 100) : 0
          },
          {
            answer: 'No',
            count: noAnswers,
            percentage: totalAnswers > 0 ? Math.round((noAnswers / totalAnswers) * 100) : 0
          }
        ].filter(item => item.count > 0);
      } else {
        // For choice questions (single_choice, multiple_choice)
        const choiceAnswers = answers
          .filter(a => a.answer_value)
          .map(a => typeof a.answer_value === 'string' ? a.answer_value : JSON.stringify(a.answer_value));
        
        const choiceDistribution: Record<string, number> = {};
        choiceAnswers.forEach(answer => {
          choiceDistribution[answer] = (choiceDistribution[answer] || 0) + 1;
        });
        
        answerDistribution = Object.entries(choiceDistribution)
          .map(([answer, count]) => ({
            answer,
            count,
            percentage: totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0
          }))
          .sort((a, b) => b.count - a.count);
      }
      
      return {
        question_id: question.id,
        question_text: question.question_text,
        question_type: question.question_type,
        total_answers: totalAnswers,
        answer_distribution: answerDistribution
      };
    }) || [];
    
    // Calculate completion rate (assuming all questions were answered)
    const completionRate = totalResponses && totalResponses > 0 ? 100 : 0;
    
    const analytics: SurveyAnalytics = {
      total_responses: totalResponses || 0,
      completion_rate: completionRate,
      question_analytics: questionAnalytics
    };
    
    return NextResponse.json({
      success: true,
      data: analytics
    });
    
  } catch (error) {
    return handleError(error);
  }
}