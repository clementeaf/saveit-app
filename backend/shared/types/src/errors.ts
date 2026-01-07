/**
 * Error Types and Custom Errors
 */

export enum ErrorCode {
  // General errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',

  // Reservation-specific errors
  TABLE_NOT_AVAILABLE = 'TABLE_NOT_AVAILABLE',
  RESERVATION_CONFLICT = 'RESERVATION_CONFLICT',
  INVALID_TIME_SLOT = 'INVALID_TIME_SLOT',
  OUTSIDE_BUSINESS_HOURS = 'OUTSIDE_BUSINESS_HOURS',
  TOO_FAR_IN_ADVANCE = 'TOO_FAR_IN_ADVANCE',
  TOO_SHORT_NOTICE = 'TOO_SHORT_NOTICE',
  CANCELLATION_DEADLINE_PASSED = 'CANCELLATION_DEADLINE_PASSED',
  PARTY_SIZE_EXCEEDS_CAPACITY = 'PARTY_SIZE_EXCEEDS_CAPACITY',

  // Lock/concurrency errors
  LOCK_ACQUISITION_FAILED = 'LOCK_ACQUISITION_FAILED',
  LOCK_TIMEOUT = 'LOCK_TIMEOUT',
  CONCURRENT_MODIFICATION = 'CONCURRENT_MODIFICATION',

  // Channel errors
  CHANNEL_ERROR = 'CHANNEL_ERROR',
  MESSAGE_SEND_FAILED = 'MESSAGE_SEND_FAILED',
  WEBHOOK_VALIDATION_FAILED = 'WEBHOOK_VALIDATION_FAILED',

  // Database errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
}

export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
  requestId?: string;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    if (details !== undefined) {
      this.details = details;
    }
    this.timestamp = new Date();

    // Maintains proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): ErrorDetails {
    const result: ErrorDetails = {
      code: this.code,
      message: this.message,
      timestamp: this.timestamp,
    };
    if (this.details !== undefined) {
      result.details = this.details;
    }
    return result;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.VALIDATION_ERROR, message, 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(ErrorCode.NOT_FOUND, message, 404);
    this.name = 'NotFoundError';
  }
}

export class ReservationConflictError extends AppError {
  constructor(details?: Record<string, unknown>) {
    super(
      ErrorCode.RESERVATION_CONFLICT,
      'The selected time slot is no longer available',
      409,
      details
    );
    this.name = 'ReservationConflictError';
  }
}

export class LockAcquisitionError extends AppError {
  constructor(lockKey: string) {
    super(ErrorCode.LOCK_ACQUISITION_FAILED, `Failed to acquire lock: ${lockKey}`, 409, {
      lockKey,
    });
    this.name = 'LockAcquisitionError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.DATABASE_ERROR, message, 500, details);
    this.name = 'DatabaseError';
  }
}

export class ChannelError extends AppError {
  constructor(channel: string, message: string, details?: Record<string, unknown>) {
    super(ErrorCode.CHANNEL_ERROR, `${channel}: ${message}`, 500, { channel, ...details });
    this.name = 'ChannelError';
  }
}
