import { defineConfig } from '#q-app'
import { resolve } from 'node:path'

export default defineConfig(({ appPaths, dev }) => ({
  boot: ['icons'],
  css: ['app.scss'],
  extras: [],
  build: {
    typescript: { strict: true, vueShim: true },
    vueRouterMode: 'hash',
    extendViteConf(viteConf) {
      if (!dev) return
      // Vite watches the generator source alongside the app; core edits use the same HMR tab.
      viteConf.resolve ??= {}
      viteConf.resolve.alias = {
        ...viteConf.resolve.alias,
        '@dungeon-atelier/core': resolve(
          appPaths.appDir,
          '../../packages/dungeon-core/src/index.ts',
        ),
      }
      viteConf.optimizeDeps ??= {}
      viteConf.optimizeDeps.exclude = [
        ...(viteConf.optimizeDeps.exclude ?? []),
        '@dungeon-atelier/core',
      ]
      // Prebundle the core's CommonJS validator rather than another workspace's Ajv version.
      viteConf.optimizeDeps.include = [
        ...(viteConf.optimizeDeps.include ?? []),
        '@dungeon-atelier/core > ajv',
      ]
    },
    vitePlugins: [
      [
        'vite-plugin-checker',
        {
          vueTsc: true,
          eslint: {
            lintCommand: 'eslint -c ./eslint.config.js "./src*/**/*.{ts,js,mjs,cjs,vue}"',
            useFlatConfig: true,
            watchPath: 'src',
          },
        },
        { server: false },
      ],
    ],
  },
  framework: { iconSet: 'svg-material-icons', config: { dark: true }, plugins: [] },
}))
