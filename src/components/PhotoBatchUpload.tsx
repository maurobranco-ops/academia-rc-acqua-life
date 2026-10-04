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
  const [filterTab, setFilterTab] = useState<'all' | 'matched' | 'unmatched'>('all')
  const [searchFilter, setSearchFilter] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Carrega lista de alunos para o matching
  const loadStudents = async () => {
    setLoadingStudents(true)
    try {
      const data = await academyService.getStudents()
      setStudents(data)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar alunos',
        description: err?.message || 'Não foi possível carregar a lista de alunos.',
        variant: 'destructive',
      })
    } finally {
      setLoadingStudents(false)
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
        if (!student) {
          return {
            ...item,
            status: 'unmatched',
            matchedStudent: undefined,
          }
        }
        return {
          ...item,
          status: 'matched',
          matchedStudent: student,
        }
      }),
    )
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
    const matchedCount = items.filter((i) => i.status === 'matched' && i.matchedStudent).length
    if (matchedCount === 0) {
      toast({
        title: 'Nenhuma foto vinculada',
        description: 'Vincule ao menos uma foto a um aluno para fazer o upload.',
        variant: 'destructive',
      })
      return
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

      // Recarrega alunos para atualizar fotos na base
      await loadStudents()
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

  // Contadores
  const matchedCount = items.filter((i) => i.status === 'matched' && i.matchedStudent).length
  const unmatchedCount = items.filter((i) => i.status === 'unmatched' || !i.matchedStudent).length
  const ambiguousCount = items.filter((i) => i.status === 'ambiguous' && !i.matchedStudent).length

  // Filtragem na tabela
  const filteredItems = items.filter((item) => {
    if (filterTab === 'matched' && (item.status !== 'matched' || !item.matchedStudent)) return false
    if (filterTab === 'unmatched' && item.status === 'matched' && item.matchedStudent) return false

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
                {matchedCount} vinculadas
              </Badge>
              {unmatchedCount > 0 && (
                <Badge className="bg-amber-100 text-amber-800 border-amber-300 py-1 px-3 text-xs flex items-center gap-1">
                  <UserX className="w-3.5 h-3.5" />
                  {unmatchedCount} sem correspondência
                </Badge>
              )}
              {ambiguousCount > 0 && (
                <Badge className="bg-purple-100 text-purple-800 border-purple-300 py-1 px-3 text-xs flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {ambiguousCount} ambíguas
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
                disabled={isUploading || matchedCount === 0 || isProcessingFiles}
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
                    Confirmar e Fazer Upload ({matchedCount})
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-white rounded-lg border border-emerald-200">
                    <span className="text-slate-500 block">Total de Fotos</span>
                    <strong className="text-base text-slate-800">{report.totalFiles}</strong>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-emerald-200">
                    <span className="text-emerald-700 block">Vinculadas com Sucesso</span>
                    <strong className="text-base text-emerald-700 font-bold">
                      {report.successCount}
                    </strong>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-emerald-200">
                    <span className="text-amber-700 block">Não Encontradas / Ignoradas</span>
                    <strong className="text-base text-amber-700 font-bold">
                      {report.unmatchedFiles.length}
                    </strong>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-emerald-200">
                    <span className="text-red-700 block">Erros de Envio</span>
                    <strong className="text-base text-red-700 font-bold">
                      {report.errorCount}
                    </strong>
                  </div>
                </div>

                {report.unmatchedFiles.length > 0 && (
                  <div className="p-3 bg-white rounded-lg border border-amber-200">
                    <p className="font-bold text-amber-900 mb-1">
                      Arquivos que não corresponderam a nenhum aluno ({report.unmatchedFiles.length}
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
              <div className="flex items-center gap-2">
                <Button
                  variant={filterTab === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterTab('all')}
                  className={filterTab === 'all' ? 'bg-[#0F1B3D] text-white text-xs' : 'text-xs'}
                >
                  Todas ({items.length})
                </Button>
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
                  Casadas ({matchedCount})
                </Button>
                <Button
                  variant={filterTab === 'unmatched' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterTab('unmatched')}
                  className={
                    filterTab === 'unmatched'
                      ? 'bg-amber-600 text-white text-xs'
                      : 'text-xs text-amber-700 border-amber-200'
                  }
                >
                  Sem Aluno ({unmatchedCount})
                </Button>
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
                  <TableHeader className="bg-slate-50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-16 text-center text-xs">Foto</TableHead>
                      <TableHead className="text-xs font-bold">Arquivo</TableHead>
                      <TableHead className="text-xs font-bold">Aluno Correspondente</TableHead>
                      <TableHead className="text-xs font-bold">Status do Match</TableHead>
                      <TableHead className="text-xs font-bold">Foto Atual</TableHead>
                      <TableHead className="w-12 text-center text-xs">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-slate-400 text-xs">
                          Nenhuma foto encontrada para os filtros selecionados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredItems.map((item) => {
                        const currentPhotoUrl = getStudentPhotoUrl(item.matchedStudent)

                        return (
                          <TableRow key={item.id} className="hover:bg-slate-50/80">
                            {/* Preview da foto nova */}
                            <TableCell className="text-center py-2">
                              <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center mx-auto">
                                <img
                                  src={item.previewUrl}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            </TableCell>

                            {/* Nome do arquivo */}
                            <TableCell className="text-xs font-mono text-slate-700">
                              <span className="font-semibold">{item.name}</span>
                              <span className="block text-[10px] text-slate-400">
                                {(item.size / 1024).toFixed(1)} KB
                              </span>
                            </TableCell>

                            {/* Aluno vinculado / Seletor manual */}
                            <TableCell className="text-xs">
                              <div className="max-w-xs">
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

                                {item.candidateNames &&
                                  item.candidateNames.length > 0 &&
                                  !item.matchedStudent && (
                                    <p className="text-[10px] text-purple-700 mt-1">
                                      Candidatos possíveis: {item.candidateNames.join(', ')}
                                    </p>
                                  )}
                              </div>
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
                              ) : item.matchedStudent ? (
                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] flex items-center gap-1 w-fit">
                                  <CheckCircle2 className="w-3 h-3" />
                                  {item.status === 'matched'
                                    ? 'Casado automaticamente'
                                    : 'Vinculado manualmente'}
                                </Badge>
                              ) : item.status === 'ambiguous' ? (
                                <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] flex items-center gap-1 w-fit">
                                  <AlertTriangle className="w-3 h-3" /> Ambíguo (revisar)
                                </Badge>
                              ) : (
                                <Badge className="bg-slate-100 text-slate-500 border-slate-200 text-[10px] flex items-center gap-1 w-fit">
                                  <AlertCircle className="w-3 h-3" /> Não encontrado
                                </Badge>
                              )}
                            </TableCell>

                            {/* Foto atual na base */}
                            <TableCell className="text-xs">
                              {item.matchedStudent ? (
                                <div className="flex items-center gap-2">
                                  <Avatar className="w-7 h-7 border border-slate-200">
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
                                  <span className="text-[11px] text-slate-500 truncate max-w-[100px]">
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

                            {/* Remover item */}
                            <TableCell className="text-center">
                              <button
                                onClick={() => handleRemoveItem(item.id)}
                                disabled={isUploading}
                                className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                                title="Remover da lista"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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
    </div>
  )
}
