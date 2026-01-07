/**
 * Chat Service
 * API service for chat-related operations
 */

import { apiClient } from '../client';
import { API_ENDPOINTS } from '../config';
import type { ApiResponse } from '../types/common';
import type {
  ChatMessage,
  SendMessageRequest,
  IncomingMessageRequest,
} from '../types/chat';

/**
 * Chat Service Class
 * Provides methods for chat operations
 */
class ChatService {
  /**
   * Get conversation history for a user
   * @param userId - User ID
   * @param limit - Maximum number of messages to retrieve
   * @returns Conversation history
   */
  async getConversationHistory(userId: string, limit: number = 50): Promise<ChatMessage[]> {
    const response = await apiClient.get<ApiResponse<ChatMessage[]>>(
      API_ENDPOINTS.chatHistory(userId),
      { params: { limit } }
    );
    return response.data.data;
  }

  /**
   * Send a message
   * @param data - Message data
   * @returns Sent message
   */
  /**
   * Send message from user (triggers bot response)
   * This should use /api/channels/incoming to trigger the intelligent bot
   */
  async sendMessage(data: SendMessageRequest): Promise<ChatMessage> {
    // Use incoming endpoint to trigger bot response
    const response = await apiClient.post<ApiResponse<ChatMessage>>(
      API_ENDPOINTS.chatIncoming,
      {
        channelId: `webchat-${data.userId}`,
        userId: data.userId,
        channel: data.channel,
        content: data.content,
        metadata: data.metadata,
      }
    );
    return response.data.data;
  }

  /**
   * Handle incoming message
   * @param data - Incoming message data
   * @returns Processed message
   */
  async handleIncomingMessage(data: IncomingMessageRequest): Promise<ChatMessage> {
    const response = await apiClient.post<ApiResponse<ChatMessage>>(
      API_ENDPOINTS.chatIncoming,
      data
    );
    return response.data.data;
  }
}

export const chatService = new ChatService();

