/**
 * Chat API Types
 */

export interface ChatMessage {
  id: string;
  userId: string;
  channel: 'webchat' | 'whatsapp' | 'instagram' | 'email';
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  direction?: 'inbound' | 'outbound';
}

export interface SendMessageRequest {
  userId: string;
  channel: 'webchat' | 'whatsapp' | 'instagram' | 'email';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface IncomingMessageRequest {
  channelId: string;
  userId: string;
  channel: 'webchat' | 'whatsapp' | 'instagram' | 'email';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface ConversationHistoryResponse {
  data: ChatMessage[];
  total: number;
}

