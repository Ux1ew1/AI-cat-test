import type { Message } from '../types/chat'

const MESSAGES_STORAGE_KEY = 'ai-cat.messages.v1'

function readAll(): Message[] {
  const raw = localStorage.getItem(MESSAGES_STORAGE_KEY)
  if (!raw) {
    return []
  }

  try {
    return JSON.parse(raw) as Message[]
  } catch {
    return []
  }
}

function writeAll(messages: Message[]) {
  localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messages))
}

export const messagesRepository = {
  listByChatId(chatId: string): Message[] {
    return readAll()
      .filter((message) => message.chatId === chatId)
      .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1))
  },

  upsert(message: Message): Message[] {
    const messages = readAll()
    const index = messages.findIndex((item) => item.id === message.id)

    if (index >= 0) {
      messages[index] = message
    } else {
      messages.push(message)
    }

    writeAll(messages)
    return messages
  },

  removeByChatId(chatId: string): Message[] {
    const messages = readAll().filter((message) => message.chatId !== chatId)
    writeAll(messages)
    return messages
  },
}
