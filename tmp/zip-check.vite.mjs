import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
const root = path.resolve('tmp/courseradar-reference-20261026/client');
export default defineConfig({ root, plugins:[react(),tailwindcss()], resolve:{alias:{'@':path.join(root,'src')}}, optimizeDeps:{entries:['reference-check.html']}, server:{port:5175,host:'127.0.0.1',strictPort:true} });

