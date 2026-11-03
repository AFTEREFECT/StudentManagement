import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { teacherPwa } from './scripts/teacher-pwa-plugin';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(projectRoot, 'teacher'),
  envDir: projectRoot,
  publicDir: path.resolve(projectRoot, 'teacher/public'),
  base: '/',
  plugins: [react(), teacherPwa()],
  build: {
    outDir: path.resolve(projectRoot, 'dist-teacher'),
    emptyOutDir: true,
  },
});
