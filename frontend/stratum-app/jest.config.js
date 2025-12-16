module.exports = {
  // Use plain jest (not jest-expo) for pure logic tests
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/*Logic.test.ts',  // Pure logic tests only
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
  ],
  transform: {
    '^.+\\.tsx?$': ['babel-jest', { presets: ['@babel/preset-typescript'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};
