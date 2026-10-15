import { defineConfig } from '#q-app'

export default defineConfig(() => ({
  boot: ['icons'],
  css: ['app.scss'],
  extras: [],
  build: {
    typescript: { strict: true, vueShim: true },
    vueRouterMode: 'hash',
    vitePlugins: [
      [
        'vite-plugin-checker',
        {
          vueTsc: true,
          eslint: {
            lintCommand: 'eslint -c ./eslint.config.js "./src*/**/*.{ts,js,mjs,cjs,vue}"',
            useFlatConfig: true,
          },
        },
        { server: false },
      ],
    ],
  },
  devServer: { open: true },
  framework: { iconSet: 'svg-material-icons', config: { dark: true }, plugins: [] },
}))
