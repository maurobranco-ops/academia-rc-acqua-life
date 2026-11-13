/**
 * Componente de foto individual do aluno, usado no formulário de
 * cadastrar/editar aluno (src/pages/Students.tsx).
 * Mostra preview (foto nova selecionada ou foto já salva do aluno)
 * e permite escolher arquivo, remover a seleção e salvar com o aluno.
 */
import React, { useRef } from 'react'
import { Camera, Loader2, Trash2, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export interface StudentPhotoPickerProps {
  /** URL da foto já salva do aluno (ou null se não tiver) */
  currentPhotoUrl: string | null
  /** Preview local do arquivo recém-selecionado (ou null) */
  previewUrl: string | null
  /** Arquivo selecionado pelo usuário (ou null) */
  selectedFile: File | null
  /** Nome do aluno para o avatar de fallback (iniciais) */
  studentName: string
  uploading?: boolean
  onFileSelect: (file: File | null) => void
}

export function StudentPhotoPicker({
  currentPhotoUrl,
  previewUrl,
  selectedFile,
  studentName,
  uploading,
  onFileSelect,
}: StudentPhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const displayUrl = previewUrl || currentPhotoUrl

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null
    onFileSelect(file)
    // Permite reselecionar o mesmo arquivo depois de limpar
    e.target.value = ''
  }

  return (
    <div className="space-y-1">
      <Label className="font-semibold text-[#1E2A3A]">Foto do Aluno</Label>
      <div className="flex items-center gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
        <div className="relative shrink-0">
          {displayUrl ? (
            <img
              src={displayUrl}
              alt={studentName || 'Foto do aluno'}
              className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center border-2 border-white shadow-sm">
              <UserRound className="w-7 h-7 text-slate-400" />
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="h-7 text-xs font-semibold border-[#0F1B3D]/30 text-[#0F1B3D] hover:bg-slate-100 rounded-lg inline-flex items-center gap-1.5"
            >
              <Camera className="w-3.5 h-3.5 text-[#17A2B8]" />
              {displayUrl ? 'Trocar foto' : 'Escolher foto'}
            </Button>
            {selectedFile && !uploading && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onFileSelect(null)}
                className="h-7 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg inline-flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remover seleção
              </Button>
            )}
          </div>
          <p className="text-[10px] text-slate-500 truncate">
            {selectedFile
              ? `Nova foto selecionada: ${selectedFile.name}`
              : displayUrl
                ? 'O aluno já possui uma foto salva. Selecione um arquivo para trocar.'
                : 'JPG, PNG ou WEBP. A foto aparece no cadastro e no cartão do aluno.'}
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  )
}
