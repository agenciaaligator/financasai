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
      // Script inline REFORÇADO com verificação remota
      const versionCheckScript = `
        <script>
          (function() {
            const DEPLOYED_VERSION = '${buildTime}';
            
            console.log('[VERSION INLINE] Versão do build:', DEPLOYED_VERSION);
            
            // Função assíncrona para verificar versão remota
            async function checkRemoteVersion() {
              try {
                const res = await fetch('/version.json?cb=' + Date.now(), {
                  cache: 'no-store',
                  headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
                });
                
                if (!res.ok) {
                  console.warn('[VERSION INLINE] Não foi possível buscar version.json');
                  return null;
                }
                
                const json = await res.json();
                return String(json.version || '');
              } catch (e) {
                console.warn('[VERSION INLINE] Erro ao buscar versão remota:', e);
                return null;
              }
            }
            
            // Verificar versão local vs inline
            const storedVersion = localStorage.getItem('app_version');
            
            if (storedVersion && storedVersion !== DEPLOYED_VERSION) {
              console.log('[VERSION INLINE] Diferença detectada! Stored:', storedVersion, 'Build:', DEPLOYED_VERSION);
              
              // Limpar TUDO imediatamente
              localStorage.clear();
              sessionStorage.clear();
              
              if ('caches' in window) {
                caches.keys().then(names => names.forEach(n => caches.delete(n)));
              }
              
              // Salvar nova versão
              localStorage.setItem('app_version', DEPLOYED_VERSION);
              
              // Hard reload com query string
              window.location.replace('/?v=' + DEPLOYED_VERSION);
              return;
            }
            
            // Se versões locais coincidem, fazer verificação remota em background
            if (storedVersion === DEPLOYED_VERSION) {
              checkRemoteVersion().then(remoteVersion => {
                if (remoteVersion && remoteVersion !== storedVersion) {
                  console.log('[VERSION INLINE] Versão remota diferente! Remote:', remoteVersion, 'Local:', storedVersion);
                  
                  localStorage.clear();
                  sessionStorage.clear();
                  
                  if ('caches' in window) {
                    caches.keys().then(names => names.forEach(n => caches.delete(n)));
                  }
                  
                  localStorage.setItem('app_version', remoteVersion);
                  window.location.replace('/?v=' + remoteVersion);
                }
              });
            }
            
            // Primeira execução
            if (!storedVersion) {
              console.log('[VERSION INLINE] Primeira execução, salvando versão:', DEPLOYED_VERSION);
              localStorage.setItem('app_version', DEPLOYED_VERSION);
            }
          })();
        </script>
      `;
      
      // Meta tag com versão
      const metaTag = `<meta name="build-version" content="${buildTime}">`;
      
      // Timestamp no script do main.tsx
      html = html.replace(
        '<script type="module" src="/src/main.tsx"></script>',
        `<script type="module" src="/src/main.tsx?v=${buildTime}"></script>`
      );
      
      // Injetar no head
      html = html.replace('</head>', `  ${metaTag}\n  ${versionCheckScript}\n  </head>`);
      
      return html;
    },
    generateBundle() {
      const buildDate = new Date().toISOString();
      
      console.log('[Version Plugin] Build version:', buildTime);
      console.log('[Version Plugin] Build date:', buildDate);
      
      // Gerar version.json
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
