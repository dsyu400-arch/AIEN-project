import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/game/**/*.test.ts', 'src/ui/**/*.test.tsx', 'src/*.test.ts'],
  },
})
