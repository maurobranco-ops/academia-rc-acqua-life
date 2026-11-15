// Ficha de matrícula imprimível (frente 4): termo de ciência de riscos, normas
// da academia, autorização de uso de imagem (LGPD) e campos de assinatura.
// Cidade e lei citadas no documento: Bayeux - PB, Lei Estadual nº 9.863/2012-PB.
// Impressão via window.print + CSS @media print (classe .print-area em main.css).

import { Button } from '@/components/ui/button'
import { Printer, X } from 'lucide-react'
import {
  PARQ_QUESTIONS,
  ANAMNESE_QUESTIONS,
  FICHA_LEGAL,
  formatDateBR,
  type ParqValues,
  type AnamneseKey,
} from '@/lib/matricula'
import { addSixMonths, type StudentRecord, type EnrollmentRequestRecord } from '@/types/database'
import { LogoMark } from '@/components/Logo'

export interface PrintableFichaData {
  name: string
  birthDate?: string
  cpf?: string
  phone?: string
  guardianName?: string
  guardianCpf?: string
  guardianPhone?: string
  parq: ParqValues
  anamnese: Partial<Record<AnamneseKey, string>>
  usoImagem: string
  /** Exame dermatológico (Lei PB 9.863/2012 — natação e/ou hidroginástica). */
  dermatoDate?: string
  /** Atestado cardiológico (Lei PB 9.863/2012 — natação e/ou hidroginástica). */
  cardioDate?: string
  cardioCrm?: string
  /** Declaração do responsável na matrícula on-line (checkbox única). */
  examsDelivered?: string
  /** Endereço do(a) aluno(a) (students 0016 / enrollment_requests 0020). */
  cep?: string
  street?: string
  streetNumber?: string
  complement?: string
  neighborhood?: string
  city?: string
  uf?: string
  /** Origem dos dados: aluno cadastrado ou inscrição pendente de conferência. */
  source: 'student' | 'request'
}

export function studentToPrintable(st: StudentRecord): PrintableFichaData {
  return {
    name: st.name || '',
    birthDate: st.birth_date,
    cpf: st.cpf,
    phone: st.phone,
    guardianName: st.guardian_name,
    guardianCpf: st.guardian_cpf,
    guardianPhone: st.guardian_phone,
    parq: {
      parq_1: st.parq_1 || '',
      parq_2: st.parq_2 || '',
      parq_3: st.parq_3 || '',
      parq_4: st.parq_4 || '',
      parq_5: st.parq_5 || '',
      parq_6: st.parq_6 || '',
      parq_7: st.parq_7 || '',
    },
    anamnese: {
      anamnese_medo_agua: st.anamnese_medo_agua || '',
      anamnese_convulsoes: st.anamnese_convulsoes || '',
      anamnese_alergia_cloro: st.anamnese_alergia_cloro || '',
      anamnese_medicamentos: st.anamnese_medicamentos || '',
      anamnese_objetivo: st.anamnese_objetivo || '',
    },
    usoImagem: st.uso_imagem_autorizado || '',
    dermatoDate: st.dermato_date,
    cardioDate: st.cardio_date,
    cardioCrm: st.cardio_crm,
    cep: st.cep,
    street: st.street,
    streetNumber: st.street_number,
    complement: st.complement,
    neighborhood: st.neighborhood,
    city: st.city,
    uf: st.uf,
    source: 'student',
  }
}

export function requestToPrintable(r: EnrollmentRequestRecord): PrintableFichaData {
  return {
    name: r.student_name || '',
    birthDate: r.student_birth_date,
    cpf: r.student_cpf,
    phone: r.student_phone,
    guardianName: r.guardian_name,
    guardianCpf: r.guardian_cpf,
    guardianPhone: r.guardian_phone,
    parq: {
      parq_1: r.parq_1 || '',
      parq_2: r.parq_2 || '',
      parq_3: r.parq_3 || '',
      parq_4: r.parq_4 || '',
      parq_5: r.parq_5 || '',
      parq_6: r.parq_6 || '',
      parq_7: r.parq_7 || '',
    },
    anamnese: {
      anamnese_medo_agua: r.anamnese_medo_agua || '',
      anamnese_convulsoes: r.anamnese_convulsoes || '',
      anamnese_alergia_cloro: r.anamnese_alergia_cloro || '',
      anamnese_medicamentos: r.anamnese_medicamentos || '',
      anamnese_objetivo: r.anamnese_objetivo || '',
    },
    usoImagem: r.uso_imagem_autorizado || '',
    dermatoDate: r.dermato_date,
    cardioDate: r.cardio_date,
    cardioCrm: r.cardio_crm,
    examsDelivered: r.exams_delivered,
    cep: r.cep,
    street: r.street,
    streetNumber: r.street_number,
    complement: r.complement,
    neighborhood: r.neighborhood,
    city: r.city,
    uf: r.uf,
    source: 'request',
  }
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-3 border-b border-dashed border-slate-300 py-1">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className="text-[12px] font-semibold text-[#0F1B3D] text-right">
        {value && value.trim() ? value : '—'}
      </span>
    </div>
  )
}

