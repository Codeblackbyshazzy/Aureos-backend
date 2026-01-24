import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/auth';
import { saveSearchFilter, getSavedSearchFilters } from '@/lib/search';
import { handleError } from '@/lib/errors';
import { z } from 'zod';
import { CreateSearchFilterRequest } from '@/types';

const filterSchema = z.object({
  name: z.string().min(1).max(100),
  filter_config: z.record(z.any())
});

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params;
    const user = await requireProjectAccess(request, projectId);

    const body = await request.json();
    const validatedData = filterSchema.parse(body) as CreateSearchFilterRequest;

    const filter = await saveSearchFilter(
      projectId,
      user.id,
      validatedData.name,
      validatedData.filter_config
    );

    return NextResponse.json({
      success: true,
      data: filter
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params;
    await requireProjectAccess(request, projectId);

    const filters = await getSavedSearchFilters(projectId);

    return NextResponse.json({
      success: true,
      data: filters
    });
  } catch (error) {
    return handleError(error);
  }
}
