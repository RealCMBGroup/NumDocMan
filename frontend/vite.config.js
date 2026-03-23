import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
    envPrefix: ['VITE_', 'REACT_APP_'],
    server: {
        watch: {
            ignored: ['**/node_modules/**', '**/.git/**', '**/build/**', '**/dist/**', '**/coverage/**'],
        },
    },
});
