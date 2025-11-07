/**
 * Executa uma função com retry automático em caso de falha
 * 
 * @param fn - Função assíncrona a ser executada
 * @param maxRetries - Número máximo de tentativas (padrão: 3)
 * @param delay - Delay inicial em ms entre tentativas (padrão: 1000)
 * @returns Resultado da função
 */
export async function retryFetch<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === maxRetries - 1;
      
      if (isLastAttempt) {
        console.error(`[RetryFetch] Todas as ${maxRetries} tentativas falhou:`, error);
        throw error;
      }
      
      const waitTime = delay * (attempt + 1); // Exponential backoff
      console.log(`[RetryFetch] Tentativa ${attempt + 1}/${maxRetries} falhou. Tentando novamente em ${waitTime}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw new Error('Max retries reached');
}
