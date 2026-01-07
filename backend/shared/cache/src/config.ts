/**
 * Redis Configuration
 */

export interface RedisConfig {
  url: string;
  clusterMode: boolean;
  maxRetriesPerRequest: number;
  enableReadyCheck: boolean;
}

export function getRedisConfig(): RedisConfig | null {
  const url = process.env.REDIS_URL;

  if (!url || url.trim() === '') {
    console.warn('REDIS_URL not configured, Redis features will be disabled');
    return null;
  }

  return {
    url,
    clusterMode: process.env.REDIS_CLUSTER_MODE === 'true',
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  };
}
