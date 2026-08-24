import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Both deploy targets (Firebase Hosting and the GitHub Pages custom
  // domain hearjournal.upshiftholdings.com) serve from the domain root,
  // so the build must always use root-relative asset paths.
  base: '/',
  plugins: [react()],
})
