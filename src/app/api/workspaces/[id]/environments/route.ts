import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { syncEnvironmentToWorkspaces } from '@/lib/docker';

// GET /api/workspaces/[id]/environments - Get environments linked to a workspace
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

    // Check if workspace exists and belongs to user
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      include: {
        environments: {
          include: {
            environment: true,
          },
        },
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const environments = workspace.environments.map(we => ({
      id: we.environment.id,
      name: we.environment.name,
      description: we.environment.description,
      variables: we.environment.variables,
      createdAt: we.environment.createdAt,
      updatedAt: we.environment.updatedAt,
    }));

    return NextResponse.json({ environments });
  } catch (error) {
    console.error('Error fetching workspace environments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/workspaces/[id]/environments - Update environments linked to a workspace
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
    const { environmentIds } = body;

    if (!Array.isArray(environmentIds)) {
      return NextResponse.json({ error: 'environmentIds must be an array' }, { status: 400 });
    }

    // Check if workspace exists and belongs to user
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Verify all environments belong to the user
    if (environmentIds.length > 0) {
      const environments = await prisma.environment.findMany({
        where: {
          id: { in: environmentIds },
          userId: session.user.id,
        },
      });

      if (environments.length !== environmentIds.length) {
        return NextResponse.json(
          { error: 'One or more environments not found or not owned by user' },
          { status: 403 }
        );
      }
    }

    // Delete existing workspace-environment links
    await prisma.workspaceEnvironment.deleteMany({
      where: { workspaceId: params.id },
    });

    // Create new workspace-environment links
    if (environmentIds.length > 0) {
      await prisma.workspaceEnvironment.createMany({
        data: environmentIds.map((envId: string) => ({
          workspaceId: params.id,
          environmentId: envId,
        })),
      });
    }

    // Fetch the environments to sync to the container
    const environmentsToSync = await prisma.environment.findMany({
      where: {
        id: { in: environmentIds },
        userId: session.user.id,
      },
    });

    // Sync environment variables to the running container
    try {
      await syncEnvironmentToWorkspaces(params.id, environmentsToSync);
    } catch (syncError) {
      console.error(`Error syncing environments to workspace ${params.id}:`, syncError);
      // Don't fail the request if sync fails - the env will be applied on next restart
    }

    return NextResponse.json({
      environments: environmentsToSync.map(env => ({
        id: env.id,
        name: env.name,
        description: env.description,
        variables: env.variables,
        createdAt: env.createdAt,
        updatedAt: env.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Error updating workspace environments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
