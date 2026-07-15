import { defineConfig, loadEnv } from "vite";
import errpulse from '@errpulse/vite';  // ← 新增

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    return {
        plugins: [
            errpulse(),  // ← 新增
        ],
        root: "./",
        server: {
            port: 3000,
            open: true,
            proxy: {
                "/api": {
                    target: "http://localhost:9999",
                    changeOrigin: true,
                    secure: false,
                    timeout: 10000,
                    rewrite: (path) => path,
                },
                "/uploads": {
                    target: "http://localhost:9999",
                    changeOrigin: true,
                    secure: false,
                },
                "/websocket": {
                    target: "ws://localhost:9999",
                    ws: true,
                    changeOrigin: true,
                    secure: false,
                    timeout: 60000,
                },
            },
            hmr: {
                overlay: true,
            },
            watch: {
                usePolling: true,
            },
        },
        build: {
            outDir: "dist",
            rollupOptions: {
                input: {
                    main: "index.html",
                },
                output: {
                    entryFileNames: 'js/[name].[hash].js',
                    chunkFileNames: 'js/[name].[hash].js',
                    assetFileNames: 'assets/[name].[hash].[ext]',
                },
            },
            minify: "esbuild",
            sourcemap: false,
        },
        define: {
            "import.meta.env.VITE_API_BASE_URL": JSON.stringify(
                env.VITE_API_BASE_URL || ""
            ),
        },
        test: {
            environment: "jsdom",
            coverage: {
                provider: "v8",
                reporter: ["text", "html"],
                include: ["js/**/*.js"],
                exclude: [
                    "js/**/*.test.js",
                    "js/**/*.spec.js",
                    "**/node_modules/**",
                    "**/dist/**",
                ],
            },
        },
    };
});