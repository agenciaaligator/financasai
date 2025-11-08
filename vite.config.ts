import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import fs from "fs";

// Plugin para adicionar cache busting timestamp no HTML
function versionPlugin(): Plugin {
  const buildTime = Date.now().toString();
  
  return {
    name: 'version-plugin',
    transformIndexHtml(html) {
      // Adicionar meta tag com timestamp para forçar CDN a reconhecer mudança
      const metaTag = `<meta name="build-version" content="${buildTime}">`;
      return html.replace('</head>', `  ${metaTag}\n  </head>`);
    },
    generateBundle() {
      const buildDate = new Date().toISOString();
      
      console.log('[Version Plugin] Build version:', buildTime);
      
      // Gerar version.json para referência
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ 
          version: buildTime,
          buildDate: buildDate
        }, null, 2)
      });
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
