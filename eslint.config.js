import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import path from "path";
import { fileURLToPath } from "url";
import globals from "globals";

// 模拟 CommonJS 的 __dirname，便于处理相对路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 创建兼容工具实例，让旧格式的配置可以平滑迁移
const compat = new FlatCompat({
    baseDirectory: __dirname,
});

export default defineConfig([
    // 1. 继承 ESLint 推荐规则
    js.configs.recommended,

    // 2. 兼容旧的 .eslintrc.js 中的 extends 和 rules
    ...compat.config({
        extends: ['prettier'],
        rules: {
            'no-var': 'error',
            'prefer-const': 'warn',
            'eqeqeq': ['error', 'always'],
            'no-unused-vars': 'warn',
            'no-console': 'off',
        },
    }),

    // 3. 配置语言选项 (替代旧版 env, globals, parserOptions)
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.es2022,
            },
        },
    },

    // 4. 配置忽略规则 (替代 .eslintignore)
    {
        ignores: [
            "dist/**",
            "node_modules/**",
            "*.min.js",
            "vite.config.js",
        ],
    },
]);