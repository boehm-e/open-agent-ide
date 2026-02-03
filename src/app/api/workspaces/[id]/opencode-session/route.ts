import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Docker from 'dockerode';

// Initialize Docker client
const docker = new Docker({
  host: process.env.DOCKER_SOCKET_PROXY?.replace(':2375', '') || 'docker-socket-proxy',
  port: 2375,
});

// This endpoint queries the OpenCode container to get the most recent session ID
// by listing session files in the storage directory

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: workspaceId } = await params;

  // Get workspace
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId, userId: session.user.id },
  });

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  try {
    // Get the opencode container
    const container = docker.getContainer(`opencode-${workspaceId}`);
    
    // Try multiple methods to find the session ID
    // Method 1: Query the SQLite database for the most recent session
    const sqliteExec = await container.exec({
      Cmd: [
        'sh', '-c',
        `sqlite3 /root/.local/share/opencode/data.db "SELECT id FROM session ORDER BY created_at DESC LIMIT 1;" 2>/dev/null || echo ""`
      ],
      AttachStdout: true,
      AttachStderr: true,
    });

    let sessionId = await execAndParse(sqliteExec);
    console.log(`[opencode-session] SQLite result: "${sessionId}"`);
    
    // Method 2: Find ses_* directories recursively if SQLite didn't work
    if (!sessionId || !sessionId.startsWith('ses_')) {
      const findExec = await container.exec({
        Cmd: [
          'sh', '-c',
          // Find ses_* directories anywhere under storage, sort by modification time
          `find /root/.local/share/opencode/storage -type d -name "ses_*" 2>/dev/null | head -1 | xargs -r basename`
        ],
        AttachStdout: true,
        AttachStderr: true,
      });
      const findResult = await execAndParse(findExec);
      console.log(`[opencode-session] find result: "${findResult}"`);
      if (findResult && findResult.startsWith('ses_')) {
        sessionId = findResult;
      }
    }

    // Extract session ID (format: ses_XXXX)
    const sessionMatch = sessionId?.match(/ses_[a-zA-Z0-9_]+/);
    console.log(`[opencode-session] Final match: ${sessionMatch?.[0] || null}`);
    if (sessionMatch) {
      return NextResponse.json({ sessionId: sessionMatch[0] });
    }

    return NextResponse.json({ sessionId: null });
  } catch (error) {
    console.error('Error fetching OpenCode session:', error);
    return NextResponse.json({ sessionId: null });
  }
}

// Helper to execute docker command and parse multiplexed output
async function execAndParse(exec: Docker.Exec): Promise<string> {
  const stream = await exec.start({ Detach: false });
  
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve) => {
    stream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    stream.on('end', resolve);
  });

  const rawOutput = Buffer.concat(chunks);
  
  // Docker multiplexed stream format: parse headers
  let output = '';
  for (let i = 0; i < rawOutput.length; ) {
    if (i + 8 <= rawOutput.length) {
      const size = rawOutput.readUInt32BE(i + 4);
      const content = rawOutput.slice(i + 8, i + 8 + size);
      output += content.toString('utf8');
      i += 8 + size;
    } else {
      output += rawOutput.slice(i).toString('utf8');
      break;
    }
  }
  
  return output.trim();
}
