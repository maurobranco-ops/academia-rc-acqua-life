/**
 * Interceptor global de requisições do PocketBase.
 *
 * Antes: uma falha qualquer durante o authRefresh inicial (rede oscilando,
 * erro 5xx do backend, aba retomada do segundo plano) deslogava o usuário
 * e o jogava em /login. Agora, a sessão só é descartada quando o backend
 * responde 401 de verdade — token expirado ou revogado. Erros de rede
 * (fetch falhou, status 0), 5xx e 429 não limpam a sessão.
 */
import pb from '@/lib/pocketbase/client'

export function setupAuthInterceptor() {
  pb.beforeSend = function (url, options) {
    return fetch(url, options)
      .then(async (response) => {
        if (response.status !== 401) return response

        // Apenas o authRefresh é decisivo: 401 nele significa que o token
        // realmente não é mais válido — limpa a sessão.
        const isAuthRefresh =
          options.method === 'POST' &&
          /\/api\/collections\/[^/]+\/auth-refresh$/.test(url.replace(/\/+$/, ''))
        if (isAuthRefresh) {
          pb.authStore.clear()
          return response
        }

        // Última tentativa para as demais rotas: renovar o token e refazer
        // a requisição uma única vez. Se a renovação falhar com 401, a
        // sessão acabou; qualquer outra falha mantém a sessão (erro só
        // propaga para a chamada original).
        try {
          await pb.collection('users').authRefresh()
        } catch (err: unknown) {
          const status =
            (err as { status?: number })?.status ??
            (err as { response?: { status?: number } })?.response?.status
          if (status === 401) {
            pb.authStore.clear()
          }
          return response
        }

        const retryHeaders = new Headers(options.headers)
        retryHeaders.set('Authorization', pb.authStore.token)
        return fetch(url, { ...options, headers: retryHeaders })
      })
      .catch((fetchError) => {
        // Erro de rede (sem resposta HTTP): não mexe na sessão.
        throw fetchError
      })
  }
}
