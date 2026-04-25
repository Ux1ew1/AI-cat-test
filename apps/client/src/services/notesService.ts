import { notesRepository } from '../repositories/notesRepository'
import type { Note } from '../types/note'

function titleFromText(text: string, fallback: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return fallback
  }

  return normalized.slice(0, 40)
}

function nowIso() {
  return new Date().toISOString()
}

function generateId() {
  const cryptoApi = globalThis.crypto

  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID()
  }

  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(16)
    cryptoApi.getRandomValues(bytes)
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  }

  return `note-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const notesService = {
  list(): Note[] {
    return notesRepository.list()
  },

  createDraft(language: 'ru' | 'en'): Note {
    const now = nowIso()
    const note: Note = {
      id: generateId(),
      title: language === 'ru' ? 'Новая заметка' : 'New note',
      originalText: '',
      processedText: '',
      summary: '',
      language,
      sourceType: 'text',
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    }

    notesRepository.upsert(note)
    return note
  },

  updateDraftContent(note: Note, originalText: string): Note {
    const updated: Note = {
      ...note,
      originalText,
      title: titleFromText(originalText, note.title),
      sourceType: 'text',
      status: note.status === 'error' ? 'draft' : note.status,
      updatedAt: nowIso(),
    }

    notesRepository.upsert(updated)
    return updated
  },

  rename(note: Note, title: string): Note {
    const updated: Note = {
      ...note,
      title: title.trim() || note.title,
      updatedAt: nowIso(),
    }

    notesRepository.upsert(updated)
    return updated
  },

  applyAiResult(
    note: Note,
    aiResult: { processedText: string; summary: string; title?: string },
  ): Note {
    const updated: Note = {
      ...note,
      processedText: aiResult.processedText.trim(),
      summary: aiResult.summary.trim(),
      title: titleFromText(aiResult.title ?? note.title, note.title),
      status: aiResult.processedText.trim() ? 'processed' : 'error',
      updatedAt: nowIso(),
    }

    notesRepository.upsert(updated)
    return updated
  },

  markError(note: Note): Note {
    const updated: Note = {
      ...note,
      status: 'error',
      updatedAt: nowIso(),
    }

    notesRepository.upsert(updated)
    return updated
  },

  remove(noteId: string): Note[] {
    return notesRepository.remove(noteId)
  },
}
