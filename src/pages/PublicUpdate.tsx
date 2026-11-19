// Página pública /atualizar/TOKEN — autocadastro do aluno por link seguro, SEM login.
// O aluno atualiza: PAR-Q (7 perguntas, detalhes 5-7 quando SIM), exames obrigatórios
// (cardiológico com CRM + dermatológico, Lei PB 9.863/2012 — validade 6 meses), anamnese
// aquática, uso de imagem (LGPD) e endereço completo.
// TRAVADO (só exibição): nome, CPF, nascimento, dados financeiros e turmas.
// Ao salvar: ficha_pendente=true + "Atualizado pelo aluno em …" (feito no SERVIDOR,
// rota POST /backend/v1/update-link/{token}).

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, Lock, ShieldCheck, Send, XCircle, Clock, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { LogoMark } from '@/components/Logo'
import {
  ParqSection,
  AnamneseSection,
  MatriculaExamsSection,
} from '@/components/MatriculaFormSections'
import {
  EnrollAddressSection,
  EMPTY_ADDRESS,
  type EnrollAddressValue,
} from '@/components/EnrollAddressSection'
import {
  PARQ_QUESTIONS,
  EMPTY_PARQ,
  EMPTY_ANAMNESE,
  EMPTY_PARQ_DETAILS,
  getParq,
  getAnamnese,
  getParqDetails,
  PARQ_YES,
  formatDateBR,
  type ParqKey,
  type AnamneseKey,
  type ParqDetailKey,
  FICHA_LEGAL,
} from '@/lib/matricula'
import type { StudentRecord } from '@/types/database'

type LoadState = 'loading' | 'ready' | 'invalid'

interface TokenPayload {
  expires_at: string
  student: StudentRecord
}

const YES_NO_KEYS = PARQ_QUESTIONS.map((q) => q.key) as ParqKey[]

function isFilled(v?: string | null): boolean {
  return typeof v === 'string' && v.trim() !== ''
}

