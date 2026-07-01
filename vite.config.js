import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Multi-page static site. Each hand-authored HTML file is its own entry.
// niran-greeter.html is intentionally excluded (deprecated / unlinked demo).
export default defineConfig({
  base: "/",
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        about: resolve(__dirname, "about.html"),
        kayakAi: resolve(__dirname, "kayak-ai.html"),
        kayakAiChat: resolve(__dirname, "kayak-ai-chat.html"),
        kayakSearchOverview: resolve(__dirname, "kayak-search-overview.html"),
        comeTouchGrass: resolve(__dirname, "come-touch-grass.html"),
        highradiusCollections: resolve(__dirname, "highradius-collections.html"),
        play: resolve(__dirname, "play.html"),
        photos: resolve(__dirname, "photos.html"),
        process: resolve(__dirname, "process.html"),
      },
    },
  },
});
