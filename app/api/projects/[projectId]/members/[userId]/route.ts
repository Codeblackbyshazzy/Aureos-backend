import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { handleError } from '@/lib/errors';
import { z } from 'zod';
import { UpdateMemberRoleRequest } from '@/types';

const updateRoleSchema = z.object({
  role_id: z.string().uuid()
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { projectId: string; userId: string } }
) {
  try {
    const { projectId, userId } = params;
    const user = await requireProjectAccess(request, projectId);

    // Verify the requesting user is the project owner
    const supabase = createServerClient();
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('user_id')
      .eq('id', projectId)
      .single();

    if (projectError) throw projectError;

    if (project.user_id !== user.userId) {
      return NextResponse.json(
        { success: false, error: 'Only project owners can update member roles' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = updateRoleSchema.parse(body) as UpdateMemberRoleRequest;

    // Verify the role exists and belongs to this project
    const { data: role, error: roleError } = await supabase
      .from('project_roles')
      .select('id, name')
      .eq('id', validatedData.role_id)
      .eq('project_id', projectId)
      .single();

    if (roleError || !role) {
      return NextResponse.json(
        { success: false, error: 'Role not found' },
        { status: 404 }
      );
    }

    // Update member role
    const { data: member, error: memberError } = await supabase
      .from('project_members')
      .update({ role_id: validatedData.role_id })
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .select(`
        *,
        user:users(id, email),
        role:project_roles(id, name, permissions)
      `)
      .single();

    if (memberError) {
      if (memberError.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Member not found' },
          { status: 404 }
        );
      }
      throw memberError;
    }

    return NextResponse.json({
      success: true,
      data: member,
      message: 'Member role updated successfully'
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectId: string; userId: string } }
) {
  try {
    const { projectId, userId } = params;
    const user = await requireProjectAccess(request, projectId);

    // Verify the requesting user is the project owner
    const supabase = createServerClient();
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('user_id')
      .eq('id', projectId)
      .single();

    if (projectError) throw projectError;

    if (project.user_id !== user.userId) {
      return NextResponse.json(
        { success: false, error: 'Only project owners can remove members' },
        { status: 403 }
      );
    }

    // Remove member
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: { message: 'Member removed successfully' }
    });
  } catch (error) {
    return handleError(error);
  }
}