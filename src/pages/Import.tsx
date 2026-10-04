import React, { useState, useRef } from 'react'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Users,
  GraduationCap,
  CalendarDays,
  CreditCard,
  ArrowRight,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
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
import { toast } from '@/hooks/use-toast'
import { parseCSV } from '@/lib/csvParser'
import {
  importBubbleStudents,
  DEFAULT_COLUMN_MAPPING,
  type ColumnMapping,
  type ImportResult,
} from '@/lib/bubbleImporter'

export default function Import() {
  const [file, setFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>(DEFAULT_COLUMN_MAPPING)
  const [showMappingConfig, setShowMappingConfig] = useState(false)

  // Import State
  const [isImporting, setIsImporting] = useState(false)
  const [progressPercent, setProgressPercent] = useState(0)
  const [progressStatus, setProgressStatus] = useState<string>('')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Drag and drop states
  const [isDragging, setIsDragging] = useState(false)

  const handleFile = (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv') && selectedFile.type !== 'text/csv') {
      toast({
        title: 'Arquivo inválido',
        description: 'Por favor, selecione um arquivo no formato .csv',
        variant: 'destructive',
      })
      return
    }

    setFile(selectedFile)
    setFileName(selectedFile.name)
    setImportResult(null)
    setProgressPercent(0)
    setProgressStatus('')

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const { headers, rows } = parseCSV(text)
        if (headers.length === 0 || rows.length === 0) {
          toast({
            title: 'CSV vazio ou inválido',
            description: 'Não foi possível encontrar cabeçalhos ou registros no arquivo.',
            variant: 'destructive',
          })
          return
        }

        setCsvHeaders(headers)
        setCsvRows(rows)

        // Try to auto-match mapping if names match closely
        const newMapping: ColumnMapping = { ...DEFAULT_COLUMN_MAPPING }
        const headerLookup = new Map<string, string>()
        headers.forEach((h) => headerLookup.set(h.toLowerCase().trim(), h))

        Object.keys(newMapping).forEach((k) => {
          const key = k as keyof ColumnMapping
          const defaultCol = DEFAULT_COLUMN_MAPPING[key]
          const match = headerLookup.get(defaultCol.toLowerCase().trim())
          if (match) {
            newMapping[key] = match
          }
        })

        setMapping(newMapping)

        toast({
          title: 'Arquivo carregado!',
          description: `${rows.length} registros detectados com sucesso.`,
        })
      } catch (err: any) {
        toast({
          title: 'Erro ao processar CSV',
          description: err?.message || 'Verifique a formatação do arquivo.',
          variant: 'destructive',
        })
      }
    }
    reader.readAsText(selectedFile, 'UTF-8')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleStartImport = async () => {
    if (csvRows.length === 0) return

    setIsImporting(true)
    setProgressPercent(0)
    setProgressStatus('Iniciando importação...')
    setImportResult(null)

    try {
      const res = await importBubbleStudents(csvRows, mapping, (current, total, currentName) => {
        const pct = Math.round((current / total) * 100)
        setProgressPercent(pct)
        if (currentName) {
          setProgressStatus(`Importando (${current}/${total}): ${currentName}`)
        } else {
          setProgressStatus(`Processando linha ${current} de ${total}...`)
        }
      })

      setImportResult(res)
      toast({
        title: 'Importação concluída!',
        description: `${res.studentsCreated} alunos criados, ${res.studentsUpdated} atualizados e ${res.classesCreated} turmas criadas.`,
      })
    } catch (err: any) {
      toast({
        title: 'Falha durante importação',
        description: err?.message || 'Ocorreu um erro ao importar os registros.',
        variant: 'destructive',
      })
    } finally {
      setIsImporting(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setFileName('')
    setCsvHeaders([])
    setCsvRows([])
    setImportResult(null)
    setProgressPercent(0)
    setProgressStatus('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // List of fields to configure mapping
  const mappingFieldsConfig: { key: keyof ColumnMapping; label: string; desc: string }[] = [
    { key: 'aluno', label: 'Nome do Aluno', desc: 'Campo principal para students.name' },
    {
      key: 'uniqueId',
      label: 'Unique ID (Bubble)',
      desc: 'Identificador único do Bubble para idempotência',
    },
    {
      key: 'atividade',
      label: 'Atividade / Turma',
      desc: 'Nome da turma/modalidade que cria classes e enrollments',
    },
    { key: 'foto', label: 'Foto do Aluno', desc: 'URL da imagem do perfil' },
    { key: 'nascimento', label: 'Data de Nascimento', desc: 'Formato texto ou data do Bubble' },
    {
      key: 'nomeResponsavel',
      label: 'Nome do Responsável',
      desc: 'Nome do responsável financeiro/legal',
    },
    { key: 'cpfResponsavel', label: 'CPF do Responsável', desc: 'Documento do responsável' },
    { key: 'celularResponsavel', label: 'Celular do Responsável', desc: 'Contato telefônico' },
    {
      key: 'emailResponsavel',
      label: 'E-mail do Responsável',
      desc: 'E-mail para avisos e cobranças',
    },
    { key: 'whatsapp', label: 'WhatsApp', desc: 'Número com DDD' },
    { key: 'logradouro', label: 'Logradouro', desc: 'Rua, Avenida, etc.' },
    { key: 'numero', label: 'Número', desc: 'Número do endereço' },
    { key: 'complemento', label: 'Complemento', desc: 'Apto, Casa, Bloco' },
    { key: 'bairro', label: 'Bairro', desc: 'Bairro de residência' },
    { key: 'cidade', label: 'Cidade', desc: 'Município' },
    { key: 'uf', label: 'UF', desc: 'Estado (ex: PB)' },
    { key: 'cep', label: 'CEP', desc: 'Código postal' },
    { key: 'mensalidade', label: 'Mensalidade', desc: 'Valor cheio do plano' },
    {
      key: 'mensalidadeComDesconto',
      label: 'Mensalidade c/ Desconto',
      desc: 'Valor efetivo cobrado',
    },
    { key: 'vencimento', label: 'Dia do Vencimento', desc: 'Dia do mês para cobrança' },
    { key: 'dataMatricula', label: 'Data de Matrícula', desc: 'Data do ingresso do aluno' },
    { key: 'dataUltimoPagamento', label: 'Data Último Pagamento', desc: 'Histórico de pagamento' },
    { key: 'valorPago', label: 'Valor Pago', desc: 'Valor histórico registrado' },
    {
      key: 'atestadoTr',
      label: 'Atestado / TR / Situação',
      desc: 'TR, Atestado, Vencido, Ausente',
    },
    {
      key: 'atestadoTrValidade',
      label: 'Validade Atestado',
      desc: 'Data final do atestado médico',
    },
    {
      key: 'validadeTrancamento',
      label: 'Validade Trancamento',
      desc: 'Data final do trancamento',
    },
    {
      key: 'mensalidadeTrancada',
      label: 'Mensalidade Trancada',
      desc: 'Indica se cobrança está pausada (sim/não)',
    },
  ]

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-[#0F1B3D]">
            Importação de Alunos do Bubble
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Envie a planilha exportada do Bubble (.csv) para migrar alunos, turmas, matrículas e
            histórico de forma idempotente.
          </p>
        </div>

        {file && (
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isImporting}
            className="flex items-center gap-2 border-slate-300 hover:bg-slate-100"
          >
            <RotateCcw className="w-4 h-4 text-slate-600" />
            Trocar Arquivo
          </Button>
        )}
      </div>

      {/* Upload Drop Zone */}
      {!file && (
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
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFile(e.target.files[0])
                }
              }}
            />

            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#0F1B3D] to-[#17A2B8] flex items-center justify-center mb-4 text-[#D4AF37] shadow-lg">
              <Upload className="w-8 h-8" />
            </div>

            <h3 className="text-lg md:text-xl font-bold text-[#0F1B3D]">
              Arraste e solte o CSV do Bubble aqui
            </h3>
            <p className="text-xs md:text-sm text-slate-500 max-w-md mt-1.5 mb-6">
              Ou clique para selecionar o arquivo exportado da base de dados do Bubble. Codificação
              UTF-8 recomendada.
            </p>

            <Button
              type="button"
              className="bg-[#0F1B3D] hover:bg-[#1B2A5B] text-white font-medium px-6 shadow-md"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Selecionar arquivo CSV
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Preview & Confirmation Screen */}
      {file && (
        <div className="space-y-6">
          {/* File summary bar */}
          <div className="bg-white rounded-xl p-4 md:p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-[#0F1B3D] text-base truncate max-w-md">
                    {fileName}
                  </h4>
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
                  >
                    {(file.size / 1024).toFixed(1)} KB
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Total de <strong className="text-slate-800">{csvRows.length} linhas</strong> de
                  alunos detectadas e {csvHeaders.length} colunas disponíveis.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMappingConfig(!showMappingConfig)}
                disabled={isImporting}
                className="flex items-center gap-2 border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                <SlidersHorizontal className="w-4 h-4 text-[#17A2B8]" />
                {showMappingConfig ? 'Ocultar Mapeamento' : 'Ajustar Mapeamento'}
              </Button>

              <Button
                onClick={handleStartImport}
                disabled={isImporting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md px-6 flex-1 md:flex-none"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Iniciar Importação
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Progress Bar (during import) */}
          {isImporting && (
            <Card className="border-[#17A2B8]/40 bg-white shadow-md animate-fade-in">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-[#0F1B3D] font-bold flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-[#17A2B8] animate-spin" />
                    Processamento em Andamento
                  </CardTitle>
                  <span className="text-sm font-bold text-[#17A2B8]">{progressPercent}%</span>
                </div>
                <CardDescription className="text-xs text-slate-500 truncate">
                  {progressStatus}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Progress value={progressPercent} className="h-2.5 bg-slate-100" />
                <p className="text-[11px] text-slate-400 mt-2 text-right">
                  Atualizando alunos, turmas e registros de forma idempotente...
                </p>
              </CardContent>
            </Card>
          )}

          {/* Import Results Report */}
          {importResult && (
            <div className="space-y-4 animate-fade-in">
              <Card className="border-emerald-200 bg-white shadow-md">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-bold text-emerald-900">
                          Importação Concluída com Sucesso!
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500">
                          Relatório do processamento do arquivo no banco de dados.
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-center">
                      <p className="text-[11px] font-medium text-slate-500 uppercase">
                        Processados
                      </p>
                      <p className="text-2xl font-bold text-[#0F1B3D] mt-0.5">
                        {importResult.totalProcessed}
                      </p>
                    </div>

                    <div className="bg-emerald-50/80 p-3.5 rounded-xl border border-emerald-200 text-center">
                      <p className="text-[11px] font-medium text-emerald-700 uppercase">
                        Alunos Criados
                      </p>
                      <p className="text-2xl font-bold text-emerald-800 mt-0.5">
                        {importResult.studentsCreated}
                      </p>
                    </div>

                    <div className="bg-blue-50/80 p-3.5 rounded-xl border border-blue-200 text-center">
                      <p className="text-[11px] font-medium text-blue-700 uppercase">
                        Alunos Atualizados
                      </p>
                      <p className="text-2xl font-bold text-blue-800 mt-0.5">
                        {importResult.studentsUpdated}
                      </p>
                    </div>

                    <div className="bg-purple-50/80 p-3.5 rounded-xl border border-purple-200 text-center">
                      <p className="text-[11px] font-medium text-purple-700 uppercase">
                        Turmas Criadas
                      </p>
                      <p className="text-2xl font-bold text-purple-800 mt-0.5">
                        {importResult.classesCreated}
                      </p>
                    </div>

                    <div className="bg-amber-50/80 p-3.5 rounded-xl border border-amber-200 text-center">
                      <p className="text-[11px] font-medium text-amber-700 uppercase">
                        Matrículas Criadas
                      </p>
                      <p className="text-2xl font-bold text-amber-800 mt-0.5">
                        {importResult.enrollmentsCreated}
                      </p>
                    </div>

                    <div className="bg-teal-50/80 p-3.5 rounded-xl border border-teal-200 text-center">
                      <p className="text-[11px] font-medium text-teal-700 uppercase">
                        Pagamentos Históricos
                      </p>
                      <p className="text-2xl font-bold text-teal-800 mt-0.5">
                        {importResult.paymentsCreated}
                      </p>
                    </div>
                  </div>

                  {/* Warnings / Errors Section */}
                  {importResult.warnings.length > 0 && (
                    <div className="mt-6 border-t border-slate-100 pt-5">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <h5 className="font-bold text-sm text-[#0F1B3D]">
                          Avisos durante a importação ({importResult.warnings.length})
                        </h5>
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-2">
                        {importResult.warnings.map((w, idx) => (
                          <div
                            key={idx}
                            className="text-xs bg-amber-50/60 border border-amber-200/70 text-amber-900 rounded-lg p-2.5 flex items-start gap-2"
                          >
                            <span className="font-mono text-[10px] bg-amber-200/80 px-1.5 py-0.5 rounded text-amber-950 shrink-0">
                              Linha {w.row}
                            </span>
                            {w.studentName && (
                              <span className="font-semibold">{w.studentName}:</span>
                            )}
                            <span className="flex-1">{w.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Optional Mapping Configuration Accordion */}
          {showMappingConfig && (
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-base text-[#0F1B3D] font-bold">
                  Mapeamento de Colunas do CSV
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Associe cada campo do sistema a uma coluna detectada na sua planilha.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {mappingFieldsConfig.map((item) => (
                    <div
                      key={item.key}
                      className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 flex flex-col justify-between"
                    >
                      <div className="mb-2">
                        <label className="text-xs font-bold text-[#0F1B3D] block">
                          {item.label}
                        </label>
                        <span className="text-[11px] text-slate-500">{item.desc}</span>
                      </div>
                      <Select
                        value={mapping[item.key] || ''}
                        onValueChange={(val) =>
                          setMapping((prev) => ({ ...prev, [item.key]: val }))
                        }
                      >
                        <SelectTrigger className="h-8 text-xs bg-white border-slate-300">
                          <SelectValue placeholder="Selecione a coluna..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">(Não mapear)</SelectItem>
                          {csvHeaders.map((header) => (
                            <SelectItem key={header} value={header}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Data Preview Table */}
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base text-[#0F1B3D] font-bold">
                    Pré-visualização dos Dados
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Primeiras 5 linhas detectadas para conferência de formatação.
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="text-xs">
                  Mostrando 5 de {csvRows.length} registros
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-12 text-center text-xs">#</TableHead>
                      <TableHead className="text-xs font-bold">Aluno</TableHead>
                      <TableHead className="text-xs font-bold">Atividade (Turma)</TableHead>
                      <TableHead className="text-xs font-bold">Responsável</TableHead>
                      <TableHead className="text-xs font-bold">WhatsApp / Celular</TableHead>
                      <TableHead className="text-xs font-bold">Mensalidade</TableHead>
                      <TableHead className="text-xs font-bold">Situação</TableHead>
                      <TableHead className="text-xs font-bold">Bubble ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvRows.slice(0, 5).map((row, i) => (
                      <TableRow key={i} className="hover:bg-slate-50/80">
                        <TableCell className="text-center font-mono text-xs text-slate-400">
                          {i + 1}
                        </TableCell>
                        <TableCell className="font-semibold text-xs text-[#0F1B3D]">
                          {row[mapping.aluno] || (
                            <span className="text-slate-300 italic">Vazio</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {row[mapping.atividade] ? (
                            <Badge
                              variant="outline"
                              className="bg-cyan-50 text-cyan-800 border-cyan-200 text-[11px]"
                            >
                              {row[mapping.atividade]}
                            </Badge>
                          ) : (
                            <span className="text-slate-400 text-xs">Sem turma</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {row[mapping.nomeResponsavel] || '—'}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-slate-600">
                          {row[mapping.whatsapp] || row[mapping.celularResponsavel] || '—'}
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-slate-700">
                          {row[mapping.mensalidadeComDesconto]
                            ? `R$ ${row[mapping.mensalidadeComDesconto]}`
                            : row[mapping.mensalidade]
                              ? `R$ ${row[mapping.mensalidade]}`
                              : '—'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {row[mapping.atestadoTr] ? (
                            <Badge
                              variant="outline"
                              className={
                                row[mapping.atestadoTr] === 'TR'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : row[mapping.atestadoTr] === 'Atestado'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : row[mapping.atestadoTr] === 'Vencido'
                                      ? 'bg-red-50 text-red-700 border-red-200'
                                      : 'bg-slate-50 text-slate-700 border-slate-200'
                              }
                            >
                              {row[mapping.atestadoTr]}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-700 border-emerald-200"
                            >
                              Ativo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-slate-400 truncate max-w-[130px]">
                          {row[mapping.uniqueId] || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
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
