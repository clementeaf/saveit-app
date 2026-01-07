/**
 * Validation Schemas
 * Zod schemas for input validation
 */

import { z } from 'zod';

/**
 * UUID validation
 */
export const uuidSchema = z.string().uuid();

/**
 * Email validation
 */
export const emailSchema = z.string().email();

/**
 * Phone validation (international format)
 */
export const phoneSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/);

/**
 * Date validation (YYYY-MM-DD format)
 */
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * Time validation (HH:mm format)
 */
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/);

/**
 * Channel type validation
 */
export const channelSchema = z.enum(['whatsapp', 'instagram', 'webchat', 'email']);

/**
 * Reservation request schema
 */
export const reservationRequestSchema = z.object({
  restaurantId: uuidSchema,
  userId: uuidSchema,
  date: dateSchema,
  timeSlot: timeSchema,
  partySize: z.number().int().positive().max(50),
  guestName: z.string().min(1).max(255),
  guestPhone: phoneSchema.optional(),
  guestEmail: emailSchema.optional(),
  specialRequests: z.string().max(1000).optional(),
  channel: channelSchema,
});

/**
 * Availability query schema
 */
export const availabilityQuerySchema = z.object({
  restaurantId: uuidSchema,
  date: dateSchema,
  partySize: z.number().int().positive().max(50),
  preferredTimeSlot: timeSchema.optional(),
});

/**
 * User creation schema
 */
export const createUserSchema = z.object({
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  fullName: z.string().min(1).max(255),
});

/**
 * Restaurant creation schema
 */
export const createRestaurantSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  address: z.string().min(1),
  phone: phoneSchema,
  email: emailSchema,
  timezone: z.string(),
  businessHours: z.record(z.array(z.object({
    open: timeSchema,
    close: timeSchema,
  }))),
  maxAdvanceDays: z.number().int().positive(),
  minAdvanceHours: z.number().int().nonnegative(),
  reservationDurationMinutes: z.number().int().positive(),
  cancellationHoursBefore: z.number().int().positive(),
  requiresDeposit: z.boolean().optional(),
  depositAmount: z.number().positive().optional(),
});

/**
 * Pagination schema
 */
export const paginationSchema = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional(),
});

/**
 * Validate data against schema
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Safe validate (returns result with success flag)
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
