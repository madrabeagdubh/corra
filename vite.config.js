export default {
  base: './',
  build: {
    sourcemap: false,        // was the main memory hog on Termux
    minify: 'esbuild',       // far cheaper than terser
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
  },
}
