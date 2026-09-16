import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

// Vite only auto-loads .env into process.env once it resolves the config's
// envDir, which happens AFTER this file's top-level code runs — so reading
// process.env directly here would always miss this directory's own .env
// (a plain `defineConfig({...})` object literal, as this used to be, saw
// only real OS environment variables, never .env file contents). Loading it
// explicitly up front is what makes the .env overrides below actually apply.
const env = loadEnv('development', import.meta.dirname, '');

// Defaults match local dev; override for other hosting targets.
const port = Number(env.PORT ?? 5173);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${env.PORT}"`);
}

const basePath = env.BASE_PATH ?? '/';

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
    // Local dev only: proxies API calls to the api-server so the browser
    // sees one origin (this is what makes better-auth's session cookie and
    // the app's relative `/api/...` fetches work without extra CORS setup).
    proxy: {
      '/api': {
        target: env.API_PROXY_TARGET ?? 'http://localhost:5050',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
