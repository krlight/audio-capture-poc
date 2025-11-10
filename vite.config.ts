import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
    build: {
        sourcemap: "hidden",
    },
    plugins: [
        react({
            babel: {
                plugins: ["react-dev-locator"],
            },
        }),
    ],
});
