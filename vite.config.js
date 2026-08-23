import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GH_PAGES ? '/hear-journal/' : '/',
  plugins: [react()],
})
