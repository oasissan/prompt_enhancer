import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const sharedConfig = {
  configFile: false, // Prevent loading vite.config.ts automatically
  plugins: [react()],
};

console.log('🚀 Starting Chrome Extension programmatic build...\n');

// Helper to handle sequential builds
const runBuilds = async () => {
  try {
    // 1. Build UI (Popup and Options)
    console.log('📦 Phase 1: Building UI (Popup & Options)...');
    await build({
      ...sharedConfig,
      build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
          input: {
            popup: resolve(__dirname, 'index.html'),
            options: resolve(__dirname, 'options.html'),
          },
          output: {
            entryFileNames: '[name].js',
            chunkFileNames: 'assets/[name].[hash].js',
            assetFileNames: 'assets/[name].[ext]',
          },
        },
      },
    });

    // 2. Build Content Script (Self-contained)
    console.log('\n📦 Phase 2: Building Content Script (Self-contained)...');
    await build({
      ...sharedConfig,
      build: {
        outDir: 'dist',
        emptyOutDir: false,
        rollupOptions: {
          input: {
            content: resolve(__dirname, 'src/content.tsx'),
          },
          output: {
            entryFileNames: '[name].js',
            chunkFileNames: '[name].js',
            assetFileNames: '[name].[ext]',
          },
        },
      },
    });

    // 3. Build Background Script (Self-contained)
    console.log('\n📦 Phase 3: Building Background Service Worker (Self-contained)...');
    await build({
      ...sharedConfig,
      build: {
        outDir: 'dist',
        emptyOutDir: false,
        rollupOptions: {
          input: {
            background: resolve(__dirname, 'src/background.ts'),
          },
          output: {
            entryFileNames: '[name].js',
            chunkFileNames: '[name].js',
            assetFileNames: '[name].[ext]',
          },
        },
      },
    });

    console.log('\n✅ Extension build completed successfully! All assets are in dist/');
  } catch (error) {
    console.error('\n❌ Build failed:', error);
    process.exit(1);
  }
};

runBuilds();
