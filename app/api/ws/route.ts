import { NextRequest } from 'next/server';
import { WebSocketServer, WebSocket } from 'ws';
import { createServerClient } from '@/lib/supabase';
import { wsManager, createWSMessage } from '@/lib/websocket';
import { handleError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    // Check if this is a WebSocket upgrade request
    if (request.headers.get('upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const token = request.headers.get('authorization')?.replace('Bearer ', '');

    if (!projectId || !token) {
      return new Response('Missing projectId or auth token', { status: 400 });
    }

    // Verify authentication
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Verify project access
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return new Response('Project not found', { status: 404 });
    }

    // Create WebSocket server (this would be handled differently in production)
    const ws = new WebSocket();
    const wsServer = new WebSocketServer({ noServer: true });

    // Handle WebSocket connection
    wsServer.on('connection', (socket: WebSocket) => {
      // Add connection to manager
      wsManager.addConnection(projectId, user.id, socket, user.email || '');

      socket.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          // Handle different message types
          switch (message.type) {
            case 'ping':
              socket.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
              break;
              
            case 'feedback:created':
            case 'feedback:voted':
            case 'comment:added':
            case 'status:changed':
            case 'poll:created':
            case 'poll:voted':
              // Broadcast to other users in the project
              wsManager.broadcastToProjectExceptSender(projectId, {
                type: message.type,
                payload: message.payload,
                timestamp: new Date().toISOString(),
                user_id: user.id
              }, user.id);
              break;
              
            default:
              console.log('Unknown message type:', message.type);
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });

      socket.on('close', () => {
        wsManager.removeConnection(projectId, user.id, socket);
      });

      socket.on('error', (error) => {
        console.error('WebSocket error:', error);
        wsManager.removeConnection(projectId, user.id, socket);
      });

      // Send welcome message with current presence
      const presence = wsManager.getProjectPresence(projectId);
      socket.send(JSON.stringify(createWSMessage('project:presence', presence, 'system')));
    });

    return new Response(null, {
      status: 101,
      webSocket: ws as any
    });
  } catch (error) {
    console.error('WebSocket connection error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}