// Helpers de erro do PocketBase, compartilhados por todo o app.
// ATENÇÃO: os exports `isNotFoundError` e `translateBackendMessage` são usados por
// src/services/academy.ts — já quebraram o build 4 vezes por sumirem deste arquivo
// (sobrescrita por versões antigas do arquivo em operações de restore/patch).
// NÃO REMOVA este arquivo nem seus exports.

import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

/**
 * Verifica se o erro é um 404 do PocketBase (registro inexistente ou já excluído).
 * Usado pelo deleteTolerant para tratar 404 como sucesso.
 */
export function isNotFoundError(err: unknown): boolean {
  return err instanceof ClientResponseError && err.status === 404
}

const RAW_MESSAGE_RULES: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /failed to create/i, message: 'Não foi possível salvar o registro.' },
  { pattern: /failed to update/i, message: 'Não foi possível atualizar o registro.' },
  { pattern: /failed to delete/i, message: 'Não foi possível excluir o registro.' },
  {
    pattern: /the requested resource wasn't found/i,
    message: 'Registro não encontrado (pode já ter sido excluído).',
  },
  {
    pattern: /cannot be blank|must not be blank|non-empty value|required/i,
    message: 'Existem campos obrigatórios não preenchidos.',
  },
  {
    pattern: /invalid value|must be a valid/i,
    message: 'Algum campo tem um valor inválido — verifique os dados.',
  },
  {
    pattern: /value must be unique|unique constraint/i,
    message: 'Já existe um registro com esse valor (ele precisa ser único).',
  },
  {
    pattern: /authentication is invalid|invalid or expired token|authorization/i,
    message: 'Sessão expirada — entre novamente para continuar.',
  },
  {
    pattern: /insufficient permissions|you are not allowed/i,
    message: 'Você não tem permissão para esta ação.',
  },
  {
    pattern: /too many requests/i,
    message: 'Muitas tentativas — aguarde alguns segundos e tente de novo.',
  },
]

/**
 * Traduz mensagens cruas do PocketBase para português, para nunca vazar
 * "Failed to create record." / "Cannot be blank" etc. para o usuário.
 * Mensagem desconhecida passa inalterada.
 */
export function translateBackendMessage(message: string): string {
  if (!message) return message
  for (const rule of RAW_MESSAGE_RULES) {
    if (rule.pattern.test(message)) return rule.message
  }
  return message
}

/** Extrai erros por campo de um ClientResponseError 400 (err.response.data). */
export function extractFieldErrors(err: unknown): FieldErrors {
  const out: FieldErrors = {}
  if (err instanceof ClientResponseError && err.response?.data) {
    for (const [field, detail] of Object.entries(err.response.data)) {
      if (
        detail &&
        typeof detail === 'object' &&
        'message' in (detail as Record<string, unknown>)
      ) {
        out[field] = String((detail as { message: unknown }).message)
      } else if (typeof detail === 'string') {
        out[field] = detail
      }
    }
  }
  return out
}

/**
 * Mensagem amigável (pt-BR) a partir de qualquer erro: ClientResponseError do
 * PocketBase, Error genérico ou valor desconhecido. Traduz mensagens cruas.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof ClientResponseError) {
    const raw =
      (err.response && typeof err.response === 'object' && 'message' in err.response
        ? String((err.response as { message?: unknown }).message ?? '')
        : '') || err.message
    return translateBackendMessage(raw)
  }
  if (err instanceof Error && err.message) return translateBackendMessage(err.message)
  if (typeof err === 'string' && err) return translateBackendMessage(err)
  return 'Ocorreu um erro inesperado. Tente novamente.'
}
