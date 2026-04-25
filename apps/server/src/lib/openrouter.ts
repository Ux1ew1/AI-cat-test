type OpenRouterRole = 'system' | 'user' | 'assistant'

type OpenRouterMessage = {
  role: OpenRouterRole
  content: string
}

type OpenRouterCallInput = {
  apiKey: string
  baseUrl: string
  appName: string
  appUrl: string
  model: string
  temperature: number
  maxTokens: number
  messages: OpenRouterMessage[]
}

type OpenRouterSuccess = {
  ok: true
  text: string
  model: string
}

type OpenRouterFailure = {
  ok: false
  status: number
  error: string
}

export async function callOpenRouter(
  input: OpenRouterCallInput,
): Promise<OpenRouterSuccess | OpenRouterFailure> {
  try {
    const response = await fetch(`${input.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.apiKey}`,
        'HTTP-Referer': input.appUrl,
        'X-Title': input.appName,
      },
      body: JSON.stringify({
        model: input.model,
        temperature: input.temperature,
        max_tokens: input.maxTokens,
        messages: input.messages,
      }),
    })

    const json = (await response.json().catch(() => null)) as
      | {
          error?: { message?: string }
          choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>
          model?: string
        }
      | null

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: json?.error?.message ?? 'Unknown OpenRouter error',
      }
    }

    const content = json?.choices?.[0]?.message?.content
    const text =
      typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? content.map((item) => item.text ?? '').join('')
          : ''

    return {
      ok: true,
      text: text.trim(),
      model: json?.model ?? input.model,
    }
  } catch (error) {
    return {
      ok: false,
      status: 500,
      error: error instanceof Error ? error.message : 'OpenRouter request failed',
    }
  }
}
