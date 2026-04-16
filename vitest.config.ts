import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: false,
      setupFiles: ['./src/audio/__tests__/setup.ts'],
      include: ['src/**/*.{test,spec}.ts'],
      coverage: {
        provider: 'v8',
        include: ['src/audio/**/*.ts'],
        exclude: ['src/audio/__tests__/**', 'src/audio/UseAudioEngine.ts'],
      },
    },
  }),
);
