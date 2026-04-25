import { aiService } from './aiService'
import { chatsRepository } from '../repositories/chatsRepository'
import { messagesRepository } from '../repositories/messagesRepository'
import type { Chat, Message, MessageSourceType } from '../types/chat'

function nowIso() {
  return new Date().toISOString()
}

function generateId(prefix: string) {
  const cryptoApi = globalThis.crypto

  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID()
  }

  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(16)
    cryptoApi.getRandomValues(bytes)
    const random = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
    return `${prefix}-${random}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function normalizeTitle(value: string, fallback: string) {
  const trimmed = value.trim()
  return trimmed || fallback
}

function updateChatMeta(chat: Chat): Chat {
  const messages = messagesRepository.listByChatId(chat.id)
  const lastMessage = messages[messages.length - 1]

  const updated: Chat = {
    ...chat,
    messageCount: messages.length,
    lastMessagePreview: lastMessage?.content ?? '',
    updatedAt: messages.length ? lastMessage.createdAt : chat.updatedAt,
  }

  chatsRepository.upsert(updated)
  return updated
}

function buildHistory(chatId: string, assistantMessageId: string) {
  const messages = messagesRepository.listByChatId(chatId)
  const assistantIndex = messages.findIndex((message) => message.id === assistantMessageId)

  if (assistantIndex < 1) {
    return { history: [], userMessage: '' }
  }

  const beforeAssistant = messages.slice(0, assistantIndex)
  const userMessage = beforeAssistant[beforeAssistant.length - 1]
  const history = beforeAssistant.slice(0, -1).map((message) => ({
    role: message.role,
    content: message.content,
  }))

  return {
    history,
    userMessage: userMessage?.content ?? '',
  }
}

export const chatService = {
  listChats(): Chat[] {
    return chatsRepository.list()
  },

  listMessages(chatId: string): Message[] {
    return messagesRepository.listByChatId(chatId)
  },

  createChat(language: 'ru' | 'en'): Chat {
    const now = nowIso()
    const chat: Chat = {
      id: generateId('chat'),
      title: language === 'ru' ? 'Новый чат' : 'New chat',
      createdAt: now,
      updatedAt: now,
      lastMessagePreview: '',
      messageCount: 0,
    }

    chatsRepository.upsert(chat)
    return chat
  },

  renameChat(chatId: string, title: string): Chat | null {
    const chat = chatsRepository.getById(chatId)
    if (!chat) {
      return null
    }

    const updated: Chat = {
      ...chat,
      title: normalizeTitle(title, chat.title),
      updatedAt: nowIso(),
    }

    chatsRepository.upsert(updated)
    return updated
  },

  deleteChat(chatId: string): Chat[] {
    messagesRepository.removeByChatId(chatId)
    return chatsRepository.remove(chatId)
  },

  enqueueUserMessage(
    chatId: string,
    content: string,
    sourceType: MessageSourceType,
  ): { userMessage: Message; assistantMessage: Message } | null {
    const chat = chatsRepository.getById(chatId)
    if (!chat) {
      return null
    }

    const now = nowIso()

    const userMessage: Message = {
      id: generateId('msg'),
      chatId,
      role: 'user',
      content,
      createdAt: now,
      sourceType,
      status: 'sent',
    }

    const assistantMessage: Message = {
      id: generateId('msg'),
      chatId,
      role: 'assistant',
      content: '...',
      createdAt: nowIso(),
      sourceType: 'text',
      status: 'pending',
    }

    messagesRepository.upsert(userMessage)
    messagesRepository.upsert(assistantMessage)
    updateChatMeta(chat)

    return { userMessage, assistantMessage }
  },

  async resolveAssistantMessage(
    chatId: string,
    assistantMessageId: string,
    language: 'ru' | 'en',
  ): Promise<Message | null> {
    const chat = chatsRepository.getById(chatId)
    if (!chat) {
      return null
    }

    const messages = messagesRepository.listByChatId(chatId)
    const assistantMessage = messages.find((message) => message.id === assistantMessageId)

    if (!assistantMessage) {
      return null
    }

    const pendingMessage: Message = {
      ...assistantMessage,
      status: 'pending',
      content: '...',
      createdAt: nowIso(),
    }

    messagesRepository.upsert(pendingMessage)
    updateChatMeta(chat)

    const context = buildHistory(chatId, assistantMessageId)

    try {
      const response = await aiService.chat({
        chatId,
        message: context.userMessage,
        language,
        history: context.history,
      })

      const resolved: Message = {
        ...pendingMessage,
        status: 'sent',
        content: response.reply,
        createdAt: nowIso(),
        model: response.model,
      }

      messagesRepository.upsert(resolved)
      updateChatMeta(chat)

      return resolved
    } catch {
      const failed: Message = {
        ...pendingMessage,
        status: 'failed',
        content: 'AI response failed. Retry is available.',
        createdAt: nowIso(),
      }

      messagesRepository.upsert(failed)
      updateChatMeta(chat)

      return failed
    }
  },
}
