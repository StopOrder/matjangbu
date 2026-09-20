import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const api = "http://127.0.0.1:8108"

// 빌드는 ../site/try 로 나간다(index.html + assets/). recorded.json·sample-envelopes.json 은 web.record 가 만드는
// 데이터 파일이라 emptyOutDir 를 끄고, package.json 의 build 스크립트가 assets/ 만 지운다.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: { outDir: "../site/try", emptyOutDir: false },
  server: {
    host: "127.0.0.1",
    proxy: {
      "/api": api,
      "/recorded.json": { target: api, rewrite: (p) => "/try" + p },
      "/sample-envelopes.json": { target: api, rewrite: (p) => "/try" + p },
      "/assets/fonts": api,
    },
  },
})
