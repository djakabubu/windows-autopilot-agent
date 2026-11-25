import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
var backend = "http://127.0.0.1:43127";
export default defineConfig({
    base: "./",
    plugins: [react()],
    server: {
        proxy: {
            "/api": {
                target: backend,
                changeOrigin: true,
                headers: { Origin: backend },
            },
        },
    },
});
