import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  const local = loadEnv(mode, process.cwd(), "COURSE_RADAR_");
  const apiTarget = process.env.COURSE_RADAR_API_TARGET || local.COURSE_RADAR_API_TARGET || "http://127.0.0.1:3004";
  const agentTarget = process.env.COURSE_RADAR_AGENT_TARGET || local.COURSE_RADAR_AGENT_TARGET || "http://127.0.0.1:8000";
  const agentProxy = { target: agentTarget, changeOrigin: true };
  const accountAgentProxy = { ...agentProxy, rewrite: (path: string) => path.replace(/^\/api\/v1\/agent/, "/agent"), cookiePathRewrite: { "/agent": "/api/v1/agent" } };
  return {
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    proxy: { "/api/v1/agent": accountAgentProxy, "/agent": agentProxy, "/api/v1": { target: apiTarget, changeOrigin: true } },
  },
  preview: {
    proxy: { "/api/v1/agent": accountAgentProxy, "/agent": agentProxy, "/api/v1": { target: apiTarget, changeOrigin: true } },
  },
};
});
