/**
 * Date and Time Utilities
 * Handles timezone-aware date operations
 */

import {
  format,
  parse,
  addDays,
  addHours,
  addMinutes,
  isBefore,
  isAfter,
  startOfDay,
  endOfDay,
  differenceInHours,
  differenceInMinutes,
} from 'date-fns';
import { zonedTimeToUtc, utcToZonedTime, format as formatTz } from 'date-fns-tz';

export class DateUtils {
  /**
   * Get current date in timezone
   */
  static now(timezone: string): Date {
    return utcToZonedTime(new Date(), timezone);
  }

  /**
   * Format date in specific timezone
   */
  static formatInTimezone(date: Date, timezone: string, formatStr: string): string {
    const zonedDate = utcToZonedTime(date, timezone);
    return formatTz(zonedDate, formatStr, { timeZone: timezone });
  }

  /**
   * Parse date string in timezone to UTC
   */
  static parseInTimezone(dateStr: string, timezone: string, formatStr: string): Date {
    const parsedDate = parse(dateStr, formatStr, new Date());
    return zonedTimeToUtc(parsedDate, timezone);
  }

  /**
   * Check if date is today in timezone
   */
  static isToday(date: Date, timezone: string): boolean {
    const now = this.now(timezone);
    const dateInTz = utcToZonedTime(date, timezone);
    return this.formatInTimezone(dateInTz, timezone, 'yyyy-MM-dd') === 
           this.formatInTimezone(now, timezone, 'yyyy-MM-dd');
  }

  /**
   * Get date string in YYYY-MM-DD format
   */
  static toISODate(date: Date): string {
    return format(date, 'yyyy-MM-dd');
  }

  /**
   * Get time string in HH:mm format
   */
  static toTime(date: Date): string {
    return format(date, 'HH:mm');
  }

  /**
   * Parse ISO date string (YYYY-MM-DD)
   */
  static fromISODate(dateStr: string): Date {
    return parse(dateStr, 'yyyy-MM-dd', new Date());
  }

  /**
   * Parse time string (HH:mm)
   */
  static fromTime(timeStr: string): Date {
    return parse(timeStr, 'HH:mm', new Date());
  }

  /**
   * Combine date and time
   */
  static combineDateTime(dateStr: string, timeStr: string): Date {
    return parse(`${dateStr} ${timeStr}`, 'yyyy-MM-dd HH:mm', new Date());
  }

  /**
   * Add days to date
   */
  static addDays(date: Date, days: number): Date {
    return addDays(date, days);
  }

  /**
   * Add hours to date
   */
  static addHours(date: Date, hours: number): Date {
    return addHours(date, hours);
  }

  /**
   * Add minutes to date
   */
  static addMinutes(date: Date, minutes: number): Date {
    return addMinutes(date, minutes);
  }

  /**
   * Check if date1 is before date2
   */
  static isBefore(date1: Date, date2: Date): boolean {
    return isBefore(date1, date2);
  }

  /**
   * Check if date1 is after date2
   */
  static isAfter(date1: Date, date2: Date): boolean {
    return isAfter(date1, date2);
  }

  /**
   * Get start of day
   */
  static startOfDay(date: Date): Date {
    return startOfDay(date);
  }

  /**
   * Get end of day
   */
  static endOfDay(date: Date): Date {
    return endOfDay(date);
  }

  /**
   * Get difference in hours
   */
  static differenceInHours(date1: Date, date2: Date): number {
    return differenceInHours(date1, date2);
  }

  /**
   * Get difference in minutes
   */
  static differenceInMinutes(date1: Date, date2: Date): number {
    return differenceInMinutes(date1, date2);
  }

  /**
   * Check if time slots overlap
   */
  static doTimeSlotsOverlap(
    start1: Date,
    end1: Date,
    start2: Date,
    end2: Date
  ): boolean {
    return isBefore(start1, end2) && isAfter(end1, start2);
  }

  /**
   * Generate time slots for a day
   */
  static generateTimeSlots(
    startTime: string,
    endTime: string,
    intervalMinutes: number = 30
  ): string[] {
    const slots: string[] = [];
    let current = this.fromTime(startTime);
    const end = this.fromTime(endTime);

    while (isBefore(current, end)) {
      slots.push(this.toTime(current));
      current = this.addMinutes(current, intervalMinutes);
    }

    return slots;
  }
}
