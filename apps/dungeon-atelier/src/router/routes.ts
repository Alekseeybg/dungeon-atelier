import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  ...(import.meta.env.DEV
    ? [
        {
          path: '/dev/dungeon-torches',
          name: 'dungeon-torch-study',
          component: () => import('@/pages/DungeonTorchStudyPage.vue'),
        },
        {
          path: '/dev/dungeon-doors',
          name: 'dungeon-door-study',
          component: () => import('@/pages/DungeonDoorStudyPage.vue'),
        },
        {
          path: '/dev/dungeon-3d',
          name: 'dungeon-3d-prototype',
          component: () => import('@/pages/Dungeon3DPrototypePage.vue'),
        },
      ]
    : []),
  {
    path: '/',
    component: () => import('@/layouts/AppLayout.vue'),
    children: [{ path: '', name: 'editor', component: () => import('@/pages/EditorPage.vue') }],
  },
  {
    path: '/visual-foundation/projection',
    name: 'projection-study',
    component: () => import('@/pages/ProjectionStudyPage.vue'),
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
