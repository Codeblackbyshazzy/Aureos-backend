import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/auth';
import { createServerClient, createAdminClient } from '@/lib/supabase';
import { handleError } from '@/lib/errors';
import { z } from 'zod';
import { AddMemberRequest, ProjectMember } from '@/types';

const addMemberSchema = z.object({
  user_id: z.string().uuid(),
  role_id: z.string().uuid()
});

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params;
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
        { success: false, error: 'Only project owners can add members' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = addMemberSchema.parse(body) as AddMemberRequest;

    // Verify the user exists
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', validatedData.user_id)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

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

    // Add member
    const { data: member, error: memberError } = await supabase
      .from('project_members')
      .insert({
        project_id: projectId,
        user_id: validatedData.user_id,
        role_id: validatedData.role_id
      })
      .select(`
        *,
        user:users(id, email),
        role:project_roles(id, name, permissions)
      `)
      .single();

    if (memberError) {
      if (memberError.code === '23505') { // Unique constraint violation
        return NextResponse.json(
          { success: false, error: 'User is already a member of this project' },
          { status: 409 }
        );
      }
      throw memberError;
    }

    return NextResponse.json({
      success: true,
      data: member,
      message: `Member added successfully`
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
    const user = await requireProjectAccess(request, projectId);

    const supabase = createServerClient();

    const { data: members, error } = await supabase
      .from('project_members')
      .select(`
        *,
        user:users(id, email),
        role:project_roles(id, name, permissions)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: members || []
    });
  } catch (error) {
    return handleError(error);
  }
}