import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js', 'lib/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['lib/**/*.js'],
      exclude: [
        'lib/prefs/**',  // UI not in scope
        '**/*.test.js',
        '**/mocks/**'
      ],
      all: true
    }
  }
});
