<template>
  <q-layout view="hHh lpR fFf">
    <q-header bordered class="app-header">
      <q-toolbar class="q-px-lg" style="min-height: 64px">
        <q-avatar rounded color="primary" text-color="dark" icon="castle" size="36px" />
        <q-toolbar-title class="q-ml-sm">
          <span class="text-weight-medium">Dungeon Atelier</span>
          <div class="text-caption text-grey-5">Procedural dungeon studio</div>
        </q-toolbar-title>
        <q-chip dense outline color="grey-5" icon="dark_mode" class="gt-xs">Dark workspace</q-chip>
        <q-badge outline color="primary" label="PREVIEW" class="q-ml-sm" />
      </q-toolbar>
    </q-header>
    <q-page-container><router-view /></q-page-container>
  </q-layout>
</template>
