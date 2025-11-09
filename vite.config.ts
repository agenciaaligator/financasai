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
      // Injetar script inline de version check que executa ANTES de tudo
      const versionCheckScript = `
        <script>
          (function() {
            const DEPLOYED_VERSION = '${buildTime}';
            const storedVersion = localStorage.getItem('app_version');
            
            if (storedVersion && storedVersion !== DEPLOYED_VERSION) {
              console.log('[VERSION CHECK] Nova versão detectada:', DEPLOYED_VERSION, '(anterior:', storedVersion + ')');
              
              // Limpar TUDO
              localStorage.clear();
              sessionStorage.clear();
              
              // Deletar todos os caches
              if ('caches' in window) {
                caches.keys().then(names => names.forEach(n => caches.delete(n)));
              }
              
              // Salvar nova versão
              localStorage.setItem('app_version', DEPLOYED_VERSION);
              
              // Hard reload com query string única
              window.location.replace(window.location.pathname + '?v=' + DEPLOYED_VERSION);
              return;
            }
            
            // Se não tem versão salva, salvar agora
            if (!storedVersion) {
              console.log('[VERSION CHECK] Primeira execução, versão:', DEPLOYED_VERSION);
              localStorage.setItem('app_version', DEPLOYED_VERSION);
            }
          })();
        </script>
      `;
      
      // Adicionar meta tag com versão
      const metaTag = `<meta name="build-version" content="${buildTime}">`;
      
      // Adicionar timestamp no script do main.tsx para forçar reload
      html = html.replace(
        '<script type="module" src="/src/main.tsx"></script>',
        `<script type="module" src="/src/main.tsx?v=${buildTime}"></script>`
      );
      
      // Injetar script e meta tag no head
      html = html.replace('</head>', `  ${metaTag}\n  ${versionCheckScript}\n  </head>`);
      
      return html;
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
