/** @type {import('jest').Config} */
module.exports = {
  displayName: '@saveit/reservation-service',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['<rootDir>/src/**/*.ts', '!<rootDir>/src/**/*.d.ts'],
  moduleNameMapper: {
    '^@saveit/types$': '<rootDir>/../../shared/types/src',
    '^@saveit/database$': '<rootDir>/../../shared/database/src',
    '^@saveit/cache$': '<rootDir>/../../shared/cache/src',
    '^@saveit/utils$': '<rootDir>/../../shared/utils/src',
    '^@saveit/middleware$': '<rootDir>/../../shared/middleware/src',
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
};
