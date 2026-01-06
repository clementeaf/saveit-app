/**
 * Notification Service
 * Handles sending notifications via multiple channels
 */

import { db } from '@saveit/database';
import { logger } from '@saveit/utils';
import { ChannelType } from '@saveit/types';

export interface NotificationPayload {
  reservationId: string;
  userId: string;
  channel: ChannelType;
  type: 'confirmation' | 'reminder' | 'cancellation' | 'check_in';
  data: Record<string, any>;
}

export class NotificationService {
  /**
   * Send a notification
   */
  async sendNotification(payload: NotificationPayload): Promise<any> {
    logger.info('Sending notification', {
      reservationId: payload.reservationId,
      channel: payload.channel,
      type: payload.type,
    });

    const query = `
      INSERT INTO messages (
        user_id,
        conversation_id,
        channel,
        message_type,
        content,
        metadata,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `;

    const client = await db.getClient();
    try {
      // In a real system, you would:
      // 1. Look up user contact info
      // 2. Call external service (Twilio, AWS SES, etc.)
      // 3. Log the attempt
      // 4. Store the notification record

      const content = this.buildMessageContent(payload);

      const result = await client.query(query, [
        payload.userId,
        null, // conversation_id would be looked up
        payload.channel,
        payload.type,
        content,
        JSON.stringify(payload.data),
      ]);

      logger.info('Notification sent successfully', {
        reservationId: payload.reservationId,
        messageId: result.rows[0].id,
      });

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Send reservation confirmation notification
   */
  async sendConfirmation(
    reservationId: string,
    userId: string,
    channel: ChannelType,
    data: any
  ): Promise<any> {
    return this.sendNotification({
      reservationId,
      userId,
      channel,
      type: 'confirmation',
      data,
    });
  }

  /**
   * Send reservation reminder notification
   */
  async sendReminder(
    reservationId: string,
    userId: string,
    channel: ChannelType,
    data: any
  ): Promise<any> {
    return this.sendNotification({
      reservationId,
      userId,
      channel,
      type: 'reminder',
      data,
    });
  }

  /**
   * Send cancellation notification
   */
  async sendCancellation(
    reservationId: string,
    userId: string,
    channel: ChannelType,
    data: any
  ): Promise<any> {
    return this.sendNotification({
      reservationId,
      userId,
      channel,
      type: 'cancellation',
      data,
    });
  }

  /**
   * Get notification history for a reservation
   */
  async getNotificationHistory(reservationId: string): Promise<any[]> {
    logger.info('Getting notification history', { reservationId });

    const query = `
      SELECT m.* FROM messages m
      WHERE m.metadata->>'reservationId' = $1
      ORDER BY m.created_at DESC
      LIMIT 50
    `;

    const client = await db.getClient();
    try {
      const result = await client.query(query, [reservationId]);
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Build message content based on notification type
   */
  private buildMessageContent(payload: NotificationPayload): string {
    const { type, data } = payload;

    switch (type) {
      case 'confirmation':
        return `Your reservation at ${data.restaurantName} on ${data.date} at ${data.timeSlot} has been confirmed.`;

      case 'reminder':
        return `Reminder: You have a reservation at ${data.restaurantName} today at ${data.timeSlot}.`;

      case 'cancellation':
        return `Your reservation at ${data.restaurantName} on ${data.date} has been cancelled.`;

      case 'check_in':
        return `Welcome! Please check in at the host stand. Your table will be ready shortly.`;

      default:
        return 'Notification from SaveIt App';
    }
  }
}
