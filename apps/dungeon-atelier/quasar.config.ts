import { defineConfig } from '#q-app'
import { resolve } from 'node:path'

export default defineConfig(({ appPaths }) => ({
  boot: ['icons'],
  css: ['app.scss'],
  extras: [],
  build: {
    typescript: { strict: true, vueShim: true },
    vueRouterMode: 'hash',
    extendViteConf(viteConf) {
      const coreOutput = resolve(appPaths.appDir, '../../packages/dungeon-core/dist')
      // Serve the workspace library directly so a rebuilt generator cannot remain prebundled.
      viteConf.optimizeDeps ??= {}
      viteConf.optimizeDeps.exclude = [
        ...(viteConf.optimizeDeps.exclude ?? []),
        '@dungeon-atelier/core',
      ]
      // The excluded workspace library imports this CommonJS validator at runtime.
      // Prebundle it up front so a fresh/restarted preview has a valid dependency URL.
      viteConf.optimizeDeps.include = [
        ...(viteConf.optimizeDeps.include ?? []),
        '@dungeon-atelier/core > ajv',
      ]
      viteConf.server ??= {}
      viteConf.server.fs ??= {}
      viteConf.server.fs.allow = [...(viteConf.server.fs.allow ?? [appPaths.appDir]), coreOutput]
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
  devServer: { open: false },
  framework: { iconSet: 'svg-material-icons', config: { dark: true }, plugins: [] },
}))
