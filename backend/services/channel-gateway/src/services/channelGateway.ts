/**
 * Channel Gateway Service
 * Routes messages to appropriate channels (WhatsApp, Instagram, Email, WebChat)
 */

import { db } from '@saveit/database';
import { logger } from '@saveit/utils';
import { ChannelType } from '@saveit/types';
import type { PoolClient } from 'pg';
import { ChatBot } from './chatBot';

export interface IncomingMessage {
  channelId: string;
  userId: string;
  channel: ChannelType;
  content: string;
  metadata?: Record<string, any>;
}

export interface OutgoingMessage {
  userId: string;
  channel: ChannelType;
  content: string;
  metadata?: Record<string, any>;
}

export class ChannelGateway {
  private chatBot: ChatBot;

  constructor() {
    this.chatBot = new ChatBot(this);
  }

  /**
   * Get or create conversation for a user and channel
   * @param userId - User ID
   * @param channel - Channel type
   * @param client - Database client
   * @returns Conversation ID
   */
  private async getOrCreateConversation(
    userId: string,
    channel: ChannelType,
    client: any
  ): Promise<string> {
    // Try to get existing active conversation
    const conversationQuery = `
      SELECT id FROM conversations
      WHERE user_id = $1 AND channel = $2 AND status = 'active'
      ORDER BY last_message_at DESC
      LIMIT 1
    `;
    const conversationResult = await client.query(conversationQuery, [
      userId,
      channel,
    ]);

    if (conversationResult.rows.length > 0) {
      return conversationResult.rows[0].id;
    }

    // Create new conversation
    const createConversationQuery = `
      INSERT INTO conversations (user_id, channel, status)
      VALUES ($1, $2, 'active')
      RETURNING id
    `;
    const createResult = await client.query(createConversationQuery, [
      userId,
      channel,
    ]);
    return createResult.rows[0].id;
  }

  /**
   * Route incoming message to appropriate handler
   */
  async handleIncomingMessage(message: IncomingMessage): Promise<any> {
    logger.info('Handling incoming message', {
      channel: message.channel,
      userId: message.userId,
    });

    const client = await db.getClient();
    try {
      const conversationId = await this.getOrCreateConversation(
        message.userId,
        message.channel,
        client
      );

      // Store message
      const insertMessageQuery = `
        INSERT INTO messages (conversation_id, direction, content, metadata)
        VALUES ($1, 'inbound', $2, $3)
        RETURNING *
      `;

      const messageResult = await client.query(insertMessageQuery, [
        conversationId,
        message.content,
        JSON.stringify(message.metadata || {}),
      ]);

      // Update conversation last_message_at
      await client.query(
        `UPDATE conversations SET last_message_at = NOW() WHERE id = $1`,
        [conversationId]
      );

      logger.info('Message stored successfully', {
        messageId: messageResult.rows[0].id,
        channel: message.channel,
      });

      // Process message with intelligent bot and generate automatic response
      const botResponse = await this.chatBot.processMessage(
        message.userId,
        conversationId,
        message.content,
        client
      );

      // Send automatic bot response if generated
      if (botResponse) {
        await this.sendToChannel({
          userId: message.userId,
          channel: message.channel,
          content: botResponse,
          metadata: { type: 'bot_response', automated: true },
        });
      }

      return {
        ...messageResult.rows[0],
        userId: message.userId,
        channel: message.channel,
        direction: 'inbound',
      };
    } finally {
      client.release();
    }
  }

  /**
   * Send message to a specific channel
   */
  async sendToChannel(message: OutgoingMessage): Promise<any> {
    logger.info('Sending message to channel', {
      channel: message.channel,
      userId: message.userId,
    });

    switch (message.channel) {
      case 'whatsapp':
        return this.sendViaWhatsApp(message);
      case 'instagram':
        return this.sendViaInstagram(message);
      case 'email':
        return this.sendViaEmail(message);
      case 'webchat':
        return this.sendViaWebChat(message);
      default:
        throw new Error(`Unsupported channel: ${message.channel}`);
    }
  }

  /**
   * Send message via WhatsApp (Twilio)
   */
  private async sendViaWhatsApp(message: OutgoingMessage): Promise<any> {
    logger.info('Sending WhatsApp message', { userId: message.userId });

    // In a real system, this would call Twilio API
    // For now, we just log and store

    const client = await db.getClient();
    try {
      const conversationId = await this.getOrCreateConversation(
        message.userId,
        ChannelType.WHATSAPP,
        client
      );

      const insertMessageQuery = `
        INSERT INTO messages (conversation_id, direction, content, metadata)
        VALUES ($1, 'outbound', $2, $3)
        RETURNING *
      `;

      const result = await client.query(insertMessageQuery, [
        conversationId,
        message.content,
        JSON.stringify({...message.metadata, provider: 'twilio'}),
      ]);

      await client.query(
        `UPDATE conversations SET last_message_at = NOW() WHERE id = $1`,
        [conversationId]
      );

      return {
        ...result.rows[0],
        userId: message.userId,
        channel: 'whatsapp',
        direction: 'outbound',
      };
    } finally {
      client.release();
    }
  }

