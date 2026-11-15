// Componentes de formulário compartilhados: PAR-Q (7 perguntas sim/não),
// anamnese aquática e seção de exames obrigatórios (Lei PB 9.863/2012).
// Usados no formulário público /matricula e no cadastro/edição do aluno.

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { ParqValues, AnamneseKey } from '@/lib/matricula'
import { PARQ_QUESTIONS, ANAMNESE_QUESTIONS, PARQ_YES, PARQ_NO } from '@/lib/matricula'

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
  onChange: (key: ParqValues[keyof ParqValues], v: string) => void
}

export function ParqSection({ values, onChange }: ParqSectionProps) {
  return (
    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
      <div className="text-xs font-bold text-[#0F1B3D]">
        PAR-Q — Questionário de Prontidão para Atividade Física
      </div>
      <p className="text-[10px] text-slate-500">Responda todas as perguntas com Sim ou Não.</p>
      <div className="space-y-2">
        {PARQ_QUESTIONS.map((q, i) => (
          <div
            key={q.key}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-2"
          >
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
        ))}
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
