import { WebSocketMessage, ProjectPresence } from '../types';

export class WebSocketManager {
  private connections: Map<string, Set<WebSocket>> = new Map();
  private userConnections: Map<string, Set<WebSocket>> = new Map();
  private projectPresence: Map<string, Map<string, ProjectPresence>> = new Map();

  addConnection(projectId: string, userId: string, ws: WebSocket, userEmail: string) {
    // Add to project connections
    if (!this.connections.has(projectId)) {
      this.connections.set(projectId, new Set());
    }
    this.connections.get(projectId)!.add(ws);

    // Add to user connections
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(ws);

    // Update presence
    if (!this.projectPresence.has(projectId)) {
      this.projectPresence.set(projectId, new Map());
    }
    
    const presence = this.projectPresence.get(projectId)!;
    presence.set(userId, {
      user_id: userId,
      email: userEmail,
      last_seen: new Date().toISOString(),
      is_online: true
    });

    // Broadcast user online event
    this.broadcastToProject(projectId, {
      type: 'user:online',
      payload: presence.get(userId),
      timestamp: new Date().toISOString(),
      user_id: userId
    });

    // Send current presence list to new user
    this.sendToUser(userId, {
      type: 'project:presence',
      payload: Array.from(presence.values()),
      timestamp: new Date().toISOString(),
      user_id: 'system'
    });
  }

  removeConnection(projectId: string, userId: string, ws: WebSocket) {
    // Remove from project connections
    const projectConns = this.connections.get(projectId);
    if (projectConns) {
      projectConns.delete(ws);
      if (projectConns.size === 0) {
        this.connections.delete(projectId);
      }
    }

    // Remove from user connections
    const userConns = this.userConnections.get(userId);
    if (userConns) {
      userConns.delete(ws);
      if (userConns.size === 0) {
        this.userConnections.delete(userId);
        this.setUserOffline(projectId, userId);
      }
    }
  }

  setUserOffline(projectId: string, userId: string) {
    const presence = this.projectPresence.get(projectId);
    if (presence && presence.has(userId)) {
      const userPresence = presence.get(userId)!;
      userPresence.is_online = false;
      userPresence.last_seen = new Date().toISOString();

      // Broadcast user offline event
      this.broadcastToProject(projectId, {
        type: 'user:offline',
        payload: userPresence,
        timestamp: new Date().toISOString(),
        user_id: userId
      });

      // Remove from presence after a delay (to handle reconnections)
      setTimeout(() => {
        const currentPresence = this.projectPresence.get(projectId);
        if (currentPresence && !currentPresence.get(userId)?.is_online) {
          currentPresence.delete(userId);
        }
      }, 30000); // 30 seconds
    }
  }

  broadcastToProject(projectId: string, message: WebSocketMessage) {
    const connections = this.connections.get(projectId);
    if (connections) {
      const messageStr = JSON.stringify(message);
      connections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(messageStr);
        }
      });
    }
  }

  broadcastToProjectExceptSender(projectId: string, message: WebSocketMessage, senderUserId: string) {
    const connections = this.connections.get(projectId);
    if (connections) {
      const messageStr = JSON.stringify(message);
      connections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN && (ws as any).userId !== senderUserId) {
          ws.send(messageStr);
        }
      });
    }
  }

  sendToUser(userId: string, message: WebSocketMessage) {
    const connections = this.userConnections.get(userId);
    if (connections) {
      const messageStr = JSON.stringify(message);
      connections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(messageStr);
        }
      });
    }
  }

  getProjectPresence(projectId: string): ProjectPresence[] {
    const presence = this.projectPresence.get(projectId);
    return presence ? Array.from(presence.values()) : [];
  }

  getConnectionCount(projectId: string): number {
    const connections = this.connections.get(projectId);
    return connections ? connections.size : 0;
  }

  // Cleanup stale connections
  cleanup() {
    this.connections.forEach((conns, projectId) => {
      conns.forEach(ws => {
        if (ws.readyState !== WebSocket.OPEN) {
          conns.delete(ws);
        }
      });
      if (conns.size === 0) {
        this.connections.delete(projectId);
      }
    });

    this.userConnections.forEach((conns, userId) => {
      conns.forEach(ws => {
        if (ws.readyState !== WebSocket.OPEN) {
          conns.delete(ws);
        }
      });
      if (conns.size === 0) {
        this.userConnections.delete(userId);
      }
    });
  }
}

// Global instance
export const wsManager = new WebSocketManager();

// Event type helpers
export function createWSMessage(
  type: WebSocketMessage['type'],
  payload: any,
  userId: string
): WebSocketMessage {
  return {
    type,
    payload,
    timestamp: new Date().toISOString(),
    user_id: userId
  };
}

// Helper functions for common events
export function createFeedbackCreatedMessage(feedback: any, userId: string): WebSocketMessage {
  return createWSMessage('feedback:created', {
    feedback_id: feedback.id,
    text: feedback.text,
    project_id: feedback.project_id,
    source_type: feedback.source_type,
    vote_count: feedback.vote_count
  }, userId);
}

export function createFeedbackVotedMessage(
  feedbackId: string,
  userId: string,
  newVoteCount: number
): WebSocketMessage {
  return createWSMessage('feedback:voted', {
    feedback_id: feedbackId,
    vote_count: newVoteCount,
    voter_user_id: userId
  }, userId);
}

export function createCommentAddedMessage(
  feedbackId: string,
  comment: any,
  userId: string
): WebSocketMessage {
  return createWSMessage('comment:added', {
    feedback_id: feedbackId,
    comment_id: comment.id,
    comment_text: comment.text,
    user_name: comment.user_name,
    user_email: comment.user_email
  }, userId);
}

export function createStatusChangedMessage(
  feedbackId: string,
  newStatus: any,
  userId: string
): WebSocketMessage {
  return createWSMessage('status:changed', {
    feedback_id: feedbackId,
    status: newStatus
  }, userId);
}

export function createPollCreatedMessage(poll: any, userId: string): WebSocketMessage {
  return createWSMessage('poll:created', {
    poll_id: poll.id,
    title: poll.title,
    description: poll.description,
    project_id: poll.project_id
  }, userId);
}

export function createPollVotedMessage(
  pollId: string,
  optionId: string,
  userId: string,
  results: any
): WebSocketMessage {
  return createWSMessage('poll:voted', {
    poll_id: pollId,
    option_id: optionId,
    voter_user_id: userId,
    results
  }, userId);
}