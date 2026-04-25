import { config as loadEnv } from 'dotenv'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { z } from 'zod'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { callOpenRouter } from './lib/openrouter.js'

const currentFilePath = fileURLToPath(import.meta.url)
const currentDir = dirname(currentFilePath)

loadEnv({ path: resolve(currentDir, '../../../.env') })
loadEnv()

const envSchema = z.object({
  PORT: z.string().optional().default('8787'),
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_MODEL: z.string().min(1),
  OPENROUTER_BASE_URL: z.string().url().optional().default('https://openrouter.ai/api/v1'),
  OPENROUTER_APP_NAME: z.string().optional().default('AI Cat Notes'),
  OPENROUTER_APP_URL: z.string().optional().default('http://localhost:5173'),
  AI_DEFAULT_LANGUAGE: z.enum(['ru', 'en']).optional().default('ru'),
  AI_CHAT_TEMPERATURE: z.string().optional().default('0.7'),
  AI_NOTES_TEMPERATURE: z.string().optional().default('0.3'),
  AI_MAX_TOKENS: z.string().optional().default('1200'),
})

const parsedEnv = envSchema.safeParse({
  PORT: process.env.PORT?.trim(),
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY?.trim(),
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL?.trim(),
  OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL?.trim(),
  OPENROUTER_APP_NAME: process.env.OPENROUTER_APP_NAME?.trim(),
  OPENROUTER_APP_URL: process.env.OPENROUTER_APP_URL?.trim(),
  AI_DEFAULT_LANGUAGE: process.env.AI_DEFAULT_LANGUAGE?.trim(),
  AI_CHAT_TEMPERATURE: process.env.AI_CHAT_TEMPERATURE?.trim(),
  AI_NOTES_TEMPERATURE: process.env.AI_NOTES_TEMPERATURE?.trim(),
  AI_MAX_TOKENS: process.env.AI_MAX_TOKENS?.trim(),
})

if (!parsedEnv.success) {
  throw new Error(`Invalid server env: ${parsedEnv.error.message}`)
}

const env = parsedEnv.data

const app = Fastify({
  logger: true,
})

await app.register(cors, {
  origin: true,
})

app.get('/health', async () => ({ ok: true }))

const summarizeSchema = z.object({
  text: z.string().min(1),
  language: z.enum(['ru', 'en']).optional(),
})

const chatSchema = z.object({
  chatId: z.string().min(1),
  message: z.string().min(1),
  language: z.enum(['ru', 'en']).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string().min(1),
      }),
    )
    .optional()
    .default([]),
})

function safeJsonExtract(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) {
    return null
  }

  try {
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

app.post('/ai/summarize-note', async (request, reply) => {
  const parsed = summarizeSchema.safeParse(request.body)

  if (!parsed.success) {
    return reply.code(400).send({ error: 'Invalid request body' })
  }

  const language = parsed.data.language ?? env.AI_DEFAULT_LANGUAGE

  const completion = await callOpenRouter({
    apiKey: env.OPENROUTER_API_KEY,
    baseUrl: env.OPENROUTER_BASE_URL,
    appName: env.OPENROUTER_APP_NAME,
    appUrl: env.OPENROUTER_APP_URL,
    model: env.OPENROUTER_MODEL,
    temperature: Number(env.AI_NOTES_TEMPERATURE),
    maxTokens: Number(env.AI_MAX_TOKENS),
    messages: [
      {
        role: 'system',
        content:
          language === 'ru'
            ? 'Ты помогаешь аккуратно переработать заметку. Верни JSON: {"summary":"...","processedText":"...","title":"..."}. Не добавляй объяснений вне JSON.'
            : 'You refine user notes. Return JSON only: {"summary":"...","processedText":"...","title":"..."}. No extra text outside JSON.',
      },
      {
        role: 'user',
        content: parsed.data.text,
      },
    ],
  })

  if (!completion.ok) {
    request.log.error({ status: completion.status, details: completion.error }, 'OpenRouter summarize failed')
    const status = completion.status >= 400 && completion.status < 500 ? completion.status : 502
    return reply.code(status).send({
      error: 'AI summarize failed',
      details: completion.error,
    })
  }

  const raw = completion.text
  const extracted = safeJsonExtract(raw)

  if (extracted && typeof extracted === 'object' && extracted !== null) {
    const summary = String((extracted as Record<string, unknown>).summary ?? '').trim()
    const processedText = String((extracted as Record<string, unknown>).processedText ?? '').trim()
    const title = String((extracted as Record<string, unknown>).title ?? '').trim()

    return {
      summary,
      processedText,
      title,
      model: completion.model,
    }
  }

  return {
    summary: raw.slice(0, 160),
    processedText: raw,
    title: raw.slice(0, 40),
    model: completion.model,
  }
})

app.post('/ai/chat', async (request, reply) => {
  const parsed = chatSchema.safeParse(request.body)

  if (!parsed.success) {
    return reply.code(400).send({ error: 'Invalid request body' })
  }

  const language = parsed.data.language ?? env.AI_DEFAULT_LANGUAGE

  const completion = await callOpenRouter({
    apiKey: env.OPENROUTER_API_KEY,
    baseUrl: env.OPENROUTER_BASE_URL,
    appName: env.OPENROUTER_APP_NAME,
    appUrl: env.OPENROUTER_APP_URL,
    model: env.OPENROUTER_MODEL,
    temperature: Number(env.AI_CHAT_TEMPERATURE),
    maxTokens: Number(env.AI_MAX_TOKENS),
    messages: [
      {
        role: 'system',
        content:
          language === 'ru'
            ? 'Отвечай по-русски, кратко и по делу. Не выдумывай факты.'
            : 'Reply in English, concise and useful. Do not invent facts.',
      },
      ...parsed.data.history,
      {
        role: 'user',
        content: parsed.data.message,
      },
    ],
  })

  if (!completion.ok) {
    request.log.error({ status: completion.status, details: completion.error }, 'OpenRouter chat failed')
    const status = completion.status >= 400 && completion.status < 500 ? completion.status : 502
    return reply.code(status).send({
      error: 'AI chat failed',
      details: completion.error,
    })
  }

  return {
    reply: completion.text,
    model: completion.model,
  }
})

app.setErrorHandler((error, _request, reply) => {
  const message = error instanceof Error ? error.message : 'Unknown server error'
  reply.code(500).send({
    error: 'Internal server error',
    details: message,
  })
})

const port = Number(env.PORT)
await app.listen({ port, host: '0.0.0.0' })
