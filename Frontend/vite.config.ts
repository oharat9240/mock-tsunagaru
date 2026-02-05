import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  base: process.env.NODE_ENV === "production" ? "/mock-tsunagaru/" : "/",
  plugins: [reactRouter(), tsconfigPaths()],
  optimizeDeps: {
    include: ["react", "react-dom", "@mantine/core", "@mantine/form", "@mantine/dates", "@mantine/hooks"],
  },
  define: {
    "process.env.BUILD_DATE": JSON.stringify(process.env.BUILD_DATE || new Date().toISOString()),
  },
  server: {
    host: true,
    port: 5173,
  },
});
