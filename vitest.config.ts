import path from 'node:path';
import { defineConfig } from 'vitest/config';

// The app modules under test import Expo packages that only exist inside a
// React Native runtime; the aliases swap them for small Node stubs.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      'expo-crypto': path.resolve(__dirname, 'test/stubs/expo-crypto.ts'),
      'expo-file-system/legacy': path.resolve(__dirname, 'test/stubs/expo-file-system.ts'),
      'expo-sharing': path.resolve(__dirname, 'test/stubs/expo-sharing.ts'),
    },
  },
  test: {
    include: ['utils/**/*.test.ts'],
  },
});
