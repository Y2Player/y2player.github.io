import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // caminhos relativos: o mesmo build funciona em qualquer endereço
  // (github.io/y2player hoje, domínio próprio no futuro)
  base: './',
  server: {
    port: 3000,
    open: false,
    host: true
  }
});
