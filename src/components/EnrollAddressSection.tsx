// Seção de endereço do formulário público /matricula: CEP com busca automática
// na API pública ViaCEP e inserção MANUAL dos dados quando a busca falha,
// o CEP não existe ou o usuário quer corrigir (nenhum erro de CEP bloqueia o envio).

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, MapPin } from 'lucide-react'
import { maskCep } from '@/lib/formatters'
import { fetchAddressByCep } from '@/lib/viacep'

export interface EnrollAddressValue {
  cep: string
  street: string
  street_number: string
  complement: string
  neighborhood: string
  city: string
  uf: string
}

export const EMPTY_ADDRESS: EnrollAddressValue = {
  cep: '',
  street: '',
  street_number: '',
  complement: '',
  neighborhood: '',
  city: '',
  uf: '',
}

interface EnrollAddressSectionProps {
  value: EnrollAddressValue
  onChange: (patch: Partial<EnrollAddressValue>) => void
  /** Erros de campo vindos da validação do formulário (ex.: cidade obrigatória). */
  errors?: Record<string, string>
}

const UFS = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]

export function EnrollAddressSection({ value, onChange, errors = {} }: EnrollAddressSectionProps) {
  const [searching, setSearching] = useState(false)
  const [cepNotice, setCepNotice] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSearchedRef = useRef('')

  const digits = value.cep.replace(/\D/g, '')

  // Busca automática na ViaCEP quando o CEP completa 8 dígitos (com debounce).
  useEffect(() => {
    if (digits.length !== 8 || digits === lastSearchedRef.current) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      lastSearchedRef.current = digits
      setSearching(true)
      setCepNotice('')
      try {
        const addr = await fetchAddressByCep(digits)
        onChange({
          cep: addr.cep || value.cep,
          street: addr.logradouro || value.street,
          neighborhood: addr.bairro || value.neighborhood,
          city: addr.localidade || value.city,
          uf: addr.uf || value.uf,
        })
        if (!addr.logradouro && !addr.bairro) {
          setCepNotice('CEP encontrado, sem logradouro cadastrado — preencha manualmente.')
        }
      } catch (err) {
        // Aviso discreto — NUNCA bloqueia o preenchimento manual.
        setCepNotice(
          err instanceof Error
            ? err.message
            : 'CEP não encontrado — preencha o endereço manualmente.',
        )
      } finally {
        setSearching(false)
      }
    }, 500)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits])

  const errCls = (field: string) =>
    errors[field] ? 'border-red-500 focus-visible:ring-red-500' : 'focus-visible:ring-[#D4AF37]'

  const Err = ({ field }: { field: string }) =>
    errors[field] ? <p className="text-[10px] text-red-600 font-medium">{errors[field]}</p> : null

  return (
    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
      <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F1B3D]">
        <MapPin className="w-3.5 h-3.5 text-[#D4AF37]" />
        Endereço do(a) aluno(a)
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="space-y-1">
          <Label className="font-semibold text-[11px] text-[#1E2A3A]">
            CEP <span className="text-slate-400 font-normal">(busca automática)</span>
          </Label>
          <div className="relative">
            <Input
              placeholder="00000-000"
              inputMode="numeric"
              value={maskCep(value.cep)}
              onChange={(e) => onChange({ cep: e.target.value })}
              className={`h-8 text-xs pr-8 ${errCls('cep')}`}
            />
            {searching && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D4AF37] absolute right-2.5 top-1/2 -translate-y-1/2" />
            )}
          </div>
          {cepNotice ? (
            <p className="text-[10px] text-amber-700 font-medium">{cepNotice}</p>
          ) : (
            <Err field="cep" />
          )}
        </div>
        <div className="space-y-1">
          <Label className="font-semibold text-[11px] text-[#1E2A3A]">Rua / Logradouro</Label>
          <Input
            placeholder="Ex: Rua das Flores"
            value={value.street}
            onChange={(e) => onChange({ street: e.target.value })}
            className={`h-8 text-xs ${errCls('street')}`}
          />
          <Err field="street" />
        </div>
        <div className="space-y-1">
          <Label className="font-semibold text-[11px] text-[#1E2A3A]">Número</Label>
          <Input
            placeholder="Ex: 123"
            value={value.street_number}
            onChange={(e) => onChange({ street_number: e.target.value })}
            className={`h-8 text-xs ${errCls('street_number')}`}
          />
          <Err field="street_number" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="space-y-1">
          <Label className="font-semibold text-[11px] text-[#1E2A3A]">Complemento</Label>
          <Input
            placeholder="Ex: Apto 202 (opcional)"
            value={value.complement}
            onChange={(e) => onChange({ complement: e.target.value })}
            className="h-8 text-xs focus-visible:ring-[#D4AF37]"
          />
        </div>
        <div className="space-y-1">
          <Label className="font-semibold text-[11px] text-[#1E2A3A]">Bairro</Label>
          <Input
            placeholder="Ex: Centro"
            value={value.neighborhood}
            onChange={(e) => onChange({ neighborhood: e.target.value })}
            className={`h-8 text-xs ${errCls('neighborhood')}`}
          />
          <Err field="neighborhood" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 space-y-1">
            <Label className="font-semibold text-[11px] text-[#1E2A3A]">Cidade</Label>
            <Input
              placeholder="Ex: Bayeux"
              value={value.city}
              onChange={(e) => onChange({ city: e.target.value })}
              className={`h-8 text-xs ${errCls('city')}`}
            />
            <Err field="city" />
          </div>
          <div className="space-y-1">
            <Label className="font-semibold text-[11px] text-[#1E2A3A]">UF</Label>
            <select
              value={value.uf}
              onChange={(e) => onChange({ uf: e.target.value.toUpperCase() })}
              className={`h-8 w-full text-xs rounded-md border bg-white px-1 outline-none ${
                errors.uf ? 'border-red-500' : 'border-slate-200'
              } focus-visible:ring-[#D4AF37]`}
            >
              <option value="">—</option>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
            <Err field="uf" />
          </div>
        </div>
      </div>

      <p className="text-[10px] text-slate-500">
        Digite o CEP para preencher automaticamente — ou edite/preencha manualmente se a busca não
        encontrar o endereço.
      </p>
    </div>
  )
}
