import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/environments - List all environments for current user
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const environments = await prisma.environment.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        variables: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(environments);
  } catch (error) {
    console.error('Error fetching environments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/environments - Create a new environment
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, variables } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Environment name is required' }, { status: 400 });
    }

    // Validate and parse variables
    let parsedVariables: Record<string, string> = {};
    if (variables) {
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

    const environment = await prisma.environment.create({
      data: {
        name: name.trim(),
        description: description?.trim(),
        variables: JSON.stringify(parsedVariables),
        userId: session.user.id,
      },
    });

    return NextResponse.json(environment, { status: 201 });
  } catch (error) {
    console.error('Error creating environment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
