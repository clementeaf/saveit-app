/**
 * Channel Types
 * Defines all communication channels supported by SaveIt App
 */

export enum ChannelType {
  WHATSAPP = 'whatsapp',
  INSTAGRAM = 'instagram',
  WEBCHAT = 'webchat',
  EMAIL = 'email',
}

export enum MessageDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

export interface UnifiedMessage {
  id: string;
  conversationId: string;
  channel: ChannelType;
  direction: MessageDirection;
  content: string;
  senderId: string;
  recipientId: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

export interface ChannelUser {
  channelUserId: string;
  channel: ChannelType;
  displayName?: string;
  profilePicture?: string;
  metadata?: Record<string, unknown>;
}

export interface ConversationContext {
  userId: string;
  restaurantId?: string;
  channel: ChannelType;
  intent?: string;
  state?: Record<string, unknown>;
  lastMessageAt: Date;
}

export interface ChannelAdapter {
  channel: ChannelType;
  sendMessage(message: UnifiedMessage): Promise<void>;
  receiveMessage(rawMessage: unknown): Promise<UnifiedMessage>;
  getUserInfo(channelUserId: string): Promise<ChannelUser>;
  validateWebhook(payload: unknown): boolean;
}

export interface ChannelConfig {
  whatsapp: {
    accountSid: string;
    authToken: string;
    phoneNumber: string;
  };
  instagram: {
    appId: string;
    appSecret: string;
    accessToken: string;
    pageId: string;
  };
  email: {
    region: string;
    fromEmail: string;
  };
  webchat: {
    wsUrl: string;
    corsOrigins: string[];
  };
}
