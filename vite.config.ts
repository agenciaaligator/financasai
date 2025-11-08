import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import fs from "fs";

// Plugin para versionar Service Worker e gerar version.json
function versionPlugin(): Plugin {
  return {
    name: 'version-plugin',
    generateBundle() {
      const buildTime = Date.now().toString();
      const buildDate = new Date().toISOString();
      
      console.log('[Version Plugin] Generating version:', buildTime);
      
      // Gerar version.json
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ 
          version: buildTime,
          buildDate: buildDate
        }, null, 2)
      });
      
      // Ler e versionar sw.js
      const swPath = path.resolve(__dirname, 'public/sw.js');
      if (fs.existsSync(swPath)) {
        let swContent = fs.readFileSync(swPath, 'utf-8');
        swContent = swContent.replace('BUILD_TIME_PLACEHOLDER', buildTime);
        
        this.emitFile({
          type: 'asset',
          fileName: 'sw.js',
          source: swContent
        });
        
        console.log('[Version Plugin] Service Worker versioned');
      } else {
        console.warn('[Version Plugin] sw.js not found at', swPath);
      }
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: `assets/[name]-[hash].[ext]`
      }
    }
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    versionPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
