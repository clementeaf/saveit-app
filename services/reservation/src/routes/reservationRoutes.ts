/**
 * Reservation Routes
 */

import { Router } from 'express';
import { asyncHandler } from '@saveit/middleware';
import reservationController from '../controllers/reservationController';

const router = Router();

// Get availability
router.get('/availability', asyncHandler(reservationController.getAvailability.bind(reservationController)));

// Create reservation
router.post('/', asyncHandler(reservationController.createReservation.bind(reservationController)));

// Get reservation by ID
router.get('/:id', asyncHandler(reservationController.getReservation.bind(reservationController)));

// Confirm reservation
router.post('/:id/confirm', asyncHandler(reservationController.confirmReservation.bind(reservationController)));

// Cancel reservation
router.post('/:id/cancel', asyncHandler(reservationController.cancelReservation.bind(reservationController)));

// Get user reservations
router.get('/user/:userId', asyncHandler(reservationController.getUserReservations.bind(reservationController)));

// Get restaurant reservations
router.get('/restaurant/:restaurantId', asyncHandler(reservationController.getRestaurantReservations.bind(reservationController)));

export default router;
