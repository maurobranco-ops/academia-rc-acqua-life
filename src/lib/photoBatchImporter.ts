import { unzipSync } from 'fflate'
import { academyService } from '@/services/academy'
import type { StudentRecord } from '@/types/database'
import { matchPhotoNameToStudent, type MatchStatus } from './studentPhoto'
import { compressImage } from './imageCompression'

export interface PhotoFileItem {
  id: string
  name: string
  file: File | Blob
  size: number
  previewUrl: string
  status: MatchStatus
  matchedStudent?: StudentRecord
  candidates?: StudentRecord[]
  candidateNames?: string[]
  reason?: string
  confirmedByUser?: boolean
  manualOverride?: boolean
  uploadStatus?: 'pending' | 'uploading' | 'success' | 'error' | 'skipped'
  errorMessage?: string
}

export interface PhotoBatchReport {
  totalFiles: number
  matchedCount: number
  unmatchedCount: number
  ambiguousCount: number
  needsConfirmationCount: number
  ignoredInactiveCount: number
  successCount: number
  errorCount: number
  errors: { filename: string; error: string }[]
  unmatchedFiles: string[]
  ignoredInactiveFiles: { filename: string; studentName?: string; situation?: string }[]
}

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']

function isImageFile(filename: string): boolean {
  const lower = filename.toLowerCase()
  return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

function getMimeType(filename: string): string {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
}

/**
 * Extrai arquivos de imagem de um arquivo ZIP usando fflate
 */
export async function extractPhotosFromZip(zipFile: File): Promise<File[]> {
  const buffer = await zipFile.arrayBuffer()
  const unzipped = unzipSync(new Uint8Array(buffer), {
    filter(file) {
      const lower = file.name.toLowerCase()
      // Ignora arquivos de sistema (como __MACOSX ou .DS_Store)
      if (lower.includes('__macosx') || lower.includes('.ds_store')) {
        return false
      }
      return isImageFile(file.name)
    },
  })

  const extractedFiles: File[] = []

  for (const [pathName, uint8Data] of Object.entries(unzipped)) {
    // Garante que é arquivo e tem conteúdo
    if (!uint8Data || uint8Data.length === 0) continue
    const baseName = pathName.split(/[\\/]/).pop() || pathName
    if (!isImageFile(baseName)) continue

    const mime = getMimeType(baseName)
    // Converte Uint8Array para Blob / File
    const blob = new Blob([uint8Data], { type: mime })
    const file = new File([blob], baseName, { type: mime })
    extractedFiles.push(file)
  }

  return extractedFiles
}

/**
 * Cria a lista de PhotoFileItem com pré-visualização e tentativa de casamento com a lista de alunos
 */
export function buildPhotoItemsList(
  files: (File | (Blob & { name?: string }))[],
  students: StudentRecord[],
): PhotoFileItem[] {
  return files.map((f, index) => {
    const filename = f.name || `foto_${index + 1}.jpg`
    const previewUrl = URL.createObjectURL(f)
    const match = matchPhotoNameToStudent(filename, students)

    return {
      id: `${filename}_${index}_${Date.now()}`,
      name: filename,
      file: f,
      size: f.size,
      previewUrl,
      status: match.status,
      matchedStudent: match.student,
      candidates: match.candidates,
      candidateNames: match.candidateNames,
      reason: match.reason,
      confirmedByUser: match.status === 'matched', // Somente match exato já vem aprovado
      uploadStatus: 'pending',
    }
  })
}

/**
 * Realiza o upload em lote de cada arquivo casado para o PocketBase
 */
export async function uploadMatchedPhotos(
  items: PhotoFileItem[],
  onProgress?: (current: number, total: number, currentItem: PhotoFileItem) => void,
): Promise<PhotoBatchReport> {
  const ignoredInactiveItems = items.filter((i) => i.status === 'ignored_inactive')

  // Itens aprovados para envio:
  // 1) Match exato seguro (status 'matched' e tem aluno)
  // 2) Correspondência incerta ou reatribuição aprovada explicitamente pelo usuário (confirmedByUser && matchedStudent)
  const itemsToUpload = items.filter(
    (i) =>
      i.matchedStudent &&
      i.status !== 'ignored_inactive' &&
      (i.confirmedByUser || i.status === 'matched'),
  )

  const report: PhotoBatchReport = {
    totalFiles: items.length,
    matchedCount: itemsToUpload.length,
    unmatchedCount: items.filter((i) => i.status === 'unmatched').length,
    ambiguousCount: items.filter((i) => i.status === 'ambiguous' && !i.confirmedByUser).length,
    needsConfirmationCount: items.filter(
      (i) => i.status === 'needs_confirmation' && !i.confirmedByUser,
    ).length,
    ignoredInactiveCount: ignoredInactiveItems.length,
    successCount: 0,
    errorCount: 0,
    errors: [],
    // Arquivos não encontrados NÃO incluem alunos inativos ignorados:
    unmatchedFiles: items
      .filter(
        (i) =>
          i.status !== 'ignored_inactive' &&
          !(i.matchedStudent && (i.confirmedByUser || i.status === 'matched')),
      )
      .map((i) => i.name),
    ignoredInactiveFiles: ignoredInactiveItems.map((i) => ({
      filename: i.name,
      studentName: i.matchedStudent?.name,
      situation:
        i.matchedStudent?.raw_situation ||
        i.matchedStudent?.situation ||
        (i.matchedStudent ? 'inativo' : undefined),
    })),
  }

  const total = itemsToUpload.length
  let processedCount = 0

  // Pool de concorrência controlada (6 uploads em paralelo para minimizar latência)
  const CONCURRENCY = 6

  const processItem = async (item: PhotoFileItem) => {
    item.uploadStatus = 'uploading'
    if (onProgress) {
      onProgress(processedCount, total, item)
    }

    try {
      if (!item.matchedStudent) {
        throw new Error('Nenhum aluno vinculado')
      }

      // 1. Comprime a foto no navegador antes do upload para reduzir payload e tempo de transferência
      const { file: fileToSend, compressedSize } = await compressImage(item.file, item.name, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.82,
        mimeType: 'image/jpeg',
      })

      // 2. Envia para o PocketBase
      const updated = await academyService.uploadStudentPhoto(
        item.matchedStudent.id,
        fileToSend,
        item.name,
      )

      // Atualiza o registro em memória do aluno vinculado com o novo photo_file
      if (updated && updated.photo_file) {
        item.matchedStudent.photo_file = updated.photo_file
      }

      item.uploadStatus = 'success'
      report.successCount++
    } catch (err: any) {
      item.uploadStatus = 'error'
      const errMsg = err?.message || 'Falha no upload'
      item.errorMessage = errMsg
      report.errorCount++
      report.errors.push({ filename: item.name, error: errMsg })
    } finally {
      processedCount++
      if (onProgress) {
        onProgress(processedCount, total, item)
      }
    }
  }

  // Executa itens em lotes com Promise.all limitado pelo número de workers concorrentes
  const queue = [...itemsToUpload]
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length > 0) {
      const nextItem = queue.shift()
      if (nextItem) {
        await processItem(nextItem)
      }
    }
  })

  await Promise.all(workers)

  return report
}
