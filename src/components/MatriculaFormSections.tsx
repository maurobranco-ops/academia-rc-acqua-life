// Componentes de formulário compartilhados: PAR-Q (7 perguntas sim/não),
// anamnese aquática e seção de exames obrigatórios (Lei PB 9.863/2012).
// Usados no formulário público /matricula e no cadastro/edição do aluno.
// Exames: apenas DOIS — cardiológico e dermatológico (o cardiológico é o exame
// de aptidão física; não há exame de aptidão separado).

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import type { ParqValues, ParqKey, AnamneseValues, AnamneseKey } from '@/lib/matricula'
export type { ParqKey, AnamneseKey } from '@/lib/matricula'
import {
  PARQ_QUESTIONS,
  ANAMNESE_QUESTIONS,
  PARQ_YES,
  PARQ_NO,
  type ParqDetailsMap,
  type ParqDetailKey,
} from '@/lib/matricula'

interface ExamsSectionProps {
  /** Atestado cardiológico (Lei PB 9.863/2012 — exigido para natação e/ou hidroginástica). */
  cardioDate?: string
  cardioCrm?: string
  cardioStatus?: 'entregue' | 'pendente'
  onCardioDate?: (v: string) => void
  onCardioCrm?: (v: string) => void
  onCardioStatus?: (v: 'entregue' | 'pendente') => void
  dermatoDate?: string
  dermatoStatus?: 'entregue' | 'pendente'
  onDermatoDate?: (v: string) => void
  onDermatoStatus?: (v: 'entregue' | 'pendente') => void
  /** @deprecated Legado ("aptidão física" = cardiológico). Aceito e ignorado. */
  aptidaoDate?: string
  aptidaoCrm?: string
  aptidaoStatus?: 'entregue' | 'pendente'
  onAptidaoDate?: (v: string) => void
  onAptidaoCrm?: (v: string) => void
  onAptidaoStatus?: (v: 'entregue' | 'pendente') => void
}

/** Exames obrigatórios (Lei Estadual PB 9.863/2012): cardiológico + dermatológico. */
export function MatriculaExamsSection(props: ExamsSectionProps) {
  const hasCardio = props.onCardioDate != null
  return (
    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
      <div className="text-xs font-bold text-[#0F1B3D]">
        Exames obrigatórios (Lei Estadual nº 9.863/2012-PB)
      </div>
      <p className="text-[10px] text-slate-500">
        Atestado Cardiológico e Exame Dermatológico, com validade de 6 meses a partir da data de
        emissão — condição para a prática de natação e/ou hidroginástica.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {hasCardio && (
          <div className="bg-white border border-slate-200 rounded-lg px-2.5 py-2 space-y-1.5">
            <Label className="text-[11px] font-semibold text-[#1E2A3A]">
              Atestado Cardiológico{' '}
              <span
                className="text-red-600 font-bold"
                title="Exigido para natação e/ou hidroginástica"
              >
                *
              </span>
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-500">Data de emissão</span>
                <Input
                  type="date"
                  value={props.cardioDate || ''}
                  onChange={(e) => props.onCardioDate?.(e.target.value)}
                  className="h-8 text-xs focus-visible:ring-[#D4AF37]"
                />
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-500">Status</span>
                <select
                  value={props.cardioStatus || 'pendente'}
                  onChange={(e) =>
                    props.onCardioStatus?.(e.target.value as 'entregue' | 'pendente')
                  }
                  className="h-8 w-full text-xs rounded-md border border-slate-200 bg-white px-2 focus-visible:ring-[#D4AF37] outline-none"
                >
                  <option value="pendente">Pendente</option>
                  <option value="entregue">Entregue</option>
                </select>
              </div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-500">CRM do médico (registro)</span>
              <Input
                placeholder="Ex: CRM 12345 PB"
                value={props.cardioCrm || ''}
                onChange={(e) => props.onCardioCrm?.(e.target.value)}
                className="h-8 text-xs focus-visible:ring-[#D4AF37]"
              />
            </div>
            <p className="text-[10px] text-slate-500">
              Exigido para as atividades de natação e/ou hidroginástica (validade: 6 meses).
            </p>
          </div>
        )}
        <div className="bg-white border border-slate-200 rounded-lg px-2.5 py-2 space-y-1.5">
          <Label className="text-[11px] font-semibold text-[#1E2A3A]">Exame Dermatológico</Label>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-500">Data de emissão</span>
              <Input
                type="date"
                value={props.dermatoDate || ''}
                onChange={(e) => props.onDermatoDate?.(e.target.value)}
                className="h-8 text-xs focus-visible:ring-[#D4AF37]"
              />
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-500">Status</span>
              <select
                value={props.dermatoStatus || 'pendente'}
                onChange={(e) => props.onDermatoStatus?.(e.target.value as 'entregue' | 'pendente')}
                className="h-8 w-full text-xs rounded-md border border-slate-200 bg-white px-2 focus-visible:ring-[#D4AF37] outline-none"
              >
                <option value="pendente">Pendente</option>
                <option value="entregue">Entregue</option>
              </select>
            </div>
          </div>
          <p className="text-[10px] text-slate-500">Validade: 6 meses da emissão.</p>
        </div>
      </div>
    </div>
  )
}

