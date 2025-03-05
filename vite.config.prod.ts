
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";
import { createHtmlPlugin } from "vite-plugin-html";
import { compression } from "vite-plugin-compression2";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env variables
  const env = loadEnv(mode, process.cwd());

  return {
    plugins: [
      react(),
      createHtmlPlugin({
        minify: true,
        inject: {
          data: {
            title: 'FlashTrade Logic - Blockchain Arbitrage Trading Platform',
            description: 'Professional blockchain arbitrage trading platform for DeFi markets',
          },
        },
      }),
      compression({
        algorithm: "gzip",
        exclude: [/\.(br)$/, /\.(gz)$/],
      }),
      compression({
        algorithm: "brotliCompress",
        exclude: [/\.(br)$/, /\.(gz)$/],
      }),
      visualizer({
        open: false,
        gzipSize: true,
        brotliSize: true,
        filename: "dist/stats.html",
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      target: 'es2020',
      outDir: "dist",
      assetsDir: "assets",
      sourcemap: false,
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            ethers: ['ethers'],
            charts: ['recharts'],
            ui: [
              '@radix-ui/react-accordion',
              '@radix-ui/react-alert-dialog',
              '@radix-ui/react-avatar',
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-tabs',
              '@radix-ui/react-toast',
              'class-variance-authority',
              'clsx',
              'tailwind-merge',
            ],
          },
          entryFileNames: 'assets/[name].[hash].js',
          chunkFileNames: 'assets/[name].[hash].js',
          assetFileNames: 'assets/[name].[hash].[ext]',
        },
      },
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'ethers',
        'recharts',
      ],
      esbuildOptions: {
        target: 'es2020',
      },
    },
  };
});
