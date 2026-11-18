// Aba "Saúde & Exames" da ficha do aluno (StudentDetail): os DOIS exames
// obrigatórios (Lei Estadual PB 9.863/2012 — atestado cardiológico + exame
// dermatológico, validade 6 meses com alerta visual vencido/próximo do
// vencimento), PAR-Q, anamnese e uso de imagem — editáveis ali mesmo — e o
// botão "Imprimir ficha" (PrintableFichaDialog).

import { useEffect, useState } from 'react'
import { Loader2, Printer, Save, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { academyService } from '@/services/academy'
import type { StudentRecord, ExamAlertInfo } from '@/types/database'
import { getExamAlert } from '@/types/database'
import {
  PARQ_QUESTIONS,
  ANAMNESE_QUESTIONS,
  EMPTY_PARQ,
  EMPTY_ANAMNESE,
  EMPTY_PARQ_DETAILS,
  formatDateBR,
  type ParqValues,
  type ParqKey,
  type ParqDetailsMap,
  type ParqDetailKey,
  type AnamneseValues,
  type AnamneseKey,
} from '@/lib/matricula'
import {
  MatriculaExamsSection,
  ParqSection,
  AnamneseSection,
  YesNoPicker,
} from '@/components/MatriculaFormSections'
import { PrintableFichaDialog, studentToPrintable } from '@/components/PrintableFicha'

type ExamStatus = 'entregue' | 'pendente'

function examBadgeClass(level: ExamAlertInfo['level']): string {
  if (level === 'expired') return 'bg-red-100 text-red-800 border-red-300 font-bold'
  if (level === 'warn') return 'bg-amber-100 text-amber-800 border-amber-300 font-bold'
  return 'bg-emerald-100 text-emerald-800 border-emerald-300'
}

/** Cartão de um exame com alerta visual de validade (vermelho vencido / âmbar ≤15d / verde). */
function ExamAlertLine({ title, alert }: { title: string; alert: ExamAlertInfo | null }) {
  if (!alert) {
    return (
      <div className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg px-2.5 py-2">
        <span className="text-[11px] font-semibold text-[#1E2A3A]">{title}</span>
        <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500">
          Sem data de emissão
        </Badge>
      </div>
    )
  }
  const Icon = alert.level === 'ok' ? ShieldCheck : ShieldAlert
  const iconClass =
    alert.level === 'expired'
      ? 'text-red-600'
      : alert.level === 'warn'
        ? 'text-amber-600'
        : 'text-emerald-600'
  const containerClass =
    alert.level === 'expired'
      ? 'bg-red-50 border-red-300'
      : alert.level === 'warn'
        ? 'bg-amber-50 border-amber-300'
        : 'bg-white border-slate-200'
  return (
    <div
      className={`flex items-center justify-between gap-3 border rounded-lg px-2.5 py-2 ${containerClass}`}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#1E2A3A]">
        <Icon className={`w-3.5 h-3.5 ${iconClass} shrink-0`} />
        {title}
      </span>
      <span className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] text-slate-500">
          Válido até {alert.expiry ? formatDateBR(alert.expiry) : '—'}
        </span>
        <Badge className={`text-[10px] ${examBadgeClass(alert.level)}`}>{alert.label}</Badge>
      </span>
    </div>
  )
}

/** Resumo de leitura do PAR-Q/anamnese já salvo (destaca os "SIM" em vermelho). */
function HealthReadout({ parq, anamnese }: { parq: ParqValues; anamnese: AnamneseValues }) {
  const yesCount =
    PARQ_QUESTIONS.filter((q) => parq[q.key] === 'sim').length +
    ANAMNESE_QUESTIONS.filter((q) => anamnese[q.key] === 'sim').length
  if (yesCount === 0) {
    return (
      <p className="text-[11px] text-emerald-700 font-semibold">
        Nenhuma resposta "SIM" registrada no PAR-Q/anamnese.
      </p>
    )
  }
  return (
    <div className="flex items-start gap-1.5 text-[11px] text-red-700 font-semibold">
      <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <span>
        {yesCount} resposta{yesCount === 1 ? '' : 's'} "SIM" registrada
        {yesCount === 1 ? '' : 's'} — avaliar antes de liberar as atividades aquáticas.
      </span>
    </div>
  )
}

