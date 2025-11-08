interface VersionData {
  version: string;
  buildDate: string;
}

const VERSION_CHECK_KEY = 'app_version';
const VERSION_CHECK_INTERVAL = 120000; // 2 minutos

export async function checkForUpdates(): Promise<boolean> {
  try {
    const response = await fetch('/version.json', { 
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      console.warn('[Version Check] Failed to fetch version.json');
      return false;
    }
    
    const data: VersionData = await response.json();
    const currentVersion = localStorage.getItem(VERSION_CHECK_KEY);
    
    console.log('[Version Check] Current:', currentVersion, 'Remote:', data.version);
    
    if (currentVersion && currentVersion !== data.version) {
      console.log('[Version Check] New version available!');
      return true; // Nova versão disponível
    }
    
    // Armazenar versão atual
    localStorage.setItem(VERSION_CHECK_KEY, data.version);
    return false;
  } catch (error) {
    console.error('[Version Check] Error:', error);
    return false;
  }
}

export function startVersionCheck(onUpdateAvailable: () => void): () => void {
  // Checar imediatamente
  checkForUpdates().then((hasUpdate) => {
    if (hasUpdate) {
      onUpdateAvailable();
    }
  });
  
  // Checar periodicamente
  const interval = setInterval(async () => {
    const hasUpdate = await checkForUpdates();
    if (hasUpdate) {
      onUpdateAvailable();
    }
  }, VERSION_CHECK_INTERVAL);
  
  // Retornar função de cleanup
  return () => clearInterval(interval);
}
