import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { handleError } from '@/lib/errors';
import { ApiResponse } from '@/types';

/**
 * GET /api/integrations
 * Get all available integration providers
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse<Array<{
  name: string;
  display_name: string;
  description: string;
  category: string;
  features: string[];
}>>>> {
  try {
    await requireAuth();
    
    const integrations = [
      {
        name: 'slack',
        display_name: 'Slack',
        description: 'Send feedback notifications to Slack channels',
        category: 'Communication',
        features: [
          'Channel notifications',
          'User mentions',
          'Rich message formatting',
          'Thread support'
        ]
      },
      {
        name: 'discord',
        display_name: 'Discord',
        description: 'Integrate with Discord servers for community feedback',
        category: 'Communication',
        features: [
          'Server notifications',
          'User mentions',
          'Embed formatting',
          'Webhook support'
        ]
      },
      {
        name: 'github',
        display_name: 'GitHub',
        description: 'Create issues and track feedback as development tasks',
        category: 'Development',
        features: [
          'Issue creation',
          'Repository linking',
          'Label management',
          'Milestone tracking'
        ]
      },
      {
        name: 'zapier',
        display_name: 'Zapier',
        description: 'Connect with 3000+ apps via Zapier automation',
        category: 'Automation',
        features: [
          'App connections',
          'Trigger workflows',
          'Data transformation',
          'Multi-step automation'
        ]
      },
      {
        name: 'mailchimp',
        display_name: 'Mailchimp',
        description: 'Export feedback data for email marketing campaigns',
        category: 'Marketing',
        features: [
          'Contact synchronization',
          'Audience segmentation',
          'Campaign integration',
          'Analytics tracking'
        ]
      },
      {
        name: 'intercom',
        display_name: 'Intercom',
        description: 'Sync feedback with customer support conversations',
        category: 'Support',
        features: [
          'Conversation linking',
          'Customer insights',
          'Response automation',
          'Team collaboration'
        ]
      }
    ];
    
    return NextResponse.json({
      success: true,
      data: integrations
    });
    
  } catch (error) {
    return handleError(error);
  }
}