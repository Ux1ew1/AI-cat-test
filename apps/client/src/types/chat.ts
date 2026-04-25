export type MessageRole = 'user' | 'assistant' | 'system'
export type MessageSourceType = 'text' | 'voice'
export type MessageStatus = 'pending' | 'sent' | 'failed'

export interface Chat {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  lastMessagePreview: string
  messageCount: number
}

export interface Message {
  id: string
  chatId: string
  role: MessageRole
  content: string
  createdAt: string
  sourceType: MessageSourceType
  model?: string
  status: MessageStatus
}
