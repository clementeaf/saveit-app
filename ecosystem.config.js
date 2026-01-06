module.exports = {
  apps: [
    {
      name: "channel-gateway",
      script: "./services/channel-gateway/dist/services/channel-gateway/src/index.js",
      env: {
        NODE_ENV: "production",
        PORT: 3004
      },
    },
    {
      name: "reservation-service",
      script: "./services/reservation/dist/index.js",
      env: {
        NODE_ENV: "production",
        PORT: 3001
      },
    },
    {
      name: "notification-service",
      script: "./services/notification/dist/services/notification/src/index.js",
      env: {
        NODE_ENV: "production",
        PORT: 3002
      },
    },
    {
      name: "qr-code-service",
      script: "./services/qr-code/dist/services/qr-code/src/index.js",
      env: {
        NODE_ENV: "production",
        PORT: 3003
      },
    },
    {
      name: "analytics-service",
      script: "./services/analytics/dist/services/analytics/src/index.js",
      env: {
        NODE_ENV: "production",
        PORT: 3005
      },
    }
  ]
};
