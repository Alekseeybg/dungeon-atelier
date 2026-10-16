import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/layouts/AppLayout.vue'),
    children: [{ path: '', name: 'editor', component: () => import('@/pages/EditorPage.vue') }],
  },
  {
    path: '/visual-foundation/final-polish',
    name: 'final-polish',
    component: () => import('@/pages/FinalPolishPage.vue'),
  },
  {
    path: '/visual-foundation',
    name: 'visual-foundation',
    component: () => import('@/pages/VisualFoundationPage.vue'),
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('@/pages/NotFoundPage.vue'),
  },
]

export default routes
