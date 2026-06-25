import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 开发时代理 /api → 真实 Bovin REST，避免浏览器跨域（须与 default-api-base.js 的 DEFAULT_REST_ORIGIN 一致或可设环境变量覆盖） */
const DEV_API_UPSTREAM = process.env.VITE_DEV_API_UPSTREAM || "https://www.prbgame.com";
const DOWNLOAD_API_UPSTREAM = process.env.VITE_DOWNLOAD_API_UPSTREAM || "https://www.prbgame.com";
console.log(DOWNLOAD_API_UPSTREAM,'DOWNLOAD_API_UPSTREAM')

export default defineConfig({
  base: '/freqfrontend/',
  build: {
    outDir: 'freqfrontend',
  },
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  },
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true
      }
    }
  },
  server: {
    port: 9999,
    host: true,
    proxy: {
      "/api": {
        target: DEV_API_UPSTREAM,
        changeOrigin: true
      },
      "/api-web": {
        target: DOWNLOAD_API_UPSTREAM,
        changeOrigin: true,
      },
    }
  }
});
