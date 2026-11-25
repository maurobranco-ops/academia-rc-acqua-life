// Formatação de datas "puras" (sem hora relevante) — RC Acqua Life
//
// O banco grava datas puras como meia-noite UTC ("2015-05-10T00:00:00.000Z").
// Formatar com `new Date(x).toLocaleDateString('pt-BR')` converte para o fuso
// local (UTC−3) e volta um dia — 10/05 exibia 09/05, e nascidos em dia 1º
// exibiam o último dia do mês anterior. A correção é SEMPRE ler ano/mês/dia
// direto da string ISO: o dia exibido é exatamente o dia gravado.
//
// Regra adotada no app: qualquer data sem componente de hora relevante
// (nascimento, vencimentos, validades, pagamentos) passa por aqui — nunca por
// `new Date(...).toLocaleDateString`.

/** Partes de uma data pura lidas direto da string ISO (sem fuso horário). */
export interface DateParts {
  year: number
  month: number
  day: number
}

/**
 * Lê ano/mês/dia direto da string ISO ("2015-05-10", "2015-05-10T00:00:00.000Z"
 * ou "2015-05-10 00:00:00.000Z"). Retorna null quando não é uma data válida.
 */
export function readDateParts(iso?: string | null): DateParts | null {
  if (!iso) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso).trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year, month, day }
}

/**
 * Formata uma data "pura" como dd/mm/aaaa SEM depender de fuso: lê a parte
 * YYYY-MM-DD direto da string ISO. Timestamps com hora relevante (criado em,
 * enviado às ...) continuam podendo usar toLocaleDateString normalmente.
 */
export function formatDateBR(iso?: string | null): string {
  const parts = readDateParts(iso)
  if (!parts) return '—'
  return `${String(parts.day).padStart(2, '0')}/${String(parts.month).padStart(2, '0')}/${parts.year}`
}

/** Variante que retorna string vazia em vez de "—" (para campos opcionais). */
export function formatDateBROrEmpty(iso?: string | null): string {
  return readDateParts(iso) ? formatDateBR(iso) : ''
}

/** Formata como "dd/mm" (carimbos curtos, listas compactas). */
export function formatDayMonthBR(iso?: string | null): string {
  const parts = readDateParts(iso)
  if (!parts) return '—'
  return `${String(parts.day).padStart(2, '0')}/${String(parts.month).padStart(2, '0')}`
}

/**
 * Compara uma data pura (string ISO) com uma data de referência (por padrão,
 * hoje) usando apenas o calendário — sem conversão de fuso.
 * Retorna negativo quando a data pura é anterior, 0 quando é o mesmo dia e
 * positivo quando é posterior.
 */
export function comparePureDate(iso?: string | null, ref: Date = new Date()): number {
  const parts = readDateParts(iso)
  if (!parts) return NaN
  const y = ref.getFullYear()
  const m = ref.getMonth() + 1
  const d = ref.getDate()
  if (parts.year !== y) return parts.year - y
  if (parts.month !== m) return parts.month - m
  return parts.day - d
}
