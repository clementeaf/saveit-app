/**
 * ID Generation Utilities
 */

import { randomBytes, randomUUID } from 'crypto';

export class IdGenerator {
  /**
   * Generate UUID v4
   */
  static uuid(): string {
    return randomUUID();
  }

  /**
   * Generate random string (alphanumeric)
   */
  static randomString(length: number = 16): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = randomBytes(length);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i]! % chars.length];
    }
    return result;
  }

  /**
   * Generate QR code string
   */
  static qrCode(): string {
    return this.randomString(32).toUpperCase();
  }

  /**
   * Generate request ID
   */
  static requestId(): string {
    return `req_${Date.now()}_${this.randomString(8)}`;
  }

  /**
   * Generate lock value with maximum uniqueness guarantee
   * Format: UUID-v4 + timestamp + random for collision-free distributed locks
   */
  static lockValue(): string {
    return `${this.uuid()}-${Date.now()}-${this.randomString(8)}`;
  }
}
