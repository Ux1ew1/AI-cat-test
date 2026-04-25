import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonTextarea,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/react'
import { menuOutline, settingsOutline } from 'ionicons/icons'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TopCatBanner } from '../components/TopCatBanner'
import { chatService } from '../services/chatService'
import type { Chat, Message, MessageSourceType } from '../types/chat'

type RecognitionWindow = Window & {
  SpeechRecognition?: new () => {
    lang: string
    interimResults: boolean
    maxAlternatives: number
    start: () => void
    onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
    onerror: (() => void) | null
  }
  webkitSpeechRecognition?: new () => {
    lang: string
    interimResults: boolean
    maxAlternatives: number
    start: () => void
    onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
    onerror: (() => void) | null
  }
}

export function ChatPage() {
  const { t, i18n } = useTranslation()
  const [chats, setChats] = useState<Chat[]>(() => chatService.listChats())
  const [selectedChatId, setSelectedChatId] = useState<string | null>(chats[0]?.id ?? null)
  const [, forceMessagesRefresh] = useState(0)
  const [composerText, setComposerText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [voiceState, setVoiceState] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.id === selectedChatId) ?? null,
    [chats, selectedChatId],
  )
  const messages = selectedChatId ? chatService.listMessages(selectedChatId) : []

  function refreshChats(fallbackId?: string | null) {
    const nextChats = chatService.listChats()
    setChats(nextChats)

    if (!nextChats.length) {
      setSelectedChatId(null)
      return
    }

    const targetId = fallbackId ?? selectedChatId
    const hasTarget = targetId ? nextChats.some((chat) => chat.id === targetId) : false
    const resolvedId = hasTarget ? targetId : nextChats[0].id
    setSelectedChatId(resolvedId)
  }

  function refreshMessages(chatId: string) {
    if (chatId) {
      forceMessagesRefresh((value) => value + 1)
    }
  }

  function createChat() {
    const language: 'ru' | 'en' = i18n.language === 'en' ? 'en' : 'ru'
    const created = chatService.createChat(language)
    refreshChats(created.id)
    refreshMessages(created.id)
  }

  function renameChat(chat: Chat) {
    const nextTitle = window.prompt(t('chat.renamePrompt'), chat.title)
    if (!nextTitle) {
      return
    }

    chatService.renameChat(chat.id, nextTitle)
    refreshChats(chat.id)
  }

  function deleteChat(chat: Chat) {
    const confirmed = window.confirm(t('chat.deleteConfirm'))
    if (!confirmed) {
      return
    }

    chatService.deleteChat(chat.id)
    refreshChats()
  }

  async function sendMessage(sourceType: MessageSourceType) {
    let activeChat = selectedChat
    if (!activeChat) {
      const language: 'ru' | 'en' = i18n.language === 'en' ? 'en' : 'ru'
      activeChat = chatService.createChat(language)
      refreshChats(activeChat.id)
      refreshMessages(activeChat.id)
    }

    const content = composerText.trim()
    if (!content || isSending) {
      return
    }

    setIsSending(true)
    setSendError('')

    try {
      const queued = chatService.enqueueUserMessage(activeChat.id, content, sourceType)

      if (!queued) {
        setSendError(t('chat.sendFailed'))
        return
      }

      setComposerText('')
      refreshMessages(activeChat.id)
      refreshChats(activeChat.id)

      const resolved = await chatService.resolveAssistantMessage(
        activeChat.id,
        queued.assistantMessage.id,
        i18n.language === 'en' ? 'en' : 'ru',
      )

      refreshMessages(activeChat.id)
      refreshChats(activeChat.id)

      if (!resolved || resolved.status === 'failed') {
        setSendError(t('chat.sendFailed'))
      }
    } catch (error) {
      setSendError(error instanceof Error ? error.message : t('chat.sendFailed'))
    } finally {
      setIsSending(false)
    }
  }

  async function retryAssistant(message: Message) {
    if (!selectedChat || isSending) {
      return
    }

    setIsSending(true)
    setSendError('')

    try {
      const resolved = await chatService.resolveAssistantMessage(
        selectedChat.id,
        message.id,
        i18n.language === 'en' ? 'en' : 'ru',
      )

      refreshMessages(selectedChat.id)
      refreshChats(selectedChat.id)

      if (!resolved || resolved.status === 'failed') {
        setSendError(t('chat.sendFailed'))
      }
    } catch (error) {
      setSendError(error instanceof Error ? error.message : t('chat.sendFailed'))
    } finally {
      setIsSending(false)
    }
  }

  function startVoiceInput() {
    const recognitionWindow = window as RecognitionWindow
    const SpeechRecognitionCtor =
      recognitionWindow.SpeechRecognition ?? recognitionWindow.webkitSpeechRecognition

    if (!SpeechRecognitionCtor) {
      setVoiceState(t('chat.voiceUnsupported'))
      return
    }

    const recognition = new SpeechRecognitionCtor()
    recognition.lang = i18n.language === 'en' ? 'en-US' : 'ru-RU'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    setVoiceState(t('chat.voiceListening'))

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? ''
      if (transcript) {
        setComposerText((previous) => (previous ? `${previous} ${transcript}` : transcript))
      }
      setVoiceState(t('chat.voiceReady'))
    }

    recognition.onerror = () => {
      setVoiceState(t('chat.voiceError'))
    }

    recognition.start()
  }

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => setSidebarOpen((prev) => !prev)} aria-label={t('chat.toggleHistory')}>
              <IonIcon slot="icon-only" icon={menuOutline} />
            </IonButton>
          </IonButtons>
          <IonTitle>{t('pages.chatTitle')}</IonTitle>
          <IonButtons slot="end">
            <IonButton routerLink="/settings" aria-label={t('common.openSettings')}>
              <IonIcon slot="icon-only" icon={settingsOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <div className={`chat-page-layout ${sidebarOpen ? 'is-sidebar-open' : ''}`}>
        <aside className="chat-history-panel">
          <div className="chat-history-panel__header">
            <h3>{t('chat.historyTitle')}</h3>
            <IonButton size="small" onClick={createChat}>
              {t('chat.newChat')}
            </IonButton>
          </div>

          <IonList inset>
            {chats.length === 0 ? (
              <IonItem lines="none">
                <IonLabel>{t('chat.emptyChats')}</IonLabel>
              </IonItem>
            ) : (
              chats.map((chat) => (
                <IonItem
                  key={chat.id}
                  button
                  detail={false}
                  onClick={() => {
                    setSelectedChatId(chat.id)
                    setSendError('')
                  }}
                >
                  <IonLabel>
                    <h3>{chat.title}</h3>
                    <p>{chat.lastMessagePreview || t('chat.noMessages')}</p>
                  </IonLabel>

                  <div className="chat-actions-dropdown" onClick={(event) => event.stopPropagation()}>
                    <details>
                      <summary aria-label={t('chat.actionsLabel')}>⋯</summary>
                      <div className="chat-actions-dropdown__menu">
                        <button type="button" onClick={() => renameChat(chat)}>
                          {t('chat.rename')}
                        </button>
                        <button type="button" className="is-danger" onClick={() => deleteChat(chat)}>
                          {t('chat.delete')}
                        </button>
                      </div>
                    </details>
                  </div>
                </IonItem>
              ))
            )}
          </IonList>
        </aside>

        <div className="chat-main-column">
          <IonContent fullscreen className="ion-padding chat-content-area">
            <div className="screen-stack">
              <TopCatBanner />

              {!selectedChat ? (
                <div className="section-card">
                  <p className="muted">{t('chat.emptyChats')}</p>
                  <div className="button-row">
                    <IonButton onClick={createChat}>{t('chat.newChat')}</IonButton>
                  </div>
                </div>
              ) : null}

              <div className="chat-messages-card">
                {messages.length === 0 ? (
                  <p className="muted">{t('chat.emptyMessages')}</p>
                ) : (
                  messages.map((message) => (
                    <div key={message.id} className={`chat-message ${message.role === 'user' ? 'is-user' : 'is-assistant'}`}>
                      <div className="chat-message__meta">
                        {t(`chat.role.${message.role}`)} • {t(`chat.status.${message.status}`)}
                      </div>
                      <div className="chat-message__body">{message.content}</div>
                      {message.role === 'assistant' && message.status === 'failed' ? (
                        <IonButton fill="clear" size="small" onClick={() => retryAssistant(message)}>
                          {t('chat.retry')}
                        </IonButton>
                      ) : null}
                    </div>
                  ))
                )}
              </div>

              {voiceState ? <IonText color="medium">{voiceState}</IonText> : null}
              {sendError ? <IonText color="danger">{sendError}</IonText> : null}
            </div>
          </IonContent>

          <div className="chat-composer-docked">
            <div className="chat-composer">
              <IonTextarea
                value={composerText}
                autoGrow
                rows={2}
                placeholder={t('chat.messageInput')}
                onIonInput={(event) => {
                  setComposerText(String(event.detail.value ?? ''))
                }}
              />
              <div className="button-row">
                <IonButton disabled={isSending || !composerText.trim()} onClick={() => sendMessage('text')}>
                  {isSending ? t('chat.sending') : t('chat.send')}
                </IonButton>
                <IonButton fill="outline" disabled={isSending} onClick={startVoiceInput}>
                  {t('chat.voiceToText')}
                </IonButton>
                <IonButton
                  fill="clear"
                  disabled={isSending || !composerText.trim()}
                  onClick={() => sendMessage('voice')}
                >
                  {t('chat.sendAsVoice')}
                </IonButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </IonPage>
  )
}