function YesNo({ v }: { v?: string }) {
  return (
    <span className="text-[12px] font-semibold shrink-0">
      {v === 'sim' ? 'Sim' : v === 'nao' ? 'Não' : '—'}
    </span>
  )
}

export function PrintableFichaDialog({
  open,
  onOpenChange,
  data,
  studentId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: PrintableFichaData | null
  studentId?: string
}) {
  if (!open || !data) return null

  const isMinor = (() => {
    if (!data.birthDate) return false
    const b = new Date(data.birthDate.length === 10 ? `${data.birthDate}T12:00:00` : data.birthDate)
    if (isNaN(b.getTime())) return false
    const age = (Date.now() - b.getTime()) / (365.25 * 24 * 3600 * 1000)
    return age < 18
  })()

  const usoImagemLabel =
    data.usoImagem === 'sim' ? 'AUTORIZO' : data.usoImagem === 'nao' ? 'NÃO AUTORIZO' : null

  return (
    <div className="ficha-overlay fixed inset-0 z-[70] bg-black/60 overflow-y-auto p-4">
      {/* Barra de ações — não sai na impressão */}
      <div className="no-print sticky top-0 z-10 mx-auto max-w-[760px] flex items-center justify-between bg-white rounded-xl shadow-lg border border-slate-200 px-4 py-2.5 mb-4">
        <div>
          <div className="text-sm font-bold text-[#0F1B3D]">Ficha de Matrícula Imprimível</div>
          <div className="text-[11px] text-[#6C757D]">
            Confira os dados e clique em "Imprimir" para gerar o documento para assinatura.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-1" />
            Fechar
          </Button>
          <Button
            size="sm"
            onClick={() => window.print()}
            className="bg-[#0F1B3D] hover:bg-[#1a2b57] text-white font-bold"
          >
            <Printer className="w-4 h-4 mr-1" />
            Imprimir ficha
          </Button>
        </div>
      </div>

      {/* Folha imprimível */}
      <div className="print-area mx-auto max-w-[760px] bg-white mb-8">
        <div className="print-sheet border border-slate-200 rounded-xl p-6 space-y-4 text-slate-900 shadow-lg">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between border-b-2 border-[#D4AF37] pb-3">
            <div className="flex items-center gap-3">
              <LogoMark className="w-10 h-10" />
              <div>
                <div className="text-sm font-bold text-[#0F1B3D]">RC Acqua Life</div>
                <div className="text-[11px] text-slate-500">
                  Academia de Natação e Hidroginástica — {FICHA_LEGAL.city}
                </div>
              </div>
            </div>
            <div className="text-right text-[10px] text-slate-500">
              <div className="font-semibold text-[#0F1B3D]">FICHA DE MATRÍCULA</div>
              <div>Emitida em {new Date().toLocaleDateString('pt-BR')}</div>
            </div>
          </div>

          {/* Dados do aluno */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#0F1B3D] mb-1.5">
              1. Identificação do(a) Aluno(a)
            </h3>
            <Row label="Nome" value={data.name} />
            <Row
              label="Data de Nascimento"
              value={data.birthDate ? formatDateBR(data.birthDate) : null}
            />
            <Row label="CPF do(a) aluno(a)" value={data.cpf} />
            <Row label="Telefone / WhatsApp" value={data.phone} />
            {data.source === 'student' && studentId && (
              <Row label="Código do aluno (interno)" value={studentId.slice(-6).toUpperCase()} />
            )}
            <Row
              label="Endereço"
              value={
                [
                  [data.street, data.streetNumber].filter((v) => v && v.trim()).join(', '),
                  data.complement,
                  data.neighborhood,
                  [data.city, data.uf].filter((v) => v && v.trim()).join(' - '),
                  data.cep ? `CEP ${data.cep}` : '',
                ]
                  .filter((v) => v && v.trim())
                  .join(' · ') || null
              }
            />
          </section>

          {/* Responsável */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#0F1B3D] mb-1.5">
              2. Responsável {isMinor ? '(obrigatório — aluno(a) menor de 18 anos)' : '(se houver)'}
            </h3>
            <Row label="Nome do responsável" value={data.guardianName} />
            <Row label="CPF do responsável" value={data.guardianCpf} />
            <Row label="Celular do responsável" value={data.guardianPhone} />
          </section>

          {/* PAR-Q */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#0F1B3D] mb-1.5">
              3. PAR-Q — Prontidão para Atividade Física
            </h3>
            <div className="space-y-0.5">
              {PARQ_QUESTIONS.map((q, i) => (
                <div key={q.key} className="flex justify-between gap-3 py-0.5">
                  <span className="text-[11px] text-slate-700">
                    {i + 1}. {q.text}
                  </span>
                  <YesNo v={data.parq[q.key]} />
                </div>
              ))}
            </div>
          </section>

          {/* Anamnese */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#0F1B3D] mb-1.5">
              4. Anamnese Aquática
            </h3>
            <div className="space-y-0.5">
              {ANAMNESE_QUESTIONS.map((q) => (
                <div key={q.key} className="flex justify-between gap-3 py-0.5">
                  <span className="text-[11px] text-slate-700">{q.text}</span>
                  <YesNo v={data.anamnese[q.key]} />
                </div>
              ))}
            </div>
            <Row label="Medicamentos em uso" value={data.anamnese.anamnese_medicamentos} />
            <Row label="Objetivo com a natação" value={data.anamnese.anamnese_objetivo} />
          </section>

          {/* Exames */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#0F1B3D] mb-1.5">
              5. Exames obrigatórios — {FICHA_LEGAL.law}
            </h3>
            <p className="text-[10px] text-slate-500 mb-1.5">{FICHA_LEGAL.lawText}</p>
            <Row
              label="Declarou a entrega dos exames (responsável)"
              value={
                data.examsDelivered === 'sim' ? 'Sim' : data.examsDelivered === 'nao' ? 'Não' : null
              }
            />
            <Row
              label="Atestado Cardiológico — emissão"
              value={data.cardioDate ? formatDateBR(data.cardioDate) : null}
            />
            <Row label="Atestado Cardiológico — CRM" value={data.cardioCrm} />
            <Row
              label="Atestado Cardiológico — válido até"
              value={data.cardioDate ? formatDateBR(addSixMonths(data.cardioDate)) : null}
            />
            <Row
              label="Exame Dermatológico — emissão"
              value={data.dermatoDate ? formatDateBR(data.dermatoDate) : null}
            />
            <Row
              label="Exame Dermatológico — válido até"
              value={data.dermatoDate ? formatDateBR(addSixMonths(data.dermatoDate)) : null}
            />
          </section>

          {/* Termo + normas + LGPD */}
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#0F1B3D]">
              6. Termo de ciência de riscos, normas e autorização de imagem
            </h3>
            <p className="text-[11px] leading-relaxed text-slate-700 text-justify">
              <strong>Termo de ciência de riscos:</strong> {FICHA_LEGAL.riskTerm}
            </p>
            <p className="text-[11px] leading-relaxed text-slate-700 text-justify">
              <strong>Normas da academia:</strong> {FICHA_LEGAL.rules}
            </p>
            <p className="text-[11px] leading-relaxed text-slate-700 text-justify">
              <strong>Autorização de uso de imagem (LGPD — Lei nº 13.709/2018):</strong>{' '}
              {FICHA_LEGAL.lgpd}
            </p>
            <div className="flex items-center gap-6 pt-1">
              <span className="text-[12px]">
                <strong>{usoImagemLabel === 'AUTORIZO' ? '( X )' : '(   )'}</strong> Autorizo
              </span>
              <span className="text-[12px]">
                <strong>{usoImagemLabel === 'NÃO AUTORIZO' ? '( X )' : '(   )'}</strong> Não
                autorizo
              </span>
            </div>
          </section>

          {/* Assinaturas */}
          <section className="pt-3">
            <div className="grid grid-cols-2 gap-8 pt-10">
              <div className="border-t border-slate-800 pt-1 text-center">
                <p className="text-[10px] text-slate-600">
                  Assinatura do(a) aluno(a) {data.name ? `— ${data.name}` : ''}
                </p>
              </div>
              <div className="border-t border-slate-800 pt-1 text-center">
                <p className="text-[10px] text-slate-600">
                  Assinatura do responsável{' '}
                  {data.guardianName ? `— ${data.guardianName}` : '(se menor)'}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 text-justify pt-2">{FICHA_LEGAL.footer}</p>
            <p className="text-center text-[9px] text-slate-400 pt-4">
              {FICHA_LEGAL.city} · Documento gerado pela RC Acqua Life · {FICHA_LEGAL.law}
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
