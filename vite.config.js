import syncData from './tools/syncData.cjs'

// public/data is the source of truth; keep the data/ copies the code imports in step with it
const syncDataPlugin = { name: 'sync-data', buildStart() { syncData() } }

export default {
  base: './',
  plugins: [syncDataPlugin],
  build: {
    sourcemap: false,        // was the main memory hog on Termux
    minify: 'esbuild',       // far cheaper than terser
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
  },
}
