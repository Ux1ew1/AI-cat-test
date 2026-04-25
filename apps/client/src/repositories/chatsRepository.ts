import type { Chat } from '../types/chat'

const CHATS_STORAGE_KEY = 'ai-cat.chats.v1'

function sortByUpdatedAtDesc(chats: Chat[]): Chat[] {
  return [...chats].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

function readAll(): Chat[] {
  const raw = localStorage.getItem(CHATS_STORAGE_KEY)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as Chat[]
    return sortByUpdatedAtDesc(parsed)
  } catch {
    return []
  }
}

function writeAll(chats: Chat[]) {
  localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(sortByUpdatedAtDesc(chats)))
}

export const chatsRepository = {
  list(): Chat[] {
    return readAll()
  },

  getById(id: string): Chat | null {
    return readAll().find((chat) => chat.id === id) ?? null
  },

  upsert(chat: Chat): Chat[] {
    const chats = readAll()
    const index = chats.findIndex((item) => item.id === chat.id)

    if (index >= 0) {
      chats[index] = chat
    } else {
      chats.push(chat)
    }

    writeAll(chats)
    return sortByUpdatedAtDesc(chats)
  },

  remove(id: string): Chat[] {
    const chats = readAll().filter((chat) => chat.id !== id)
    writeAll(chats)
    return sortByUpdatedAtDesc(chats)
  },
}
