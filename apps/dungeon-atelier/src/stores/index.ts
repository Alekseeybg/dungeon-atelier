import { defineStore } from '#q-app'
import { createPinia } from 'pinia'

export default defineStore(() => {
  const pinia = createPinia()

  // Register Pinia plugins here with pinia.use().
  return pinia
})