interface HealthSectionProps {
  parq: ParqValues
  anamnese: Partial<Record<AnamneseKey, string>>
  usoImagem: 'sim' | 'nao' | ''
  onParq: (key: ParqKey, v: string) => void
  /** Detalhes escritos das perguntas 5-7 (opcional — sem eles o PAR-Q fica só sim/não). */
  parqDetails?: ParqDetailsMap
  onParqDetail?: (key: ParqDetailKey, v: string) => void
  onAnamnese: (key: AnamneseKey, v: string) => void
  onUsoImagem: (v: 'sim' | 'nao') => void
}

/** PAR-Q (7 perguntas) + anamnese aquática + autorização de uso de imagem. */
export function MatriculaHealthSection(props: HealthSectionProps) {
  return (
    <div className="space-y-2.5">
      <ParqSection
        values={props.parq}
        onChange={props.onParq}
        details={props.parqDetails}
        onDetailChange={props.onParqDetail}
      />
      <AnamneseSection values={props.anamnese} onChange={props.onAnamnese} />
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
        <div className="text-xs font-bold text-[#0F1B3D]">Uso de imagem (LGPD)</div>
        <div className="bg-white border border-slate-200 rounded-lg px-2.5 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <span className="text-[11px] text-[#1E2A3A] sm:pr-3">
            Autoriza o uso da imagem do(a) aluno(a) em fotos e vídeos institucionais?
          </span>
          <div className="shrink-0">
            <YesNoPicker
              name="uso-imagem"
              value={props.usoImagem}
              onChange={(v) => props.onUsoImagem(v === 'sim' ? 'sim' : 'nao')}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

interface YesNoProps {
  value: string
  onChange: (v: string) => void
  name: string
}

export function YesNoPicker({ value, onChange, name }: YesNoProps) {
  return (
    <RadioGroup
      value={value || ''}
      onValueChange={onChange}
      className="flex items-center gap-4"
      aria-label={name}
    >
      <div className="flex items-center gap-1.5">
        <RadioGroupItem value={PARQ_YES} id={`${name}-sim`} />
        <Label htmlFor={`${name}-sim`} className="text-xs font-medium cursor-pointer">
          Sim
        </Label>
      </div>
      <div className="flex items-center gap-1.5">
        <RadioGroupItem value={PARQ_NO} id={`${name}-nao`} />
        <Label htmlFor={`${name}-nao`} className="text-xs font-medium cursor-pointer">
          Não
        </Label>
      </div>
    </RadioGroup>
  )
}

interface ParqSectionProps {
  values: ParqValues
  onChange: (key: ParqKey, v: string) => void
  /** Detalhes escritos das perguntas 5-7 (parq_5_detail etc.) — opcional. */
  details?: ParqDetailsMap
  onDetailChange?: (key: ParqDetailKey, v: string) => void
  /** Avisos de validação por chave de detalhe (ex.: "SIM" sem descrição). */
  detailErrors?: Partial<Record<ParqDetailKey, string>>
}

/** Perguntas do PAR-Q que aceitam resposta escrita quando a resposta é "SIM". */
const PARQ_DETAIL_BY_QUESTION: Partial<Record<ParqKey, ParqDetailKey>> = {
  parq_5: 'parq_5_detail',
  parq_6: 'parq_6_detail',
  parq_7: 'parq_7_detail',
}

export function ParqSection({
  values,
  onChange,
  details,
  onDetailChange,
  detailErrors,
}: ParqSectionProps) {
  return (
    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
      <div className="text-xs font-bold text-[#0F1B3D]">
        PAR-Q — Questionário de Prontidão para Atividade Física
      </div>
      <p className="text-[10px] text-slate-500">
        Responda todas as perguntas com Sim ou Não. Nas perguntas 5, 6 e 7, se a resposta for "SIM",
        descreva em poucas linhas.
      </p>
      <div className="space-y-2">
        {PARQ_QUESTIONS.map((q, i) => {
          const detailKey = PARQ_DETAIL_BY_QUESTION[q.key]
          return (
            <div
              key={q.key}
              className="flex flex-col gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-2"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <span className="text-[11px] text-[#1E2A3A] sm:pr-3">
                  <strong>{i + 1}.</strong> {q.text}
                </span>
                <div className="shrink-0">
                  <YesNoPicker
                    name={q.key}
                    value={values[q.key] || ''}
                    onChange={(v) => onChange(q.key, v)}
                  />
                </div>
              </div>
              {detailKey && values[q.key] === PARQ_YES && onDetailChange && details && (
                <div className="space-y-1 pt-0.5">
                  <Label
                    htmlFor={`parq-detail-${detailKey}`}
                    className="text-[10px] font-semibold text-[#1E2A3A]"
                  >
                    Detalhe — descreva a situação (aprox. 3 linhas)
                  </Label>
                  <Textarea
                    id={`parq-detail-${detailKey}`}
                    rows={3}
                    placeholder="Ex.: descreva o problema/medicação/razão, desde quando e como afeta a atividade na piscina..."
                    value={details[detailKey] || ''}
                    onChange={(e) => onDetailChange(detailKey, e.target.value)}
                    className={`text-xs resize-y ${
                      detailErrors?.[detailKey]
                        ? 'border-red-500 focus-visible:ring-red-500'
                        : 'focus-visible:ring-[#D4AF37]'
                    }`}
                  />
                  {detailErrors?.[detailKey] && (
                    <p className="text-[10px] text-red-600 font-medium">
                      {detailErrors[detailKey]}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface AnamneseSectionProps {
  values: Partial<Record<AnamneseKey, string>>
  onChange: (key: AnamneseKey, v: string) => void
}

export function AnamneseSection({ values, onChange }: AnamneseSectionProps) {
  return (
    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
      <div className="text-xs font-bold text-[#0F1B3D]">Anamnese Aquática</div>
      <div className="space-y-2">
        {ANAMNESE_QUESTIONS.map((q) => (
          <div
            key={q.key}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-2"
          >
            <span className="text-[11px] text-[#1E2A3A] sm:pr-3">{q.text}</span>
            <div className="shrink-0">
              <YesNoPicker
                name={q.key}
                value={values[q.key] || ''}
                onChange={(v) => onChange(q.key, v)}
              />
            </div>
          </div>
        ))}
        <div className="bg-white border border-slate-200 rounded-lg px-2.5 py-2 space-y-1">
          <Label className="text-[11px] font-semibold text-[#1E2A3A]">Medicamentos em uso</Label>
          <Input
            placeholder="Ex: Losartana 50mg (ou deixe em branco)"
            value={values.anamnese_medicamentos || ''}
            onChange={(e) => onChange('anamnese_medicamentos', e.target.value)}
            className="h-8 text-xs focus-visible:ring-[#D4AF37]"
          />
        </div>
        <div className="bg-white border border-slate-200 rounded-lg px-2.5 py-2 space-y-1">
          <Label className="text-[11px] font-semibold text-[#1E2A3A]">Objetivo com a natação</Label>
          <Input
            placeholder="Ex: saúde, recreação, performance..."
            value={values.anamnese_objetivo || ''}
            onChange={(e) => onChange('anamnese_objetivo', e.target.value)}
            className="h-8 text-xs focus-visible:ring-[#D4AF37]"
          />
        </div>
      </div>
    </div>
  )
}
