import type { Note } from '../types/note'

const NOTES_STORAGE_KEY = 'ai-cat.notes.v1'

function sortByUpdatedAtDesc(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

function readAll(): Note[] {
  const raw = localStorage.getItem(NOTES_STORAGE_KEY)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as Note[]
    return sortByUpdatedAtDesc(parsed)
  } catch {
    return []
  }
}

function writeAll(notes: Note[]) {
  localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(sortByUpdatedAtDesc(notes)))
}

export const notesRepository = {
  list(): Note[] {
    return readAll()
  },

  getById(id: string): Note | null {
    return readAll().find((note) => note.id === id) ?? null
  },

  upsert(note: Note): Note[] {
    const notes = readAll()
    const index = notes.findIndex((item) => item.id === note.id)

    if (index >= 0) {
      notes[index] = note
    } else {
      notes.push(note)
    }

    writeAll(notes)
    return sortByUpdatedAtDesc(notes)
  },

  remove(id: string): Note[] {
    const notes = readAll().filter((note) => note.id !== id)
    writeAll(notes)
    return sortByUpdatedAtDesc(notes)
  },
}
