export type SummarizeNoteRequest = {
  text: string
  language: 'ru' | 'en'
}

export type SummarizeNoteResponse = {
  summary: string
  processedText: string
  title?: string
  model: string
}

export type ChatHistoryItem = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export type ChatRequest = {
  chatId: string
  message: string
  language: 'ru' | 'en'
  history: ChatHistoryItem[]
}

export type ChatResponse = {
  reply: string
  model: string
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || 'http://localhost:8787'

async function postJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      let details = text

      try {
        const parsed = JSON.parse(text) as { error?: string; details?: string }
        details = parsed.details || parsed.error || text
      } catch {
        // Keep plain text when response is not valid JSON.
      }

      throw new Error(`HTTP ${response.status}: ${details || 'Request failed'}`)
    }

    return (await response.json()) as TResponse
  } finally {
    clearTimeout(timeout)
  }
}

export const aiService = {
  summarizeNote(payload: SummarizeNoteRequest): Promise<SummarizeNoteResponse> {
    return postJson<SummarizeNoteResponse>('/ai/summarize-note', payload)
  },

  chat(payload: ChatRequest): Promise<ChatResponse> {
    return postJson<ChatResponse>('/ai/chat', payload)
  },
}
