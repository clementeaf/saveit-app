/**
 * QR Code Routes
 */

import { Router } from 'express';
import { asyncHandler } from '@saveit/middleware';
import qrCodeController from '../controllers/qrCodeController';

const router = Router();

// Generate QR code
router.post('/generate', asyncHandler(qrCodeController.generateQRCode.bind(qrCodeController)));

// Get QR code
router.get('/:reservationId', asyncHandler(qrCodeController.getQRCode.bind(qrCodeController)));

// Validate QR code (check-in)
router.post('/validate', asyncHandler(qrCodeController.validateQRCode.bind(qrCodeController)));

export default router;
