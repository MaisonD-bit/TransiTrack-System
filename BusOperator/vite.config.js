import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';

export default defineConfig({
    plugins: [
        laravel({
            input: [
                'resources/css/app.css',
                'resources/js/app.js',
                'resources/js/panels/dashboard.js',
                'resources/js/panels/routes.js',
                'resources/js/panels/schedule.js',
                'resources/js/panels/drivers.js',
                'resources/js/panels/buses.js',
                'resources/js/panels/profile.js',
                'resources/js/panels/terminal.js'
            ],
            refresh: true,
        }),
    ],
    server: {
        host: '127.0.0.1',
        port: 3000,
        strictPort: false,
    },
});