/**
 * Redis Configuration
 */

export interface RedisConfig {
  url: string;
  clusterMode: boolean;
  maxRetriesPerRequest: number;
  enableReadyCheck: boolean;
}

export function getRedisConfig(): RedisConfig {
  const url = process.env.REDIS_URL;

  if (!url) {
    throw new Error('REDIS_URL environment variable is required');
  }

  return {
    url,
    clusterMode: process.env.REDIS_CLUSTER_MODE === 'true',
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  };
}
