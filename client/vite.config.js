// client/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // This tells Vite to listen on all network interfaces (0.0.0.0)
  // allowing access from other devices on your local network.
  server: {
    host: true,
    port: 5183 // Explicitly set the port
  }
});