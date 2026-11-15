// PAR-Q (Physical Activity Readiness Questionnaire) — 7 perguntas clássicas —
// e anamnese aquática da ficha de matrícula (Bayeux - PB, Lei Estadual nº 9.863/2012-PB).
// Compartilhado entre: formulário público /matricula, cadastro/edição do aluno,
// ficha do aluno e ficha imprimível.

export interface ParqQuestion {
  key: 'parq_1' | 'parq_2' | 'parq_3' | 'parq_4' | 'parq_5' | 'parq_6' | 'parq_7'
  text: string
}

export const PARQ_QUESTIONS: ParqQuestion[] = [
  {
    key: 'parq_1',
    text: 'Seu médico já disse que você tem problema de coração e recomendou atividade física apenas sob supervisão médica?',
  },
  { key: 'parq_2', text: 'Você sente dor no peito quando pratica atividade física?' },
  {
    key: 'parq_3',
    text: 'No último mês, você sentiu dor no peito quando praticou atividade física sem estar praticando?',
  },
  {
    key: 'parq_4',
    text: 'Você já perdeu o equilíbrio por causa de tontura ou perdeu a consciência em algum momento?',
  },
  {
    key: 'parq_5',
    text: 'Você tem problema ósseo ou articular (coluna, joelho ou quadril) que poderia piorar com a atividade física?',
  },
  {
    key: 'parq_6',
    text: 'Você toma atualmente algum medicamento para pressão arterial ou para o coração?',
  },
  {
    key: 'parq_7',
    text: 'Existe alguma outra razão pela qual você NÃO deve praticar atividade física?',
  },
]

export type ParqKey = ParqQuestion['key']
export type ParqValues = Partial<Record<ParqKey, string>>
export type AnamneseValues = Partial<Record<AnamneseKey, string>>

export const PARQ_YES = 'sim'
export const PARQ_NO = 'nao'

/** PAR-Q todo vazio (estado inicial dos formulários). */
export const EMPTY_PARQ: ParqValues = {
  parq_1: '',
  parq_2: '',
  parq_3: '',
  parq_4: '',
  parq_5: '',
  parq_6: '',
  parq_7: '',
}

/** Anamnese aquática vazia (estado inicial dos formulários). */
export const EMPTY_ANAMNESE: AnamneseValues = {
  anamnese_medo_agua: '',
  anamnese_convulsoes: '',
  anamnese_alergia_cloro: '',
  anamnese_medicamentos: '',
  anamnese_objetivo: '',
}

/** Aliases usados pelo formulário público /matricula. */
export const PARQ_EMPTY = EMPTY_PARQ
export const ANAMNESE_EMPTY = EMPTY_ANAMNESE

/** Extrai o PAR-Q preenchido de um registro de aluno (campos parq_1..parq_7). */
export function getParq(st: Partial<Record<ParqKey, string>>): ParqValues {
  return {
    parq_1: st.parq_1 || '',
    parq_2: st.parq_2 || '',
    parq_3: st.parq_3 || '',
    parq_4: st.parq_4 || '',
    parq_5: st.parq_5 || '',
    parq_6: st.parq_6 || '',
    parq_7: st.parq_7 || '',
  }
}

/** Extrai a anamnese preenchida de um registro de aluno (campos anamnese_*). */
export function getAnamnese(st: Partial<Record<AnamneseKey, string>>): AnamneseValues {
  return {
    anamnese_medo_agua: st.anamnese_medo_agua || '',
    anamnese_convulsoes: st.anamnese_convulsoes || '',
    anamnese_alergia_cloro: st.anamnese_alergia_cloro || '',
    anamnese_medicamentos: st.anamnese_medicamentos || '',
    anamnese_objetivo: st.anamnese_objetivo || '',
  }
}

export interface AnamneseQuestion {
  key: 'anamnese_medo_agua' | 'anamnese_convulsoes' | 'anamnese_alergia_cloro'
  text: string
}

export const ANAMNESE_QUESTIONS: AnamneseQuestion[] = [
  { key: 'anamnese_medo_agua', text: 'Sente medo de água (aquafobia)?' },
  { key: 'anamnese_convulsoes', text: 'Já teve convulsões ou crises epilépticas?' },
  { key: 'anamnese_alergia_cloro', text: 'Tem alergia ao cloro ou a produtos da piscina?' },
]

export type AnamneseKey = AnamneseQuestion['key'] | 'anamnese_medicamentos' | 'anamnese_objetivo'

/** Textos fixos da ficha imprimível (termo, normas, LGPD, rodapé legal). */
export const FICHA_LEGAL = {
  city: 'Bayeux - PB',
  law: 'Lei Estadual nº 9.863/2012-PB',
  lawText:
    'Conforme a Lei Estadual nº 9.863/2012-PB, é obrigatória a apresentação do Atestado de Aptidão Física e do Exame Dermatológico, com validade de 6 (seis) meses a partir da data de emissão.',
  riskTerm:
    'Declaro estar ciente de que a prática de natação/hidroginástica envolve riscos inerentes à atividade física em meio aquático, e me comprometo a informar à academia qualquer alteração de saúde que venha a ocorrer durante o período de matrícula.',
  rules:
    'Autorizo a participação do aluno(a) nas atividades da academia e me comprometo a cumprir as normas internas: uso de touca e traje de banho adequados, ducha obrigatória antes de entrar na piscina, pontualidade nos horários das aulas, e comunicação prévia em caso de falta ou de restrição médica.',
  lgpd: 'Autorização de uso de imagem (LGPD — Lei nº 13.709/2018): concorda com o uso da imagem do(a) aluno(a) em fotos e vídeos institucionais da academia (redes sociais e divulgação)?',
}

/** Formata data ISO (yyyy-mm-dd ou timestamp) como dd/mm/aaaa. */
export function formatDateBR(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}
