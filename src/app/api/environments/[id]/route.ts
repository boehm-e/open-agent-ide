import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { syncEnvironmentToWorkspaces } from '@/lib/docker';

// GET /api/environments/[id] - Get a specific environment
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const environment = await prisma.environment.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      select: {
        id: true,
        name: true,
        description: true,
        variables: true,
        createdAt: true,
        updatedAt: true,
        workspaces: {
          select: {
            workspaceId: true,
          },
        },
      },
    });

    if (!environment) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }

    return NextResponse.json(environment);
  } catch (error) {
    console.error('Error fetching environment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/environments/[id] - Update an environment
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const body = await request.json();
    const { name, description, variables } = body;

    // Check if environment exists and belongs to user
    const existingEnvironment = await prisma.environment.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      include: {
        workspaces: {
          include: {
            workspace: true,
          },
        },
      },
    });

    if (!existingEnvironment) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }

    // Validate and parse variables
    let parsedVariables: Record<string, string> = {};
    if (variables !== undefined) {
      try {
        if (typeof variables === 'string') {
          parsedVariables = JSON.parse(variables);
        } else if (typeof variables === 'object') {
          parsedVariables = variables;
        }
      } catch {
        return NextResponse.json({ error: 'Invalid variables format' }, { status: 400 });
      }
    }

    // Update environment
    const updatedEnvironment = await prisma.environment.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() }),
        ...(variables !== undefined && { variables: JSON.stringify(parsedVariables) }),
      },
    });

    // Sync environment variables to linked workspace containers
    const linkedWorkspaces = existingEnvironment.workspaces.map(we => we.workspace);
    for (const workspace of linkedWorkspaces) {
      if (workspace.status === 'running') {
        try {
          await syncEnvironmentToWorkspaces(workspace.id, [updatedEnvironment]);
        } catch (syncError) {
          console.error(`Error syncing environment to workspace ${workspace.id}:`, syncError);
        }
      }
    }

    return NextResponse.json(updatedEnvironment);
  } catch (error) {
    console.error('Error updating environment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/environments/[id] - Delete an environment
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;

    // Check if environment exists and belongs to user
    const existingEnvironment = await prisma.environment.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!existingEnvironment) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }

    // Delete environment (cascade will handle workspace_environments)
    await prisma.environment.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting environment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
