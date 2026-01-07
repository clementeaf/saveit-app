/**
 * QR Code Controller
 */

import { Request, Response } from 'express';
import { QRCodeService } from '../services/qrCodeService';
import { ApiResponse } from '@saveit/types';

const qrService = new QRCodeService();

export class QRCodeController {
  /**
   * Generate QR code for a reservation
   * POST /api/qr/generate
   */
  async generateQRCode(req: Request, res: Response): Promise<void> {
    const { reservationId, date } = req.body;

    if (!reservationId || !date) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required parameters: reservationId, date',
        },
        timestamp: new Date(),
      });
      return;
    }

    const qrCodeDataUrl = await qrService.generateQRCode(reservationId, date);

    const response: ApiResponse = {
      success: true,
      data: { qrCodeDataUrl },
      timestamp: new Date(),
    };

    res.status(200).json(response);
  }

  /**
   * Get QR code for a reservation
   * GET /api/qr/:reservationId
   */
  async getQRCode(req: Request, res: Response): Promise<void> {
    const { reservationId } = req.params;

    if (!reservationId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required parameter: reservationId',
        },
        timestamp: new Date(),
      });
      return;
    }

    const qrCodeDataUrl = await qrService.getQRCode(reservationId);

    const response: ApiResponse = {
      success: true,
      data: { qrCodeDataUrl },
      timestamp: new Date(),
    };

    res.status(200).json(response);
  }

  /**
   * Validate QR code (check-in)
   * POST /api/qr/validate
   */
  async validateQRCode(req: Request, res: Response): Promise<void> {
    const { qrData } = req.body;

    if (!qrData) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required parameter: qrData',
        },
        timestamp: new Date(),
      });
      return;
    }

    const result = await qrService.validateQRCode(qrData);

    const response: ApiResponse = {
      success: result.valid,
      data: result,
      timestamp: new Date(),
    };

    res.status(result.valid ? 200 : 400).json(response);
  }
}

export default new QRCodeController();