export default function PublicUpdate() {
  const { token = '' } = useParams()
  const [state, setState] = useState<LoadState>('loading')
  const [data, setData] = useState<TokenPayload | null>(null)
  const [saving, setSaving] = useState(false)
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Campos editáveis
  const [parq, setParq] = useState({ ...EMPTY_PARQ })
  const [parqDetails, setParqDetails] = useState({ ...EMPTY_PARQ_DETAILS })
  const [anamnese, setAnamnese] = useState({ ...EMPTY_ANAMNESE })
  const [usoImagem, setUsoImagem] = useState<'sim' | 'nao' | ''>('')
  const [termoCiencia, setTermoCiencia] = useState(false)
  const [address, setAddress] = useState<EnrollAddressValue>({ ...EMPTY_ADDRESS })
  const [cardioDate, setCardioDate] = useState('')
  const [cardioCrm, setCardioCrm] = useState('')
  const [cardioStatus, setCardioStatus] = useState<'entregue' | 'pendente'>('pendente')
  const [dermatoDate, setDermatoDate] = useState('')
  const [dermatoStatus, setDermatoStatus] = useState<'entregue' | 'pendente'>('pendente')

  useEffect(() => {
    let alive = true
    fetch(`${import.meta.env.VITE_POCKETBASE_URL || ''}/backend/v1/update-link/${token}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return
        if (!j || !j.success) {
          setState('invalid')
          return
        }
        setData(j)
        const s = j.student || {}
        setParq(getParq(s))
        setParqDetails(getParqDetails(s))
        setAnamnese(getAnamnese(s))
        setUsoImagem((s.uso_imagem_autorizado || '') as 'sim' | 'nao' | '')
        setAddress({
          cep: s.cep || '',
          street: s.street || '',
          street_number: s.street_number || '',
          complement: s.complement || '',
          neighborhood: s.neighborhood || '',
          city: s.city || '',
          uf: s.uf || '',
        })
        setCardioDate(s.aptidao_date || '')
        setCardioCrm(s.aptidao_crm || '')
        setCardioStatus(s.aptidao_status === 'entregue' ? 'entregue' : 'pendente')
        setDermatoDate(s.dermato_date || '')
        setDermatoStatus(s.dermato_status === 'entregue' ? 'entregue' : 'pendente')
        setState('ready')
      })
      .catch(() => {
        if (alive) setState('invalid')
      })
    return () => {
      alive = false
    }
  }, [token])

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    YES_NO_KEYS.forEach((k, i) => {
      if (!isFilled(parq[k])) errs[k] = 'Responda Sim ou Não.'
      const detailKey = `parq_${i + 1}_detail` as ParqDetailKey
      if (parq[k] === PARQ_YES && isDetailKey(detailKey) && !isFilled(parqDetails[detailKey])) {
        errs[detailKey] = 'Respondeu SIM — descreva em poucas linhas.'
      }
    })
    ;(
      ['anamnese_medo_agua', 'anamnese_convulsoes', 'anamnese_alergia_cloro'] as AnamneseKey[]
    ).forEach((k) => {
      if (!isFilled(anamnese[k])) errs[k] = 'Responda Sim ou Não.'
    })
    if (!isFilled(anamnese.anamnese_medicamentos)) {
      errs.anamnese_medicamentos = 'Informe os medicamentos ou "Nenhum".'
    }
    if (!isFilled(anamnese.anamnese_objetivo)) errs.anamnese_objetivo = 'Informe o objetivo.'
    if (!usoImagem) errs.uso_imagem_autorizado = 'Autorize ou não o uso da imagem.'
    if (!termoCiencia) {
      errs.termo_ciencia = 'Marque a caixa "Li e concordo com o termo de ciência" — é obrigatória.'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    setServerError('')
    if (!validate()) {
      setServerError('Confira os campos destacados antes de enviar.')
      return
    }
    setSaving(true)
    try {
      const r = await fetch(
        `${import.meta.env.VITE_POCKETBASE_URL || ''}/backend/v1/update-link/${token}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...parq,
            ...parqDetails,
            ...anamnese,
            uso_imagem_autorizado: usoImagem,
            aptidao_date: cardioDate,
            aptidao_crm: cardioCrm,
            aptidao_status: cardioStatus,
            dermato_date: dermatoDate,
            dermato_status: dermatoStatus,
            term_ciencia_aceito: termoCiencia,
            cep: address.cep,
            street: address.street,
            street_number: address.street_number,
            complement: address.complement,
            neighborhood: address.neighborhood,
            city: address.city,
            uf: address.uf,
          }),
        },
      )
      const j = await r.json().catch(() => null)
      if (!r.ok || !j || !j.success) {
        setServerError((j && j.message) || 'Não foi possível salvar. Tente novamente.')
        return
      }
      setSent(true)
    } catch (_) {
      setServerError('Falha de conexão. Verifique a internet e tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F1B3D] text-white gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" />
        <p className="text-sm text-white/70">Carregando seu link seguro…</p>
      </div>
    )
  }

  if (state === 'invalid') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F1B3D] text-white px-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 max-w-md text-center space-y-3">
          <XCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h1 className="text-xl font-bold">Link inválido, expirado ou revogado</h1>
          <p className="text-sm text-white/70">
            Este link de atualização não é mais válido. Cada link dura 5 dias e é cancelado quando a
            academia gera um novo ou o revoga.
          </p>
          <p className="text-sm text-white/70">
            Fale com a RC Acqua Life para receber um novo link de atualização.
          </p>
        </div>
      </div>
    )
  }

  if (sent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F1B3D] text-white px-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 max-w-md text-center space-y-3">
          <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto" />
          <h1 className="text-xl font-bold">Dados atualizados com sucesso!</h1>
          <p className="text-sm text-white/70">
            A academia recebeu suas informações e vai revisar a sua ficha. Guarde este link: ele
            continua funcionando até <strong>{formatDateBR(data?.expires_at)}</strong> caso queira
            revisar os dados.
          </p>
        </div>
      </div>
    )
  }

  const s = data?.student

  return (
    <div className="min-h-screen bg-slate-100 pb-16">
      {/* Header travado: identidade fixa, nada de nome/CPF/nascimento editáveis */}
      <div className="bg-[#0F1B3D] text-white">
        <div className="max-w-2xl mx-auto px-4 py-6 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <LogoMark className="w-10 h-10" />
            <div>
              <div className="text-sm font-bold">RC Acqua Life</div>
              <div className="text-[11px] text-white/60">Atualização de ficha do aluno</div>
            </div>
          </div>
          <div className="text-right text-[11px] text-white/70 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
            Válido até {formatDateBR(data?.expires_at)}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-3 space-y-4">
        {/* Dados travados (somente leitura) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-[#0F1B3D]">Dados do aluno (fixos)</div>
            <span className="flex items-center gap-1 text-[10px] text-slate-400">
              <Lock className="w-3 h-3" /> não editável
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <InfoField label="Nome" value={s?.name} />
            <InfoField label="CPF" value={s?.cpf} />
            <InfoField label="Nascimento" value={formatDateBR(s?.birth_date)} />
          </div>
          <p className="text-[10px] text-slate-400">
            Nome, CPF, data de nascimento, dados financeiros e turmas só podem ser alterados
            presencialmente com a secretaria.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          className="space-y-4"
        >
          <ParqSection
            values={parq}
            details={parqDetails}
            errors={errors}
            detailErrors={errors as Partial<Record<ParqDetailKey, string>>}
            onDetailChange={(key: ParqDetailKey, v: string) =>
              setParqDetails((prev) => ({ ...prev, [key]: v }))
            }
            onChange={(key: ParqKey, v: string) => setParq((prev) => ({ ...prev, [key]: v }))}
          />
          <AnamneseSection
            values={anamnese}
            errors={errors}
            onChange={(key: AnamneseKey, v: string) =>
              setAnamnese((prev) => ({ ...prev, [key]: v }))
            }
          />
          {/* Uso de imagem (LGPD) — autorização obrigatória */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-[#1E2A3A]">
              Autorização de uso de imagem (LGPD)
            </Label>
            <select
              value={usoImagem}
              onChange={(e) => setUsoImagem(e.target.value as 'sim' | 'nao' | '')}
              className={`h-9 w-full text-sm rounded-md border bg-white px-2 outline-none ${
                errors.uso_imagem_autorizado ? 'border-red-500' : 'border-slate-200'
              } focus-visible:ring-[#D4AF37]`}
            >
              <option value="">Selecione…</option>
              <option value="sim">Autorizo o uso de imagem</option>
              <option value="nao">Não autorizo o uso de imagem</option>
            </select>
            {errors.uso_imagem_autorizado && (
              <p className="text-[10px] text-red-600 font-medium">{errors.uso_imagem_autorizado}</p>
            )}
          </div>

          {/* Termo de riscos + termo de ciência (professora Carmem Rachel) — mesmos
             textos da matrícula (FICHA_LEGAL), logo após a seção de uso de imagem. */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2 shadow-sm">
            <h2 className="text-sm font-bold text-[#0F1B3D]">
              Termo de ciência — {FICHA_LEGAL.law}
            </h2>
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-[#1E2A3A]">Termo de ciência de riscos</p>
              <p className="text-xs text-slate-600 leading-relaxed">{FICHA_LEGAL.riskTerm}</p>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-[#1E2A3A]">Termo de ciência</p>
              <p className="text-xs text-slate-600 leading-relaxed">{FICHA_LEGAL.scienceTerm}</p>
            </div>
            <div
              className={`flex items-start gap-2 rounded-lg p-2.5 border ${
                errors.termo_ciencia ? 'border-red-300 bg-red-50' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <Checkbox
                id="termo-ciencia-aceito"
                checked={termoCiencia}
                onCheckedChange={(v) => {
                  setTermoCiencia(v === true)
                  if (v === true) {
                    setErrors((prev) => {
                      const clean = { ...prev }
                      delete clean.termo_ciencia
                      return clean
                    })
                  }
                }}
              />
              <div className="space-y-0.5">
                <Label
                  htmlFor="termo-ciencia-aceito"
                  className="text-xs font-semibold text-[#1E2A3A]"
                >
                  Li e concordo com o termo de ciência acima <span className="text-red-600">*</span>
                </Label>
                <p className="text-[10px] text-slate-500">
                  Concordância obrigatória para enviar a atualização — {FICHA_LEGAL.law}.
                </p>
                {errors.termo_ciencia && (
                  <p className="text-[10px] text-red-600 font-medium">{errors.termo_ciencia}</p>
                )}
              </div>
            </div>
          </div>

          <MatriculaExamsSection
            cardioDate={cardioDate}
            onCardioDate={setCardioDate}
            cardioCrm={cardioCrm}
            onCardioCrm={setCardioCrm}
            cardioStatus={cardioStatus}
            onCardioStatus={setCardioStatus}
            dermatoDate={dermatoDate}
            onDermatoDate={setDermatoDate}
            dermatoStatus={dermatoStatus}
            onDermatoStatus={setDermatoStatus}
          />

          <EnrollAddressSection
            value={address}
            onChange={(patch) => setAddress({ ...address, ...patch })}
          />

          {serverError && (
            <div className="text-xs text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {serverError}
            </div>
          )}

          <Button
            type="submit"
            disabled={saving}
            className="w-full bg-[#0F1B3D] hover:bg-[#1B2A5B] text-white font-bold h-12 rounded-2xl text-sm"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Enviar atualização
          </Button>

          <p className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
            <Pencil className="w-3 h-3" />
            Ao enviar, sua ficha será marcada para reimpressão e a academia será avisada.
          </p>
        </form>
      </div>
    </div>
  )
}

function InfoField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className="text-[#1E2A3A] font-semibold truncate">{value || '—'}</div>
    </div>
  )
}

function isDetailKey(k: ParqDetailKey): boolean {
  return k === 'parq_5_detail' || k === 'parq_6_detail' || k === 'parq_7_detail'
}