interface StudentHealthTabProps {
  student: StudentRecord
  /** Chamado após salvar com sucesso (para a ficha recarregar os dados do aluno). */
  onSaved?: () => void
}

export function StudentHealthTab({ student, onSaved }: StudentHealthTabProps) {
  const { toast } = useToast()

  const [dermatoDate, setDermatoDate] = useState('')
  const [dermatoStatus, setDermatoStatus] = useState<ExamStatus>('pendente')
  const [cardioDate, setCardioDate] = useState('')
  const [cardioCrm, setCardioCrm] = useState('')
  const [cardioStatus, setCardioStatus] = useState<ExamStatus>('pendente')
  const [parq, setParq] = useState<ParqValues>(EMPTY_PARQ)
  const [parqDetails, setParqDetails] = useState<ParqDetailsMap>({ ...EMPTY_PARQ_DETAILS })
  const [anamnese, setAnamnese] = useState<AnamneseValues>(EMPTY_ANAMNESE)
  const [usoImagem, setUsoImagem] = useState<'sim' | 'nao' | ''>('')
  const [saving, setSaving] = useState(false)
  const [fichaOpen, setFichaOpen] = useState(false)

  // Recarrega o formulário sempre que o aluno trocar (ou após salvar/reload da ficha)
  useEffect(() => {
    setDermatoDate(student.dermato_date || '')
    setDermatoStatus(student.dermato_status === 'entregue' ? 'entregue' : 'pendente')
    setCardioDate(student.cardio_date || '')
    setCardioCrm(student.cardio_crm || '')
    setCardioStatus(student.cardio_status === 'entregue' ? 'entregue' : 'pendente')
    setParq({
      parq_1: student.parq_1 || '',
      parq_2: student.parq_2 || '',
      parq_3: student.parq_3 || '',
      parq_4: student.parq_4 || '',
      parq_5: student.parq_5 || '',
      parq_6: student.parq_6 || '',
      parq_7: student.parq_7 || '',
    })
    setParqDetails({
      parq_5_detail: student.parq_5_detail || '',
      parq_6_detail: student.parq_6_detail || '',
      parq_7_detail: student.parq_7_detail || '',
    })
    setAnamnese({
      anamnese_medo_agua: student.anamnese_medo_agua || '',
      anamnese_convulsoes: student.anamnese_convulsoes || '',
      anamnese_alergia_cloro: student.anamnese_alergia_cloro || '',
      anamnese_medicamentos: student.anamnese_medicamentos || '',
      anamnese_objetivo: student.anamnese_objetivo || '',
    })
    setUsoImagem(student.uso_imagem_autorizado || '')
  }, [student])

  const handleSave = async () => {
    setSaving(true)
    try {
      await academyService.updateStudent(student.id, {
        dermato_date: dermatoDate || undefined,
        dermato_status: dermatoStatus,
        cardio_date: cardioDate || undefined,
        cardio_crm: cardioCrm.trim() || undefined,
        cardio_status: cardioStatus,
        parq_1: parq.parq_1 || '',
        parq_2: parq.parq_2 || '',
        parq_3: parq.parq_3 || '',
        parq_4: parq.parq_4 || '',
        parq_5: parq.parq_5 || '',
        parq_6: parq.parq_6 || '',
        parq_7: parq.parq_7 || '',
        parq_5_detail: parqDetails.parq_5_detail.trim() || undefined,
        parq_6_detail: parqDetails.parq_6_detail.trim() || undefined,
        parq_7_detail: parqDetails.parq_7_detail.trim() || undefined,
        anamnese_medo_agua: anamnese.anamnese_medo_agua || '',
        anamnese_convulsoes: anamnese.anamnese_convulsoes || '',
        anamnese_alergia_cloro: anamnese.anamnese_alergia_cloro || '',
        anamnese_medicamentos: anamnese.anamnese_medicamentos || '',
        anamnese_objetivo: anamnese.anamnese_objetivo || '',
        uso_imagem_autorizado: (usoImagem || undefined) as 'sim' | 'nao' | undefined,
      })
      toast({
        title: 'Dados de saúde salvos',
        description: 'Exames, PAR-Q e anamnese atualizados no prontuário do aluno.',
      })
      onSaved?.()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao salvar dados de saúde',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const dermatoAlert = getExamAlert(dermatoDate, dermatoStatus)
  const cardioAlert = getExamAlert(cardioDate, cardioStatus)
  const savedParq: ParqValues = {
    parq_1: student.parq_1 || '',
    parq_2: student.parq_2 || '',
    parq_3: student.parq_3 || '',
    parq_4: student.parq_4 || '',
    parq_5: student.parq_5 || '',
    parq_6: student.parq_6 || '',
    parq_7: student.parq_7 || '',
  }
  const savedParqDetails: ParqDetailsMap = {
    parq_5_detail: student.parq_5_detail || '',
    parq_6_detail: student.parq_6_detail || '',
    parq_7_detail: student.parq_7_detail || '',
  }
  const savedParqYes = PARQ_QUESTIONS.filter((q) => savedParq[q.key] === 'sim').length
  const parqAnswered = PARQ_QUESTIONS.some((q) => (savedParq[q.key] || '') !== '')
  const savedAnamnese: AnamneseValues = {
    anamnese_medo_agua: student.anamnese_medo_agua || '',
    anamnese_convulsoes: student.anamnese_convulsoes || '',
    anamnese_alergia_cloro: student.anamnese_alergia_cloro || '',
    anamnese_medicamentos: student.anamnese_medicamentos || '',
    anamnese_objetivo: student.anamnese_objetivo || '',
  }

  return (
    <div className="space-y-4">
      {/* Resumo de validade dos exames — alerta visual estilo sino de inadimplência */}
      <Card className="bg-white border-[#E0E4EA] rounded-xl shadow-xs p-4 space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-bold text-[#0F1B3D]">
            Exames obrigatórios — Lei Estadual nº 9.863/2012-PB
          </h3>
          <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px]">
            {savedParqYes > 0
              ? `PAR-Q: ${savedParqYes} resposta${savedParqYes === 1 ? '' : 's'} "SIM"`
              : parqAnswered
                ? 'PAR-Q: sem resposta "SIM"'
                : 'PAR-Q: não respondido'}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="text-xs border-[#0F1B3D] text-[#0F1B3D] hover:bg-slate-100 font-bold"
            onClick={() => setFichaOpen(true)}
          >
            <Printer className="w-4 h-4 mr-1" /> Imprimir ficha
          </Button>
        </div>
        <ExamAlertLine title="Atestado Cardiológico" alert={cardioAlert} />
        <ExamAlertLine title="Exame Dermatológico" alert={dermatoAlert} />

        {/* PAR-Q também no resumo de status dos exames (sete perguntas com SIM em vermelho) */}
        <div
          className={`border rounded-lg px-2.5 py-2 space-y-1.5 ${
            savedParqYes > 0
              ? 'bg-red-50 border-red-300'
              : parqAnswered
                ? 'bg-white border-slate-200'
                : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#1E2A3A]">
              {savedParqYes > 0 ? (
                <ShieldAlert className="w-3.5 h-3.5 text-red-600 shrink-0" />
              ) : (
                <ShieldCheck
                  className={`w-3.5 h-3.5 shrink-0 ${parqAnswered ? 'text-emerald-600' : 'text-slate-400'}`}
                />
              )}
              PAR-Q — Prontidão para Atividade Física (7 perguntas)
            </span>
            <Badge
              className={`text-[10px] ${
                savedParqYes > 0
                  ? 'bg-red-100 text-red-800 border border-red-300 font-bold'
                  : parqAnswered
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-slate-50 text-slate-500 border border-slate-200'
              }`}
            >
              {!parqAnswered
                ? 'Não respondido'
                : savedParqYes > 0
                  ? `SIM: ${savedParqYes} · avaliar`
                  : 'Sem "SIM" — ok'}
            </Badge>
          </div>
          {parqAnswered && (
            <div className="space-y-0.5 pt-0.5">
              {PARQ_QUESTIONS.map((q, i) => {
                const dKey = `parq_${i + 1}_detail` as ParqDetailKey
                const detail = savedParqDetails[dKey]
                return (
                  <div key={q.key} className="space-y-0.5 py-0.5">
                    <div className="flex justify-between gap-3">
                      <span
                        className={`text-[11px] ${savedParq[q.key] === 'sim' ? 'text-red-700 font-bold' : 'text-slate-600'}`}
                      >
                        {i + 1}. {q.text}
                      </span>
                      <span className="text-[11px] font-semibold shrink-0">
                        {savedParq[q.key] === 'sim'
                          ? 'SIM'
                          : savedParq[q.key] === 'nao'
                            ? 'Não'
                            : '—'}
                      </span>
                    </div>
                    {savedParq[q.key] === 'sim' && detail && detail.trim() && (
                      <p className="text-[10px] text-[#0F1B3D] pl-4 border-l-2 border-amber-200 whitespace-pre-line break-words">
                        {detail}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Edição dos exames (datas, CRM, status) */}
      <Card className="bg-white border-[#E0E4EA] rounded-xl shadow-xs p-4 space-y-3">
        <h3 className="text-sm font-bold text-[#0F1B3D]">Editar exames</h3>
        <MatriculaExamsSection
          dermatoDate={dermatoDate}
          dermatoStatus={dermatoStatus}
          onDermatoDate={setDermatoDate}
          onDermatoStatus={setDermatoStatus}
          cardioDate={cardioDate}
          cardioCrm={cardioCrm}
          cardioStatus={cardioStatus}
          onCardioDate={setCardioDate}
          onCardioCrm={setCardioCrm}
          onCardioStatus={setCardioStatus}
        />
      </Card>

      {/* PAR-Q + anamnese — leitura do que está salvo e edição inline */}
      <Card className="bg-white border-[#E0E4EA] rounded-xl shadow-xs p-4 space-y-3">
        <h3 className="text-sm font-bold text-[#0F1B3D]">PAR-Q &amp; Anamnese Aquática</h3>
        <HealthReadout parq={savedParq} anamnese={savedAnamnese} />
        <ParqSection
          values={parq}
          details={parqDetails}
          onDetailChange={(key: ParqDetailKey, v: string) =>
            setParqDetails((d) => ({ ...d, [key]: v }))
          }
          onChange={(key: ParqKey, v: string) => setParq((p) => ({ ...p, [key]: v }))}
        />
        <AnamneseSection
          values={anamnese}
          onChange={(key: AnamneseKey, v: string) => setAnamnese((a) => ({ ...a, [key]: v }))}
        />
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <span className="text-[11px] text-[#1E2A3A] sm:pr-3">
            Autoriza o uso da imagem do(a) aluno(a) em fotos e vídeos institucionais?
          </span>
          <div className="shrink-0">
            <YesNoPicker
              name="uso-imagem-detail"
              value={usoImagem}
              onChange={(v) => setUsoImagem(v === 'sim' ? 'sim' : 'nao')}
            />
          </div>
        </div>
      </Card>

      {/* Salvar */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#D4AF37] hover:bg-[#B8953A] text-[#0F1B3D] font-bold text-xs h-9 rounded-xl shadow-sm"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-1" />
          )}
          {saving ? 'Salvando...' : 'Salvar dados de saúde'}
        </Button>
      </div>

      <PrintableFichaDialog
        open={fichaOpen}
        onOpenChange={setFichaOpen}
        data={studentToPrintable(student)}
        studentId={student.id}
        onSignatureRegistered={onSaved}
      />
    </div>
  )
}
