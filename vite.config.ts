import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base '/confer/' for GitHub Pages project site; '/' for local dev.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/confer/' : '/',
  plugins: [react(), tailwindcss()],
}))
