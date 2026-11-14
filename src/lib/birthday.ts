import type { StudentRecord } from '@/types/database'

/** Chaves na coleção settings. */
export const BIRTHDAY_MESSAGE_KEY = 'birthday_message'
export const BIRTHDAY_AUTO_SEND_KEY = 'birthday_auto_send'

export const DEFAULT_BIRTHDAY_MESSAGE =
  '🎉 A RC Acqua Life parabeniza {nome} pelos {idade} anos! A turma {turma} celebra com você hoje!'

/**
 * Envio por WhatsApp só é liberado quando o conector WhatsApp estiver ativo no app.
 * Enquanto for false, o botão do painel fica desabilitado.
 */
export const WHATSAPP_CONNECTOR_READY = false

interface BirthDateParts {
  year: number
  month: number
  day: number
}

/** Lê a data de nascimento (YYYY-MM-DD ou ISO com hora) sem depender de fuso. */
export function parseBirthDate(value?: string | null): BirthDateParts | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year, month, day }
}

/** Verdadeiro quando dia e mês da data de nascimento coincidem com a data de referência. */
export function isBirthdayOn(value: string | null | undefined, today: Date): boolean {
  const birth = parseBirthDate(value)
  if (!birth) return false
  return birth.month === today.getMonth() + 1 && birth.day === today.getDate()
}

/** Idade que a pessoa completa na data de referência (anos completos). */
export function ageOn(value: string | null | undefined, today: Date): number | null {
  const birth = parseBirthDate(value)
  if (!birth) return null
  let age = today.getFullYear() - birth.year
  const passedBirthday =
    today.getMonth() + 1 > birth.month ||
    (today.getMonth() + 1 === birth.month && today.getDate() >= birth.day)
  if (!passedBirthday) age -= 1
  return age
}

/** Substitui {nome}, {idade} e {turma} no modelo da mensagem. */
export function buildBirthdayMessage(
  template: string,
  vars: { nome: string; idade: number | string; turma: string },
): string {
  return template
    .replaceAll('{nome}', vars.nome)
    .replaceAll('{idade}', String(vars.idade))
    .replaceAll('{turma}', vars.turma)
}

/** Telefone do responsável; quando não há responsável cadastrado, usa o do próprio aluno. */
export function getBirthdayPhone(student: Partial<StudentRecord>): string {
  const guardianPhone = (student.guardian_phone || '').trim()
  const studentPhone = (student.phone || student.whatsapp || '').trim()
  return guardianPhone || studentPhone
}
