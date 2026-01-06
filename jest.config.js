/** @type {import('jest').Config} */
module.exports = {
  projects: [
    '<rootDir>/shared/*/jest.config.js',
    '<rootDir>/services/*/jest.config.js',
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  coverageThresholds: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
