import type { ChargeRecord, StudentRecord } from '@/types/database'
import { formatPhoneDisplay } from '@/lib/formatters'
import { academyService } from '@/services/academy'

/**
 * Cobrança direta pelo WhatsApp — click-to-chat (sem gateway, sem API de envio).
 *
 * Fluxo acordado com a academia (a integração InfinitePay foi ABANDONADA na
 * v0.0.95): o admin clica em "Cobrar no WhatsApp", o app abre a conversa com o
 * responsável já com a mensagem pronta (nome do aluno, valor, vencimento e
 * dados de PIX da academia vindos das configurações) e registra a data/hora do
 * envio na cobrança (charges.whatsapp_sent / whatsapp_sent_at). A baixa é
 * manual ("Pagar Agora" marca como paga após o PIX cair).
 *
 * FUTURO (envio automático via API da Meta Cloud API — NÃO implementado ainda):
 * o envio usará o Phone Number ID da conta comercial da RC Acqua Life
 * (+55 83 8805-1572):
 *
 *   WHATSAPP_PHONE_NUMBER_ID = '1481024908418048'
 *
 * O número ainda não está verificado/registrado na Meta, por isso esta rodada
 * usa apenas click-to-chat (wa.me), sem nenhuma chamada de API.
 */
export const WHATSAPP_PHONE_NUMBER_ID = '1481024908418048'

/**
 * Chave da coleção `settings` com os dados de PIX da academia. O valor é
 * editável na tela de Configurações; se ainda não existir, a mensagem usa o
 * telefone da academia como fallback (o responsável pede a chave por lá).
 */
export const PIX_SETTINGS_KEY = 'academy_pix'

/** Normaliza qualquer telefone (com ou sem máscara) para 55 + DDD + número. */
export function normalizeWhatsAppNumber(raw: string): string {
  let digits = (raw || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('55')) {
    digits = digits.slice(2)
  } else if (digits.startsWith('0')) {
    digits = digits.replace(/^0+/, '')
  }
  if (digits.length <= 11) {
    return `55${digits}`
  }
  return digits
}

/** Telefone que recebe a cobrança: o do responsável (ou do próprio adulto). */
export function getChargeTargetPhone(student: StudentRecord): string {
  return student.guardian_phone || student.whatsapp || student.phone || ''
}

/**
 * Nome pelo qual a mensagem cumprimenta: o responsável quando houver,
 * senão o próprio aluno (maior de idade / responsável de si mesmo).
 */
export function getChargeGreetingName(student: StudentRecord): string {
  return student.guardian_name?.trim() || student.name
}

/**
 * Monta a mensagem pronta da cobrança: nome do aluno, valor, vencimento e os
 * dados de pagamento da academia (PIX das configurações; fallback: telefone).
 */
export function buildChargeMessage(input: {
  charge: Pick<ChargeRecord, 'description' | 'amount' | 'discount_amount' | 'due_date'>
  student: Pick<StudentRecord, 'name' | 'guardian_name'>
  academyName: string
  pixValue?: string
  fallbackPhone?: string
}): string {
  const { charge, student, academyName } = input
  const greeting = student.guardian_name?.trim() || student.name
  const value = charge.amount.toFixed(2).replace('.', ',')
  const dueDate = new Date(charge.due_date).toLocaleDateString('pt-BR')

  const pix = (input.pixValue || '').trim()
  const paymentInfo = pix
    ? `💳 *Dados para pagamento (PIX)*\n${pix}`
    : input.fallbackPhone
      ? `💳 *Dados para pagamento*\nFale com a academia: ${input.fallbackPhone} — a chave PIX é enviada por ali.`
      : '💳 *Dados para pagamento*\nFale com a secretaria para receber a chave PIX.'

  return (
    `🏊 *${academyName} — Cobrança*\n\n` +
    `Olá, *${greeting}*!\n\n` +
    `Passando para cobrar a mensalidade de *${student.name}*, referente a "${charge.description}".\n\n` +
    `💰 Valor: *R$ ${value}*\n` +
    `📅 Vencimento: *${dueDate}*\n\n` +
    `${paymentInfo}\n\n` +
    `Assim que o PIX for feito, a baixa é registrada aqui na academia. Em caso de dúvidas, basta responder esta mensagem.\n\n` +
    `*${academyName}*`
  )
}

/** URL de click-to-chat (wa.me) com a mensagem pré-preenchida. */
export function buildWhatsAppClickToChatUrl(rawPhone: string, message: string): string {
  const normalized = normalizeWhatsAppNumber(rawPhone)
  const text = encodeURIComponent(message)
  if (!normalized) {
    return `https://wa.me/?text=${text}`
  }
  return `https://wa.me/${normalized}?text=${text}`
}

/** Número formatado para exibição (máscara brasileira), ex.: (83) 8805-1572. */
export function formatWhatsAppTargetDisplay(rawPhone: string): string {
  const normalized = normalizeWhatsAppNumber(rawPhone)
  if (!normalized) return ''
  return formatPhoneDisplay(normalized)
}

/** Carimbo curto para exibir na cobrança: "20/11 14:32". */
export function formatWhatsAppSentStamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

/** Resultado da ação "Cobrar no WhatsApp" em uma cobrança. */
export interface ChargeWhatsAppResult {
  sent: boolean
  reason?: 'sem_telefone'
}

/**
 * Ação central de cobrança via WhatsApp, compartilhada por Cobranças e pelo
 * detalhe do aluno: monta a mensagem, abre a conversa (click-to-chat) e
 * registra a data/hora do envio na cobrança. Sem gateway — a baixa é manual.
 */
export async function sendChargeWhatsApp(
  charge: ChargeRecord,
  student: StudentRecord | undefined,
  settings: Record<string, string>,
): Promise<ChargeWhatsAppResult> {
  const rawPhone = student ? getChargeTargetPhone(student) : ''
  if (!rawPhone) return { sent: false, reason: 'sem_telefone' }

  const message = buildChargeMessage({
    charge,
    student: student,
    academyName: settings.academy_name || 'RC Acqua Life',
    pixValue: settings[PIX_SETTINGS_KEY] || '',
    fallbackPhone: settings.academy_phone || '',
  })

  window.open(buildWhatsAppClickToChatUrl(rawPhone, message), '_blank')

  try {
    await academyService.registerChargeWhatsAppSent(
      charge.id,
      formatWhatsAppTargetDisplay(rawPhone),
    )
  } catch (err) {
    console.error('Erro ao registrar envio de cobrança por WhatsApp', err)
  }
  return { sent: true }
}
