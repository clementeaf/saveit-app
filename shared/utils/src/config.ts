/**
 * Configuration Loader
 * Centralized configuration management
 */

import { z } from 'zod';

const configSchema = z.object({
  // Environment
  nodeEnv: z.enum(['development', 'staging', 'production']),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']),
  port: z.number().int().positive(),

  // Database
  databaseUrl: z.string().url(),
  databasePoolMin: z.number().int().nonnegative(),
  databasePoolMax: z.number().int().positive(),

  // Redis
  redisUrl: z.string().url(),
  redisClusterMode: z.boolean(),

  // AWS
  awsRegion: z.string(),
  awsAccessKeyId: z.string().optional(),
  awsSecretAccessKey: z.string().optional(),
  awsEndpointUrl: z.string().url().optional(),

  // Twilio (WhatsApp)
  twilioAccountSid: z.string().optional(),
  twilioAuthToken: z.string().optional(),
  twilioWhatsappNumber: z.string().optional(),

  // Meta (Instagram)
  metaAppId: z.string().optional(),
  metaAppSecret: z.string().optional(),
  metaAccessToken: z.string().optional(),

  // JWT
  jwtSecret: z.string().min(32),

  // Reservation Settings
  reservationLockTtlSeconds: z.number().int().positive(),
  maxReservationDaysAhead: z.number().int().positive(),
});

export type AppConfig = z.infer<typeof configSchema>;

let cachedConfig: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const config: AppConfig = {
    // Environment
    nodeEnv: (process.env.NODE_ENV as AppConfig['nodeEnv']) || 'development',
    logLevel: (process.env.LOG_LEVEL as AppConfig['logLevel']) || 'info',
    port: parseInt(process.env.PORT || '3000', 10),

    // Database
    databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/saveit_db',
    databasePoolMin: parseInt(process.env.DATABASE_POOL_MIN || '2', 10),
    databasePoolMax: parseInt(process.env.DATABASE_POOL_MAX || '10', 10),

    // Redis
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    redisClusterMode: process.env.REDIS_CLUSTER_MODE === 'true',

    // AWS
    awsRegion: process.env.AWS_REGION || 'us-east-1',
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    awsEndpointUrl: process.env.AWS_ENDPOINT_URL,

    // Twilio
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioWhatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER,

    // Meta
    metaAppId: process.env.META_APP_ID,
    metaAppSecret: process.env.META_APP_SECRET,
    metaAccessToken: process.env.META_ACCESS_TOKEN,

    // JWT
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',

    // Reservation Settings
    reservationLockTtlSeconds: parseInt(
      process.env.RESERVATION_LOCK_TTL_SECONDS || '30',
      10
    ),
    maxReservationDaysAhead: parseInt(process.env.MAX_RESERVATION_DAYS_AHEAD || '90', 10),
  };

  // Validate configuration
  cachedConfig = configSchema.parse(config);
  return cachedConfig;
}

// Export config instance
export const config = loadConfig();
