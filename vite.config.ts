import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages project site: https://qwerty10218.github.io/language-exchange-diary/
  base: '/language-exchange-diary/',
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'opencc-dict', test: /zh-script\.mjs$/ },
            { name: 'writing-index', test: /writing-index\.json$/ },
            { name: 'vocab-data', test: /\.entries\.json$/ },
          ],
        },
      },
    },
  },
});
