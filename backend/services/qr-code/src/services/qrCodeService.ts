/**
 * QR Code Service
 * Generates and validates QR codes for restaurant reservations
 */

import QRCode from 'qrcode';
import { db } from '@saveit/database';
import { logger } from '@saveit/utils';
import { NotFoundError } from '@saveit/types';

export interface QRCodeData {
  reservationId: string;
  restaurantId: string;
  date: string;
  timeSlot: string;
  partySize: number;
  guestName: string;
}

export class QRCodeService {
  /**
   * Generate QR code for a reservation
   */
  async generateQRCode(reservationId: string, date: string): Promise<string> {
    logger.info('Generating QR code', { reservationId, date });

    // Fetch reservation from database
    const query = `
      SELECT 
        r.id,
        r.restaurant_id,
        r.date,
        r.time_slot,
        r.party_size,
        r.guest_name,
        r.qr_code_id
      FROM reservations r
      WHERE r.id = $1 AND r.date = $2
    `;

    const client = await db.getClient();
    try {
      const result = await client.query(query, [reservationId, date]);
      
      if (result.rows.length === 0) {
        throw new NotFoundError('Reservation', reservationId);
      }

      const reservation = result.rows[0];

      // Generate QR code data
      const qrData: QRCodeData = {
        reservationId: reservation.id,
        restaurantId: reservation.restaurant_id,
        date: reservation.date,
        timeSlot: reservation.time_slot,
        partySize: reservation.party_size,
        guestName: reservation.guest_name,
      };

      // Create QR code as data URL
      const qrCodeDataUrl = await QRCode.toDataURL(JSON.stringify(qrData), {
        errorCorrectionLevel: 'H' as any,
        width: 300,
        margin: 1,
      });

      // Store QR code reference in database
      const updateQuery = `
        INSERT INTO qr_codes (id, reservation_id, data, created_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (reservation_id) DO UPDATE SET data = $3, updated_at = NOW()
      `;

      const qrCodeId = `qr-${reservationId}-${Date.now()}`;
      await client.query(updateQuery, [qrCodeId, reservationId, qrCodeDataUrl]);

      logger.info('QR code generated successfully', { reservationId, qrCodeId });

      return qrCodeDataUrl;
    } finally {
      client.release();
    }
  }

  /**
   * Get QR code for a reservation
   */
  async getQRCode(reservationId: string): Promise<string> {
    logger.info('Getting QR code', { reservationId });

    const query = `
      SELECT data FROM qr_codes WHERE reservation_id = $1 LIMIT 1
    `;

    const client = await db.getClient();
    try {
      const result = await client.query(query, [reservationId]);
      
      if (result.rows.length === 0) {
        throw new NotFoundError('QR Code', reservationId);
      }

      return result.rows[0].data;
    } finally {
      client.release();
    }
  }

  /**
   * Validate QR code (check-in)
   */
  async validateQRCode(qrData: string): Promise<{ valid: boolean; reservationId?: string }> {
    try {
      const data = JSON.parse(qrData) as QRCodeData;

      logger.info('Validating QR code', {
        reservationId: data.reservationId,
        date: data.date,
      });

      // Verify reservation exists and is confirmed
      const query = `
        SELECT id, status FROM reservations
        WHERE id = $1 AND date = $2 AND status IN ('confirmed', 'checked_in')
      `;

      const client = await db.getClient();
      try {
        const result = await client.query(query, [data.reservationId, data.date]);

        if (result.rows.length === 0) {
          logger.warn('QR code validation failed - reservation not found or invalid status', {
            reservationId: data.reservationId,
          });
          return { valid: false };
        }

        // Update status to checked_in
        const updateQuery = `
          UPDATE reservations 
          SET status = 'checked_in', checked_in_at = NOW()
          WHERE id = $1 AND date = $2
        `;

        await client.query(updateQuery, [data.reservationId, data.date]);

        logger.info('QR code validated successfully', { reservationId: data.reservationId });

        return { valid: true, reservationId: data.reservationId };
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error validating QR code', error instanceof Error ? error : undefined);
      return { valid: false };
    }
  }
}
