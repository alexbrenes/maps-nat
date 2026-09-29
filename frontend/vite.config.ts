import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the built site works under a GitHub Pages project
  // sub-path (e.g. /maps-nat/) without hardcoding the repo name. Safe here
  // because the app is a single page with no client-side router.
  base: "./",
  server: { port: 5173 },
});
