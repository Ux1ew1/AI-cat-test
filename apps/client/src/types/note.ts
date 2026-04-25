export type NoteSourceType = 'text' | 'voice'
export type NoteStatus = 'draft' | 'processed' | 'error'

export interface Note {
  id: string
  title: string
  originalText: string
  processedText: string
  summary: string
  language: 'ru' | 'en'
  sourceType: NoteSourceType
  status: NoteStatus
  createdAt: string
  updatedAt: string
}
