// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',
    timeout: 15000,
    use: {
        baseURL: 'http://localhost:7890',
    },
    webServer: {
        command: 'node tools/serve.js',
        port: 7890,
        reuseExistingServer: true,
    },
});
