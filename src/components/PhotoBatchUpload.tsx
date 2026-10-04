import React, { useState, useEffect, useRef } from 'react'
import {
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  RotateCcw,
  Trash2,
  FileArchive,
  Search,
  Check,
  UserCheck,
  UserX,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from '@/hooks/use-toast'
import { academyService } from '@/services/academy'
import type { StudentRecord } from '@/types/database'
import {
  extractPhotosFromZip,
  buildPhotoItemsList,
  uploadMatchedPhotos,
  type PhotoFileItem,
  type PhotoBatchReport,
} from '@/lib/photoBatchImporter'
import { getStudentPhotoUrl } from '@/lib/studentPhoto'

export function PhotoBatchUpload() {
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [items, setItems] = useState<PhotoFileItem[]>([])
  const [isProcessingFiles, setIsProcessingFiles] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [progressPercent, setProgressPercent] = useState(0)
  const [progressStatus, setProgressStatus] = useState<string>('')
  const [report, setReport] = useState<PhotoBatchReport | null>(null)
  const [filterTab, setFilterTab] = useState<
    'all' | 'needs_confirmation' | 'matched' | 'unmatched' | 'ignored'
  >('all')
  const [searchFilter, setSearchFilter] = useState('')

  // Modal / Diálogo de confirmação lado a lado
  const [confirmingItem, setConfirmingItem] = useState<PhotoFileItem | null>(null)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Carrega lista de alunos para o matching
  // Otimização: carrega sem expand desnecessário de relacionamentos (plan_id, etc.) para acelerar o payload
  const loadStudents = async (showLoadingState = true) => {
    if (showLoadingState) setLoadingStudents(true)
    try {
      const data = await academyService.getStudents({ expand: '' })
      setStudents(data)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar alunos',
        description: err?.message || 'Não foi possível carregar a lista de alunos.',
        variant: 'destructive',
      })
    } finally {
      if (showLoadingState) setLoadingStudents(false)
    }
  }

  useEffect(() => {
    loadStudents()
  }, [])

  // Processa arquivos selecionados (ZIP ou imagens soltas)
  const handleFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return

    setIsProcessingFiles(true)
    setReport(null)

    try {
      const filesArray = Array.from(files)
      const allExtractedFiles: File[] = []

      for (const f of filesArray) {
        const lowerName = f.name.toLowerCase()
        if (
          lowerName.endsWith('.zip') ||
          f.type === 'application/zip' ||
          f.type === 'application/x-zip-compressed'
        ) {
          // Descompacta ZIP
          toast({
            title: 'Descompactando arquivo ZIP...',
            description: `Extraindo imagens de ${f.name}`,
          })
          const extracted = await extractPhotosFromZip(f)
          allExtractedFiles.push(...extracted)
        } else if (/\.(jpe?g|png|webp|gif)$/i.test(lowerName) || f.type.startsWith('image/')) {
          allExtractedFiles.push(f)
        }
      }

      if (allExtractedFiles.length === 0) {
        toast({
          title: 'Nenhuma imagem encontrada',
          description:
            'Selecione imagens (.jpg, .jpeg, .png, .webp) ou um arquivo .ZIP contendo fotos.',
          variant: 'destructive',
        })
        setIsProcessingFiles(false)
        return
      }

      const newItems = buildPhotoItemsList(allExtractedFiles, students)
      setItems((prev) => [...prev, ...newItems])

      const matchedCount = newItems.filter((i) => i.status === 'matched').length
      toast({
        title: 'Fotos carregadas para análise!',
        description: `${allExtractedFiles.length} foto(s) lida(s). ${matchedCount} correspondência(s) automática(s) encontrada(s).`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao processar arquivos',
        description: err?.message || 'Falha ao descompactar ou ler as imagens.',
        variant: 'destructive',
      })
    } finally {
      setIsProcessingFiles(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  // Remove um item da lista antes de confirmar
  const handleRemoveItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id)
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl)
      }
      return prev.filter((i) => i.id !== id)
    })
  }

  // Permite ao usuário vincular manualmente um aluno a uma foto sem match ou ambígua
  const handleManualAssignStudent = (itemId: string, studentId: string) => {
    const student = students.find((s) => s.id === studentId)
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item
        if (!student || studentId === 'none') {
          return {
            ...item,
            status: 'unmatched',
            matchedStudent: undefined,
            confirmedByUser: false,
            manualOverride: false,
          }
        }
        return {
          ...item,
          status: 'matched',
          matchedStudent: student,
          confirmedByUser: true, // atribuição manual do usuário é considerada aprovada
          manualOverride: true,
        }
      }),
    )
  }

  // Abre modal de confirmação lado a lado
  const handleOpenConfirmModal = (item: PhotoFileItem) => {
    setConfirmingItem(item)
    setSelectedCandidateId(item.matchedStudent?.id || item.candidates?.[0]?.id || '')
  }

  // Aprova o vínculo incerto no modal ou inline
  const handleConfirmCandidate = (itemId: string, candidateStudentId?: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item
        const sId = candidateStudentId || selectedCandidateId || item.matchedStudent?.id
        const chosenStudent = students.find((s) => s.id === sId) || item.matchedStudent
        if (!chosenStudent) return item
        return {
          ...item,
          status: 'matched',
          matchedStudent: chosenStudent,
          confirmedByUser: true,
        }
      }),
    )
    setConfirmingItem(null)
    toast({
      title: 'Vínculo confirmado!',
      description: 'A foto foi aprovada e será enviada no lote.',
    })
  }

  // Rejeita o candidato sugerido (marca como não encontrado para evitar anexar errado)
  const handleRejectCandidate = (itemId: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item
        return {
          ...item,
          status: 'unmatched',
          matchedStudent: undefined,
          confirmedByUser: false,
        }
      }),
    )
    setConfirmingItem(null)
    toast({
      title: 'Sugestão rejeitada',
      description:
        'O vínculo automático foi descartado. Você pode selecionar outro aluno manualmente.',
    })
  }

  // Aprovar todas as pendentes de uma vez (opção de conveniência com aviso)
  const handleConfirmAllPending = () => {
    const pendingCount = items.filter(
      (i) => i.status === 'needs_confirmation' && i.matchedStudent && !i.confirmedByUser,
    ).length
    if (pendingCount === 0) return

    setItems((prev) =>
      prev.map((item) => {
        if (item.status === 'needs_confirmation' && item.matchedStudent && !item.confirmedByUser) {
          return {
            ...item,
            status: 'matched',
            confirmedByUser: true,
          }
        }
        return item
      }),
    )

    toast({
      title: 'Vínculos aprovados',
      description: `${pendingCount} foto(s) com correspondência aproximada foram aprovadas para envio.`,
    })
  }

  // Desfaz todos os arquivos
  const handleReset = () => {
    items.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
    })
    setItems([])
    setReport(null)
    setProgressPercent(0)
    setProgressStatus('')
  }

  // Inicia o upload real para o PocketBase
  const handleStartUpload = async () => {
    // Apenas fotos com aluno vinculado que estejam seguras (matched) ou aprovadas explicitamente
    const approvedToUpload = items.filter(
      (i) =>
        i.matchedStudent &&
        i.status !== 'ignored_inactive' &&
        (i.confirmedByUser || i.status === 'matched'),
    )

    if (approvedToUpload.length === 0) {
      toast({
        title: 'Nenhuma foto aprovada para upload',
        description: 'Confirme os vínculos pendentes ou selecione um aluno para ao menos uma foto.',
        variant: 'destructive',
      })
      return
    }

    const pendingConfirmationCount = items.filter(
      (i) => (i.status === 'needs_confirmation' || i.status === 'ambiguous') && !i.confirmedByUser,
    ).length

    if (pendingConfirmationCount > 0) {
      const confirmProceed = window.confirm(
        `Existem ${pendingConfirmationCount} foto(s) incertas aguardando sua confirmação. Elas NÃO serão anexadas. Deseja continuar o upload das ${approvedToUpload.length} foto(s) aprovadas?`,
      )
      if (!confirmProceed) return
    }

    setIsUploading(true)
    setProgressPercent(0)
    setProgressStatus('Iniciando envio das fotos...')
    setReport(null)

    try {
      const rep = await uploadMatchedPhotos(items, (current, total, currentItem) => {
        const pct = Math.round((current / total) * 100)
        setProgressPercent(pct)
        setProgressStatus(
          `Enviando (${current}/${total}): ${currentItem.matchedStudent?.name || currentItem.name}`,
        )
      })

      setReport(rep)
      toast({
        title: 'Upload em lote concluído!',
        description: `${rep.successCount} foto(s) vinculada(s) com sucesso. ${rep.errorCount} erro(s).`,
      })

      // Recarregamento em background sem travar a interface do usuário
      loadStudents(false).catch(() => {})
    } catch (err: any) {
      toast({
        title: 'Falha durante o upload',
        description: err?.message || 'Ocorreu um erro ao enviar as fotos.',
        variant: 'destructive',
      })
    } finally {
      setIsUploading(false)
    }
  }

  // Contadores refinados
  const readyToUploadCount = items.filter(
    (i) =>
      i.matchedStudent &&
      i.status !== 'ignored_inactive' &&
      (i.confirmedByUser || i.status === 'matched'),
  ).length
  const needsConfirmationCount = items.filter(
    (i) => i.status === 'needs_confirmation' && !i.confirmedByUser,
  ).length
  const ambiguousCount = items.filter((i) => i.status === 'ambiguous' && !i.confirmedByUser).length
  const ignoredInactiveCount = items.filter((i) => i.status === 'ignored_inactive').length
  const unmatchedCount = items.filter((i) => i.status === 'unmatched' && !i.matchedStudent).length

  // Filtragem na tabela
  const filteredItems = items.filter((item) => {
    if (filterTab === 'needs_confirmation') {
      if (item.status !== 'needs_confirmation' && item.status !== 'ambiguous') return false
      if (item.confirmedByUser) return false
    } else if (filterTab === 'matched') {
      if (!item.matchedStudent) return false
      if (item.status === 'ignored_inactive') return false
      if (!item.confirmedByUser && item.status !== 'matched') return false
    } else if (filterTab === 'unmatched') {
      if (item.status !== 'unmatched') return false
    } else if (filterTab === 'ignored') {
      if (item.status !== 'ignored_inactive') return false
    }

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase()
      const matchName = item.name.toLowerCase().includes(q)
      const studentMatch = item.matchedStudent?.name.toLowerCase().includes(q)
      return matchName || studentMatch
    }
    return true
  })

  return (
    <div className="space-y-6">
      {/* Top Banner Informativo */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-[#0F1B3D] text-[#D4AF37] shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-[#0F1B3D] text-sm md:text-base">
              Vincular Fotos Reais aos Alunos (Independência do Bubble)
            </h3>
            <p className="text-xs text-slate-600 mt-0.5 max-w-2xl">
              Suba as fotos baixadas do Google Drive (arquivo <strong>.ZIP</strong> ou seleção
              múltipla de imagens). O sistema casa automaticamente pelo nome do arquivo (ex.:{' '}
              <code className="bg-white/80 px-1 py-0.5 rounded text-slate-800 font-mono">
                João Silva.jpg
              </code>{' '}
              com o aluno <strong>João Silva</strong>) e armazena diretamente no PocketBase.
            </p>
          </div>
        </div>

        {items.length > 0 && !isUploading && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="border-slate-300 text-slate-700 hover:bg-white shrink-0"
          >
            <RotateCcw className="w-4 h-4 mr-1.5 text-slate-500" /> Limpar Lista
          </Button>
        )}
      </div>

      {/* Dropzone de Upload */}
      {items.length === 0 && (
        <Card className="border-2 border-dashed border-slate-300 hover:border-[#17A2B8] transition-colors shadow-sm bg-white">
          <CardContent
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`p-8 md:p-14 text-center cursor-pointer flex flex-col items-center justify-center transition-all ${
              isDragging ? 'bg-[#17A2B8]/5 border-[#17A2B8]' : ''
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept=".zip,application/zip,application/x-zip-compressed,image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFiles(e.target.files)
                }
              }}
            />

            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#0F1B3D] to-[#17A2B8] flex items-center justify-center mb-4 text-[#D4AF37] shadow-lg">
              <Upload className="w-8 h-8" />
            </div>

            <h3 className="text-lg md:text-xl font-bold text-[#0F1B3D]">
              Arraste seu arquivo .ZIP ou fotos soltas aqui
            </h3>
            <p className="text-xs md:text-sm text-slate-500 max-w-md mt-1.5 mb-6">
              Suporta descompactação automática no navegador de arquivos ZIP e seleção de múltiplas
              imagens (.jpg, .jpeg, .png, .webp).
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                type="button"
                className="bg-[#0F1B3D] hover:bg-[#1B2A5B] text-white font-medium px-5 shadow-md text-xs md:text-sm"
              >
                <FileArchive className="w-4 h-4 mr-2 text-[#D4AF37]" />
                Selecionar ZIP ou Fotos
              </Button>
            </div>

            <p className="text-[11px] text-slate-400 mt-4">
              {loadingStudents
                ? 'Carregando lista de alunos...'
                : `${students.length} alunos cadastrados no sistema disponíveis para matching.`}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Lista com Itens Detectados e Preview */}
      {items.length > 0 && (
        <div className="space-y-6">
          {/* Header de Resumo e Ação de Upload */}
          <div className="bg-white rounded-xl p-4 md:p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="bg-[#0F1B3D] text-white py-1 px-3 text-xs">
                {items.length} fotos carregadas
              </Badge>
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 py-1 px-3 text-xs flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5" />
                {readyToUploadCount} prontas para envio
              </Badge>
              {needsConfirmationCount > 0 && (
                <Badge className="bg-amber-100 text-amber-900 border-amber-300 py-1 px-3 text-xs flex items-center gap-1 font-semibold animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                  {needsConfirmationCount} pendentes de confirmação
                </Badge>
              )}
              {ambiguousCount > 0 && (
                <Badge className="bg-purple-100 text-purple-800 border-purple-300 py-1 px-3 text-xs flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {ambiguousCount} ambíguas
                </Badge>
              )}
              {ignoredInactiveCount > 0 && (
                <Badge className="bg-slate-100 text-slate-700 border-slate-300 py-1 px-3 text-xs flex items-center gap-1">
                  <UserX className="w-3.5 h-3.5 text-slate-500" />
                  {ignoredInactiveCount} inativos ignorados
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto">
              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept=".zip,application/zip,application/x-zip-compressed,image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFiles(e.target.files)
                  }
                }}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={isUploading || isProcessingFiles}
                onClick={() => fileInputRef.current?.click()}
                className="text-xs"
              >
                + Adicionar mais
              </Button>

              <Button
                onClick={handleStartUpload}
                disabled={isUploading || readyToUploadCount === 0 || isProcessingFiles}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md px-6 flex-1 md:flex-none text-xs md:text-sm"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Enviando Fotos...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Enviar Fotos Aprovadas ({readyToUploadCount})
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Barra de Progresso durante upload */}
          {isUploading && (
            <Card className="border-[#17A2B8]/40 bg-white shadow-md animate-fade-in">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold text-[#0F1B3D] flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-[#17A2B8] animate-spin" />
                    Progresso do Upload em Lote
                  </CardTitle>
                  <span className="font-mono text-sm font-bold text-[#17A2B8]">
                    {progressPercent}%
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <Progress value={progressPercent} className="h-2.5 bg-slate-100" />
                <p className="text-xs text-slate-500 truncate">{progressStatus}</p>
              </CardContent>
            </Card>
          )}

          {/* Relatório Final pós-upload */}
          {report && (
            <Card className="border-emerald-200 bg-emerald-50/40 shadow-sm animate-fade-in">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-emerald-950 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Relatório do Upload de Fotos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="p-3 bg-white rounded-lg border border-emerald-200">
                    <span className="text-slate-500 block">Total de Fotos</span>
                    <strong className="text-base text-slate-800">{report.totalFiles}</strong>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-emerald-200">
                    <span className="text-emerald-700 block">Anexadas c/ Sucesso</span>
                    <strong className="text-base text-emerald-700 font-bold">
                      {report.successCount}
                    </strong>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-600 block">Inativos Ignorados</span>
                    <strong className="text-base text-slate-700 font-bold">
                      {report.ignoredInactiveCount}
                    </strong>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-amber-200">
                    <span className="text-amber-700 block">Não Encontradas</span>
                    <strong className="text-base text-amber-700 font-bold">
                      {report.unmatchedFiles.length}
                    </strong>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-red-200">
                    <span className="text-red-700 block">Erros no Envio</span>
                    <strong className="text-base text-red-700 font-bold">
                      {report.errorCount}
                    </strong>
                  </div>
                </div>

                {report.ignoredInactiveFiles && report.ignoredInactiveFiles.length > 0 && (
                  <div className="p-3 bg-white rounded-lg border border-slate-200">
                    <p className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                      <UserX className="w-4 h-4 text-slate-500" />
                      Fotos de alunos inativos puladas com sucesso (
                      {report.ignoredInactiveFiles.length}):
                    </p>
                    <p className="text-slate-500 text-[11px] leading-relaxed break-words">
                      Esses alunos estão trancados, com atestado ou inativos na base. As fotos foram
                      ignoradas sem serem contadas como erro ou pendência:
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {report.ignoredInactiveFiles.map((item, idx) => (
                        <span
                          key={idx}
                          className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] border border-slate-200"
                        >
                          {item.filename} {item.studentName ? `(${item.studentName})` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {report.unmatchedFiles.length > 0 && (
                  <div className="p-3 bg-white rounded-lg border border-amber-200">
                    <p className="font-bold text-amber-900 mb-1">
                      Arquivos que não corresponderam a nenhum aluno ativo (
                      {report.unmatchedFiles.length}
                      ):
                    </p>
                    <p className="text-slate-600 text-[11px] leading-relaxed break-words">
                      {report.unmatchedFiles.join(', ')}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Dica: Você pode vincular manualmente cada arquivo na lista abaixo usando o
                      seletor de aluno.
                    </p>
                  </div>
                )}

                {report.errors.length > 0 && (
                  <div className="p-3 bg-white rounded-lg border border-red-200">
                    <p className="font-bold text-red-900 mb-1">Erros encontrados:</p>
                    <ul className="list-disc list-inside text-red-700 space-y-0.5">
                      {report.errors.map((err, i) => (
                        <li key={i}>
                          <strong>{err.filename}:</strong> {err.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Filtros e Tabela de Pré-visualização */}
          <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
            <CardHeader className="p-4 md:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={filterTab === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterTab('all')}
                  className={filterTab === 'all' ? 'bg-[#0F1B3D] text-white text-xs' : 'text-xs'}
                >
                  Todas ({items.length})
                </Button>
                {needsConfirmationCount > 0 && (
                  <Button
                    variant={filterTab === 'needs_confirmation' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterTab('needs_confirmation')}
                    className={
                      filterTab === 'needs_confirmation'
                        ? 'bg-amber-600 text-white text-xs font-bold'
                        : 'text-xs text-amber-800 border-amber-300 bg-amber-50 hover:bg-amber-100 font-semibold'
                    }
                  >
                    ⚠️ Pendentes ({needsConfirmationCount})
                  </Button>
                )}
                <Button
                  variant={filterTab === 'matched' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterTab('matched')}
                  className={
                    filterTab === 'matched'
                      ? 'bg-emerald-600 text-white text-xs'
                      : 'text-xs text-emerald-700 border-emerald-200'
                  }
                >
                  Aprovadas ({readyToUploadCount})
                </Button>
                <Button
                  variant={filterTab === 'unmatched' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterTab('unmatched')}
                  className={
                    filterTab === 'unmatched'
                      ? 'bg-slate-700 text-white text-xs'
                      : 'text-xs text-slate-700 border-slate-200'
                  }
                >
                  Sem Aluno ({unmatchedCount})
                </Button>
                {ignoredInactiveCount > 0 && (
                  <Button
                    variant={filterTab === 'ignored' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterTab('ignored')}
                    className={
                      filterTab === 'ignored'
                        ? 'bg-slate-600 text-white text-xs'
                        : 'text-xs text-slate-500 border-slate-200'
                    }
                  >
                    Inativos Ignorados ({ignoredInactiveCount})
                  </Button>
                )}

                {needsConfirmationCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleConfirmAllPending}
                    className="text-xs text-amber-800 hover:text-amber-900 hover:bg-amber-100/60 font-semibold ml-auto"
                    title="Aprova todas as sugestões aproximadas de uma vez"
                  >
                    Aprovar Todas as Pendentes ({needsConfirmationCount})
                  </Button>
                )}
              </div>

              <div className="relative w-full md:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <Input
                  placeholder="Buscar arquivo ou aluno..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-8 text-xs h-8"
                />
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[500px]">
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0 z-10 text-xs">
                    <TableRow>
                      <TableHead className="w-16 text-center text-xs">Foto Nova</TableHead>
                      <TableHead className="text-xs font-bold">Arquivo</TableHead>
                      <TableHead className="text-xs font-bold">
                        Aluno Sugerido / Selecionado
                      </TableHead>
                      <TableHead className="text-xs font-bold">Foto Atual na Base</TableHead>
                      <TableHead className="text-xs font-bold">Status do Vínculo</TableHead>
                      <TableHead className="text-center text-xs font-bold w-40">
                        Confirmação / Ação
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-slate-400 text-xs">
                          Nenhuma foto encontrada para a aba ou busca selecionada.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredItems.map((item) => {
                        const currentPhotoUrl = getStudentPhotoUrl(item.matchedStudent)
                        const isPendingConfirmation =
                          (item.status === 'needs_confirmation' || item.status === 'ambiguous') &&
                          !item.confirmedByUser
                        const isInactive = item.status === 'ignored_inactive'

                        return (
                          <TableRow
                            key={item.id}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              isPendingConfirmation
                                ? 'bg-amber-50/40 border-l-4 border-l-amber-500'
                                : isInactive
                                  ? 'bg-slate-50/50 opacity-75'
                                  : ''
                            }`}
                          >
                            {/* Preview da foto nova */}
                            <TableCell className="text-center py-2.5">
                              <div className="w-11 h-11 rounded-lg overflow-hidden border border-slate-300 bg-slate-100 flex items-center justify-center mx-auto shadow-2xs">
                                <img
                                  src={item.previewUrl}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            </TableCell>

                            {/* Nome do arquivo */}
                            <TableCell className="text-xs font-mono text-slate-700">
                              <span
                                className="font-semibold block truncate max-w-[190px]"
                                title={item.name}
                              >
                                {item.name}
                              </span>
                              <span className="block text-[10px] text-slate-400">
                                {(item.size / 1024).toFixed(1)} KB
                              </span>
                            </TableCell>

                            {/* Aluno vinculado / Seletor manual */}
                            <TableCell className="text-xs">
                              <div className="max-w-xs space-y-1">
                                {isInactive ? (
                                  <div>
                                    <span className="font-semibold text-slate-700">
                                      {item.matchedStudent?.name || 'Aluno Inativo'}
                                    </span>
                                    <span className="block text-[10px] text-slate-400">
                                      Situação:{' '}
                                      {item.matchedStudent?.raw_situation ||
                                        item.matchedStudent?.situation ||
                                        'Inativo'}
                                    </span>
                                  </div>
                                ) : (
                                  <Select
                                    value={item.matchedStudent?.id || 'none'}
                                    onValueChange={(val) => handleManualAssignStudent(item.id, val)}
                                    disabled={isUploading}
                                  >
                                    <SelectTrigger className="h-8 text-xs focus:ring-[#D4AF37]">
                                      <SelectValue placeholder="Selecione um aluno..." />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-60">
                                      <SelectItem
                                        value="none"
                                        className="text-slate-400 italic text-xs"
                                      >
                                        — Nenhum aluno vinculado —
                                      </SelectItem>
                                      {students.map((st) => (
                                        <SelectItem key={st.id} value={st.id} className="text-xs">
                                          {st.name} {st.cpf ? `(${st.cpf})` : ''}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}

                                {item.candidateNames &&
                                  item.candidateNames.length > 0 &&
                                  !item.matchedStudent && (
                                    <p className="text-[10px] text-purple-700">
                                      Candidatos: {item.candidateNames.join(', ')}
                                    </p>
                                  )}
                              </div>
                            </TableCell>

                            {/* Foto atual na base */}
                            <TableCell className="text-xs">
                              {item.matchedStudent ? (
                                <div className="flex items-center gap-2">
                                  <Avatar className="w-8 h-8 border border-slate-200">
                                    {currentPhotoUrl ? (
                                      <AvatarImage
                                        src={currentPhotoUrl}
                                        alt={item.matchedStudent.name}
                                      />
                                    ) : null}
                                    <AvatarFallback className="text-[10px] bg-[#0F1B3D] text-white">
                                      {item.matchedStudent.name.slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-[11px] text-slate-500 truncate max-w-[95px]">
                                    {item.matchedStudent.photo_file ? (
                                      <span className="text-emerald-700 font-medium">
                                        PocketBase
                                      </span>
                                    ) : item.matchedStudent.photo ? (
                                      <span className="text-amber-700 font-medium">
                                        Link Bubble
                                      </span>
                                    ) : (
                                      'Sem foto'
                                    )}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[11px]">—</span>
                              )}
                            </TableCell>

                            {/* Status do Match */}
                            <TableCell className="text-xs">
                              {item.uploadStatus === 'success' ? (
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] flex items-center gap-1 w-fit">
                                  <Check className="w-3 h-3" /> Enviada com Sucesso
                                </Badge>
                              ) : item.uploadStatus === 'error' ? (
                                <Badge
                                  className="bg-red-100 text-red-800 border-red-300 text-[10px] flex items-center gap-1 w-fit"
                                  title={item.errorMessage}
                                >
                                  <AlertCircle className="w-3 h-3" /> Erro no Envio
                                </Badge>
                              ) : item.uploadStatus === 'uploading' ? (
                                <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-[10px] flex items-center gap-1 w-fit">
                                  <RefreshCw className="w-3 h-3 animate-spin" /> Enviando...
                                </Badge>
                              ) : isInactive ? (
                                <Badge className="bg-slate-100 text-slate-600 border-slate-300 text-[10px] flex items-center gap-1 w-fit">
                                  <UserX className="w-3 h-3" /> Aluno inativo (ignorado)
                                </Badge>
                              ) : isPendingConfirmation ? (
                                <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] flex items-center gap-1 w-fit font-bold">
                                  <AlertTriangle className="w-3 h-3 text-amber-700" />
                                  Confirmar vínculo
                                </Badge>
                              ) : item.matchedStudent &&
                                (item.confirmedByUser || item.status === 'matched') ? (
                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] flex items-center gap-1 w-fit">
                                  <CheckCircle2 className="w-3 h-3" />
                                  {item.manualOverride
                                    ? 'Vinculado manualmente'
                                    : item.status === 'matched' && !item.confirmedByUser
                                      ? 'Casado exatamente'
                                      : 'Confirmado por você'}
                                </Badge>
                              ) : (
                                <Badge className="bg-slate-100 text-slate-500 border-slate-200 text-[10px] flex items-center gap-1 w-fit">
                                  <AlertCircle className="w-3 h-3" /> Não encontrado
                                </Badge>
                              )}
                            </TableCell>

                            {/* Confirmação / Ação */}
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {isPendingConfirmation && item.matchedStudent ? (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleOpenConfirmModal(item)}
                                      className="h-7 px-2 text-[11px] border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 font-semibold flex items-center gap-1"
                                      title="Revisar e aprovar imagem"
                                    >
                                      Revisar
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        handleConfirmCandidate(item.id, item.matchedStudent?.id)
                                      }
                                      className="h-7 w-7 p-0 bg-emerald-600 hover:bg-emerald-700 text-white"
                                      title="Aprovar vínculo"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleRejectCandidate(item.id)}
                                      className="h-7 w-7 p-0 text-slate-400 hover:text-amber-700 hover:bg-amber-50"
                                      title="Rejeitar sugestão"
                                    >
                                      ✕
                                    </Button>
                                  </>
                                ) : isPendingConfirmation &&
                                  item.candidates &&
                                  item.candidates.length > 0 ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenConfirmModal(item)}
                                    className="h-7 px-2 text-[11px] border-purple-300 text-purple-900 bg-purple-50 hover:bg-purple-100 font-semibold"
                                  >
                                    Escolher aluno ({item.candidates.length})
                                  </Button>
                                ) : null}

                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(item.id)}
                                  disabled={isUploading}
                                  className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                                  title="Excluir / remover da lista"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {/* Modal de Confirmação Lado a Lado (Foto Nova vs Aluno / Foto Atual) */}
      {confirmingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-[#0F1B3D] to-[#17A2B8] text-white p-5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#D4AF37]" />
                <h3 className="font-bold text-base md:text-lg">Confirmar Vínculo da Imagem</h3>
              </div>
              <p className="text-xs text-slate-200 mt-1">
                A correspondência não foi exata. Revise a foto enviada e o cadastro do aluno antes
                de anexar.
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* Informação do Arquivo */}
              <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 p-3 rounded-lg">
                <span className="font-semibold text-slate-800">Arquivo enviado: </span>
                <code className="text-[#0F1B3D] font-mono font-bold">{confirmingItem.name}</code>
                {confirmingItem.reason && (
                  <span className="block text-[11px] text-amber-700 mt-0.5">
                    Motivo: {confirmingItem.reason}
                  </span>
                )}
              </div>

              {/* Comparativo Lado a Lado */}
              <div className="grid grid-cols-2 gap-4">
                {/* Lado Esquerdo: Nova Foto Enviada */}
                <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 flex flex-col items-center text-center">
                  <span className="text-xs font-bold text-[#0F1B3D] mb-2">Foto Nova (Arquivo)</span>
                  <div className="w-32 h-32 md:w-36 md:h-36 rounded-xl overflow-hidden border-2 border-emerald-500/60 shadow-md bg-white flex items-center justify-center">
                    <img
                      src={confirmingItem.previewUrl}
                      alt={confirmingItem.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-2 truncate max-w-full font-mono">
                    {confirmingItem.name}
                  </span>
                </div>

                {/* Lado Direito: Aluno Selecionado & Foto Atual */}
                {(() => {
                  const candidateStudent =
                    students.find((s) => s.id === selectedCandidateId) ||
                    confirmingItem.matchedStudent
                  const currentPhoto = getStudentPhotoUrl(candidateStudent)

                  return (
                    <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 flex flex-col items-center text-center">
                      <span className="text-xs font-bold text-[#0F1B3D] mb-2">
                        Aluno / Foto Atual
                      </span>
                      <div className="w-32 h-32 md:w-36 md:h-36 rounded-xl overflow-hidden border-2 border-slate-300 shadow-md bg-white flex items-center justify-center">
                        {currentPhoto ? (
                          <img
                            src={currentPhoto}
                            alt={candidateStudent?.name || 'Atual'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-300 p-2">
                            <ImageIcon className="w-10 h-10 mb-1" />
                            <span className="text-[10px]">Sem foto cadastrada</span>
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] font-bold text-slate-800 mt-2 truncate max-w-full">
                        {candidateStudent?.name || 'Selecione um aluno'}
                      </span>
                    </div>
                  )
                })()}
              </div>

              {/* Seletor do Aluno Candidato */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Vincular esta foto a qual aluno?
                </label>
                <Select
                  value={selectedCandidateId}
                  onValueChange={(val) => setSelectedCandidateId(val)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecione o aluno correto..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {/* Prioriza candidatos sugeridos no topo */}
                    {confirmingItem.candidates &&
                      confirmingItem.candidates.length > 0 &&
                      confirmingItem.candidates.map((c) => (
                        <SelectItem
                          key={`cand_${c.id}`}
                          value={c.id}
                          className="text-xs font-semibold text-emerald-900 bg-emerald-50/50"
                        >
                          ⭐ Sugestão: {c.name} {c.cpf ? `(${c.cpf})` : ''}
                        </SelectItem>
                      ))}
                    {students.map((st) => (
                      <SelectItem key={st.id} value={st.id} className="text-xs">
                        {st.name} {st.cpf ? `(${st.cpf})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Ações do Modal */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRejectCandidate(confirmingItem.id)}
                className="text-xs border-slate-300 text-slate-700"
              >
                Rejeitar Vínculo
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmingItem(null)}
                  className="text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleConfirmCandidate(confirmingItem.id, selectedCandidateId)}
                  disabled={!selectedCandidateId}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 shadow-sm"
                >
                  <Check className="w-4 h-4 mr-1.5" />
                  Aprovar e Vincular
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
