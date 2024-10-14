module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>'], // set root to the entire project
  testMatch: [
    '**/__tests__/**/*.test.ts', // Matches any .test.ts files in any __tests__ directory
    '**/test/**/*.test.ts'      // Matches any .test.ts files in any test directory
  ],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'  // TypeScript transformation
  }
};