/**
 * Reservation Controller
 * Handles HTTP requests for reservation operations
 */

import { Request, Response } from 'express';
import { ReservationService } from '../services/reservationService';
import { ApiResponse } from '@saveit/types';

const reservationService = new ReservationService();

export class ReservationController {
  /**
   * Create a new reservation
   * POST /api/reservations
   */
  async createReservation(req: Request, res: Response): Promise<void> {
    const { restaurantId, date, timeSlot, partySize, guestName, guestPhone, guestEmail, specialRequests, channel } = req.body;

    const reservation = await reservationService.createReservation({
      restaurantId,
      userId: req.body.userId, // Optional, from auth middleware
      date,
      timeSlot,
      partySize,
      guestName,
      guestPhone,
      guestEmail,
      specialRequests,
      channel,
      metadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      },
    });

    const response: ApiResponse = {
      success: true,
      data: reservation,
      timestamp: new Date(),
    };

    res.status(201).json(response);
  }

  /**
   * Get available time slots
   * GET /api/reservations/availability
   */
  async getAvailability(req: Request, res: Response): Promise<void> {
    const { restaurantId, date, partySize } = req.query;

    if (!restaurantId || !date || !partySize) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required query parameters: restaurantId, date, partySize',
        },
        timestamp: new Date(),
      });
      return;
    }

    const slots = await reservationService.getAvailability(
      restaurantId as string,
      date as string,
      parseInt(partySize as string, 10)
    );

    const response: ApiResponse = {
      success: true,
      data: slots,
      timestamp: new Date(),
    };

    res.status(200).json(response);
  }

  /**
   * Get reservation by ID
   * GET /api/reservations/:id
   */
  async getReservation(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { date } = req.query;

    if (!id || !date || typeof date !== 'string') {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required query parameter: date',
        },
        timestamp: new Date(),
      });
      return;
    }

    const reservation = await reservationService.getReservationById(id, date);

    const response: ApiResponse = {
      success: true,
      data: reservation,
      timestamp: new Date(),
    };

    res.status(200).json(response);
  }

  /**
   * Confirm a reservation
   * POST /api/reservations/:id/confirm
   */
  async confirmReservation(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { date } = req.body;

    if (!id || !date || typeof date !== 'string') {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required parameters',
        },
        timestamp: new Date(),
      });
      return;
    }

    const reservation = await reservationService.confirmReservation(id, date);

    const response: ApiResponse = {
      success: true,
      data: reservation,
      timestamp: new Date(),
    };

    res.status(200).json(response);
  }

  /**
   * Cancel a reservation
   * POST /api/reservations/:id/cancel
   */
  async cancelReservation(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { date } = req.body;

    if (!id || !date || typeof date !== 'string') {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required parameters',
        },
        timestamp: new Date(),
      });
      return;
    }

    const reservation = await reservationService.cancelReservation(id, date);

    const response: ApiResponse = {
      success: true,
      data: reservation,
      timestamp: new Date(),
    };

    res.status(200).json(response);
  }

  /**
   * Get reservations by user
   * GET /api/reservations/user/:userId
   */
  async getUserReservations(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const { status, startDate, endDate } = req.query;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required parameter: userId',
        },
        timestamp: new Date(),
      });
      return;
    }

    const filters: { status?: string; startDate?: string; endDate?: string } = {};
    if (typeof status === 'string') filters.status = status;
    if (typeof startDate === 'string') filters.startDate = startDate;
    if (typeof endDate === 'string') filters.endDate = endDate;

    const reservations = await reservationService.getUserReservations(userId, filters);

    const response: ApiResponse = {
      success: true,
      data: reservations,
      timestamp: new Date(),
    };

    res.status(200).json(response);
  }

  /**
   * Get reservations by restaurant
   * GET /api/reservations/restaurant/:restaurantId
   */
  async getRestaurantReservations(req: Request, res: Response): Promise<void> {
    const { restaurantId } = req.params;
    const { date, status } = req.query;

    if (!restaurantId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required parameter: restaurantId',
        },
        timestamp: new Date(),
      });
      return;
    }

    const filters: { date?: string; status?: string } = {};
    if (typeof date === 'string') filters.date = date;
    if (typeof status === 'string') filters.status = status;

    const reservations = await reservationService.getRestaurantReservations(restaurantId, filters);

    const response: ApiResponse = {
      success: true,
      data: reservations,
      timestamp: new Date(),
    };

    res.status(200).json(response);
  }
}

export default new ReservationController();
