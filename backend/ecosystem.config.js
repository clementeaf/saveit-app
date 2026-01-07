require('dotenv').config({ path: require('path').join(__dirname, '.env') });

module.exports = {
  apps: [
    {
      name: "channel-gateway",
      script: "./backend/services/channel-gateway/dist/services/channel-gateway/src/index.js",
      env_file: ".env",
      env: {
        NODE_ENV: process.env.NODE_ENV || "development",
        PORT: 3004,
        DB_HOST: process.env.DB_HOST,
        DB_PORT: process.env.DB_PORT,
        DB_NAME: process.env.DB_NAME,
        DB_USER: process.env.DB_USER,
        DB_PASSWORD: process.env.DB_PASSWORD,
        DB_SSL: process.env.DB_SSL,
        REDIS_URL: process.env.REDIS_URL,
        LOG_LEVEL: process.env.LOG_LEVEL || "info"
      },
    },
    {
      name: "reservation-service",
      script: "./backend/services/reservation/dist/index.js",
      env_file: ".env",
      env: {
        NODE_ENV: process.env.NODE_ENV || "development",
        PORT: 3001,
        DB_HOST: process.env.DB_HOST,
        DB_PORT: process.env.DB_PORT,
        DB_NAME: process.env.DB_NAME,
        DB_USER: process.env.DB_USER,
        DB_PASSWORD: process.env.DB_PASSWORD,
        DB_SSL: process.env.DB_SSL,
        REDIS_URL: process.env.REDIS_URL,
        LOG_LEVEL: process.env.LOG_LEVEL || "info"
      },
    },
    {
      name: "notification-service",
      script: "./backend/services/notification/dist/services/notification/src/index.js",
      env_file: ".env",
      env: {
        NODE_ENV: process.env.NODE_ENV || "development",
        PORT: 3002,
        DB_HOST: process.env.DB_HOST,
        DB_PORT: process.env.DB_PORT,
        DB_NAME: process.env.DB_NAME,
        DB_USER: process.env.DB_USER,
        DB_PASSWORD: process.env.DB_PASSWORD,
        DB_SSL: process.env.DB_SSL,
        REDIS_URL: process.env.REDIS_URL,
        LOG_LEVEL: process.env.LOG_LEVEL || "info"
      },
    },
    {
      name: "qr-code-service",
      script: "./backend/services/qr-code/dist/services/qr-code/src/index.js",
      env_file: ".env",
      env: {
        NODE_ENV: process.env.NODE_ENV || "development",
        PORT: 3003,
        DB_HOST: process.env.DB_HOST,
        DB_PORT: process.env.DB_PORT,
        DB_NAME: process.env.DB_NAME,
        DB_USER: process.env.DB_USER,
        DB_PASSWORD: process.env.DB_PASSWORD,
        DB_SSL: process.env.DB_SSL,
        REDIS_URL: process.env.REDIS_URL,
        LOG_LEVEL: process.env.LOG_LEVEL || "info"
      },
    },
    {
      name: "analytics-service",
      script: "./backend/services/analytics/dist/services/analytics/src/index.js",
      env_file: ".env",
      env: {
        NODE_ENV: process.env.NODE_ENV || "development",
        PORT: 3005,
        DB_HOST: process.env.DB_HOST,
        DB_PORT: process.env.DB_PORT,
        DB_NAME: process.env.DB_NAME,
        DB_USER: process.env.DB_USER,
        DB_PASSWORD: process.env.DB_PASSWORD,
        DB_SSL: process.env.DB_SSL,
        REDIS_URL: process.env.REDIS_URL,
        LOG_LEVEL: process.env.LOG_LEVEL || "info"
      },
    }
  ]
};
