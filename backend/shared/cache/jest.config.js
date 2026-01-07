/** @type {import('jest').Config} */
module.exports = {
  displayName: '@saveit/cache',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['<rootDir>/src/**/*.ts', '!<rootDir>/src/**/*.d.ts'],
  moduleNameMapper: {
    '^@saveit/types$': '<rootDir>/../types/src',
  },
};
