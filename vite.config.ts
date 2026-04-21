import { defineConfig, PluginOption } from "vite";
import { enterDevPlugin, enterProdPlugin } from 'vite-plugin-enter-dev';
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const plugins = [
    ...enterProdPlugin(),
  ];
  if (mode === 'development') {
    plugins.push(...enterDevPlugin());
  }
  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: plugins.filter(Boolean) as PluginOption[],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    base: '/',
    build: {
      outDir: 'dist',
      // Target modern browsers: Chrome 87+, Firefox 78+, Safari 14+, Edge 88+
      target: ['chrome87', 'firefox78', 'safari14', 'edge88'],
      cssTarget: ['chrome87', 'firefox78', 'safari14', 'edge88'],
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            charts: ['recharts'],
            pdf: ['jspdf', 'html2canvas'],
            supabase: ['@supabase/supabase-js'],
          },
        },
      },
    },
  };
});