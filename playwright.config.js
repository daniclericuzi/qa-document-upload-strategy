const { defineConfig } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/e2e-*.test.js',
})