  /**
   * Send message via Instagram
   */
  private async sendViaInstagram(message: OutgoingMessage): Promise<any> {
    logger.info('Sending Instagram message', { userId: message.userId });

    // In a real system, this would call Meta Graph API

    const client = await db.getClient();
    try {
      const conversationId = await this.getOrCreateConversation(
        message.userId,
        ChannelType.INSTAGRAM,
        client
      );

      const insertMessageQuery = `
        INSERT INTO messages (conversation_id, direction, content, metadata)
        VALUES ($1, 'outbound', $2, $3)
        RETURNING *
      `;

      const result = await client.query(insertMessageQuery, [
        conversationId,
        message.content,
        JSON.stringify({...message.metadata, provider: 'meta'}),
      ]);

      await client.query(
        `UPDATE conversations SET last_message_at = NOW() WHERE id = $1`,
        [conversationId]
      );

      return {
        ...result.rows[0],
        userId: message.userId,
        channel: 'instagram',
        direction: 'outbound',
      };
    } finally {
      client.release();
    }
  }

  /**
   * Send message via Email (AWS SES)
   */
  private async sendViaEmail(message: OutgoingMessage): Promise<any> {
    logger.info('Sending email', { userId: message.userId });

    // In a real system, this would call AWS SES

    const client = await db.getClient();
    try {
      const conversationId = await this.getOrCreateConversation(
        message.userId,
        ChannelType.EMAIL,
        client
      );

      const insertMessageQuery = `
        INSERT INTO messages (conversation_id, direction, content, metadata)
        VALUES ($1, 'outbound', $2, $3)
        RETURNING *
      `;

      const result = await client.query(insertMessageQuery, [
        conversationId,
        message.content,
        JSON.stringify({...message.metadata, provider: 'aws-ses'}),
      ]);

      await client.query(
        `UPDATE conversations SET last_message_at = NOW() WHERE id = $1`,
        [conversationId]
      );

      return {
        ...result.rows[0],
        userId: message.userId,
        channel: 'email',
        direction: 'outbound',
      };
    } finally {
      client.release();
    }
  }

  /**
   * Send message via WebChat (WebSocket)
   */
  private async sendViaWebChat(message: OutgoingMessage): Promise<any> {
    logger.info('Sending WebChat message', { userId: message.userId });

    // In a real system, this would send via WebSocket to connected clients

    const client = await db.getClient();
    try {
      const conversationId = await this.getOrCreateConversation(
        message.userId,
        ChannelType.WEBCHAT,
        client
      );

      // Store message
      const insertMessageQuery = `
        INSERT INTO messages (conversation_id, direction, content, metadata)
        VALUES ($1, 'outbound', $2, $3)
        RETURNING *
      `;

      const result = await client.query(insertMessageQuery, [
        conversationId,
        message.content,
        JSON.stringify({...message.metadata, provider: 'websocket'}),
      ]);

      // Update conversation last_message_at
      await client.query(
        `UPDATE conversations SET last_message_at = NOW() WHERE id = $1`,
        [conversationId]
      );

      return {
        ...result.rows[0],
        userId: message.userId,
        channel: 'webchat',
        direction: 'outbound',
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get conversation history for a user
   */
  async getConversationHistory(userId: string, limit: number = 50): Promise<any[]> {
    logger.info('Getting conversation history', { userId });

    const query = `
      SELECT 
        m.id,
        c.user_id::text as "userId",
        c.channel::text as channel,
        m.content::text as content,
        m.metadata,
        m.created_at as "createdAt",
        m.direction::text as direction
      FROM messages m
      INNER JOIN conversations c ON m.conversation_id = c.id
      WHERE c.user_id = $1::uuid
      ORDER BY m.created_at ASC
      LIMIT $2
    `;

    const client = await db.getClient();
    try {
      const result = await client.query(query, [userId, limit]);
      return result.rows.map(row => ({
        id: row.id,
        userId: row.userId,
        channel: row.channel,
        content: typeof row.content === 'object' ? JSON.stringify(row.content) : row.content,
        metadata: row.metadata || {},
        createdAt: row.createdAt,
        direction: row.direction,
      }));
    } finally {
      client.release();
    }
  }
}
