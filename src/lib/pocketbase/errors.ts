import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

export function extractFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ClientResponseError)) return {}
  const data = error.response?.data
  if (!data || typeof data !== 'object') return {}
  const errors: FieldErrors = {}
  for (const [field, detail] of Object.entries(data)) {
    if (
      detail &&
      typeof detail === 'object' &&
      'message' in detail &&
      typeof (detail as { message: unknown }).message === 'string'
    ) {
      errors[field] = (detail as { message: string }).message
    }
  }
  return errors
}

// Tradução de erros crus do backend (inglês) para mensagens em português.
// Usada em exclusões e outras operações para que o usuário NUNCA veja
// mensagens como "Failed to delete record ... required relation reference".
const PT_MESSAGES: Array<[RegExp, string]> = [
  [
    /required relation reference|failed to delete record/i,
    'Não foi possível remover: o registro ainda está vinculado a outros dados (matrículas, cobranças ou pagamentos). Use a opção de excluir também o histórico financeiro.',
  ],
  [
    /requested resource wasn'?t found|doesn'?t exist/i,
    'Registro não encontrado — ele já deve ter sido excluído.',
  ],
  [
    /unauthorized|authentication required|missing or invalid .*token/i,
    'Sessão expirada. Faça login novamente.',
  ],
  [
    /forbidden|only admins can perform this action/i,
    'Você não tem permissão para executar esta ação.',
  ],
  [
    /failed to fetch|networkerror|load failed/i,
    'Falha de conexão com o servidor. Verifique sua internet e tente novamente.',
  ],
]

export function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof ClientResponseError)) return false
  const status = (error as { status?: number }).status
  if (status === 404) return true
  // PocketBase às vezes devolve 400 com essa mensagem em operações de exclusão
  return /requested resource wasn'?t found/i.test(error.message || '')
}

export function translateBackendMessage(message: string): string {
  for (const [re, pt] of PT_MESSAGES) {
    if (re.test(message)) return pt
  }
  return message
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return translateBackendMessage(
      error instanceof Error ? error.message : 'Ocorreu um erro inesperado.',
    )
  }
  const msgs = Object.values(extractFieldErrors(error))
  return translateBackendMessage(
    msgs.length > 0 ? msgs.join(' ') : error.message || 'Ocorreu um erro inesperado.',
  )
}
