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
import { micOutline, paperPlaneOutline, menuOutline, settingsOutline } from 'ionicons/icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useCatState } from '../components/catState'
import { chatService } from '../services/chatService'
import type { Chat, Message, MessageSourceType } from '../types/chat'
import type { RecognitionWindow } from '../types/speechRecognition'

export function ChatPage() {
  const { t, i18n } = useTranslation()
  const { setActivity } = useCatState()
  const composerRef = useRef<HTMLIonTextareaElement>(null)
  const typingTimeoutRef = useRef<number | null>(null)
  const recognitionWindow = window as RecognitionWindow
  const SpeechRecognitionCtor =
    recognitionWindow.SpeechRecognition ?? recognitionWindow.webkitSpeechRecognition
  const isSpeechRecognitionSupported = Boolean(SpeechRecognitionCtor)
  const [chats, setChats] = useState<Chat[]>(() => chatService.listChats())
  const [selectedChatId, setSelectedChatId] = useState<string | null>(chats[0]?.id ?? null)
  const [, forceMessagesRefresh] = useState(0)
  const [composerText, setComposerText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [voiceState, setVoiceState] = useState('')
  const [isMicActive, setIsMicActive] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeMenu, setActiveMenu] = useState<{
    chat: Chat
    top: number
    right: number
  } | null>(null)

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.id === selectedChatId) ?? null,
    [chats, selectedChatId],
  )
  const messages = selectedChatId ? chatService.listMessages(selectedChatId) : []

  useEffect(() => {
    if (!activeMenu) {
      return
    }

    function closeMenu() {
      setActiveMenu(null)
    }

    window.addEventListener('click', closeMenu)
    window.addEventListener('resize', closeMenu)
    window.addEventListener('scroll', closeMenu, true)

    return () => {
      window.removeEventListener('click', closeMenu)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
    }
  }, [activeMenu])

  useEffect(() => () => {
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current)
    }
  }, [])

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
    setActiveMenu(null)
    refreshChats()
  }

  function openChatMenu(chat: Chat, target: HTMLElement) {
    const rect = target.getBoundingClientRect()
    setActiveMenu((current) =>
      current?.chat.id === chat.id
        ? null
        : {
          chat,
          top: rect.bottom + 4,
          right: Math.max(8, window.innerWidth - rect.right),
        },
    )
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
      window.requestAnimationFrame(() => {
        void composerRef.current?.setFocus()
      })
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
    if (!SpeechRecognitionCtor) {
      setActivity('idle')
      setIsMicActive(false)
      setVoiceState(t('chat.voiceUnsupported'))
      return
    }

    const recognition = new SpeechRecognitionCtor()
    recognition.lang = i18n.language === 'en' ? 'en-US' : 'ru-RU'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    setActivity('listening')
    setIsMicActive(true)
    setVoiceState(t('chat.voiceListening'))

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? ''
      if (transcript) {
        setComposerText((previous) => (previous ? `${previous} ${transcript}` : transcript))
      }
      setActivity('idle')
      setIsMicActive(false)
      setVoiceState(t('chat.voiceReady'))
    }

    recognition.onerror = () => {
      setActivity('idle')
      setIsMicActive(false)
      setVoiceState(t('chat.voiceError'))
    }

    recognition.onend = () => {
      setActivity('idle')
      setIsMicActive(false)
    }

    recognition.start()
  }

  function markCatTyping() {
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current)
    }

    setActivity('listening')
    typingTimeoutRef.current = window.setTimeout(() => {
      setActivity('idle')
      typingTimeoutRef.current = null
    }, 700)
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLIonTextareaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
      return
    }

    event.preventDefault()
    void sendMessage('text')
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
              null
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
                  </IonLabel>

                  <div className="chat-actions-dropdown" onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      className="chat-actions-dropdown__trigger"
                      aria-label={t('chat.actionsLabel')}
                      onClick={(event) => openChatMenu(chat, event.currentTarget)}
                    >
                      ⋯
                    </button>
                  </div>
                </IonItem>
              ))
            )}
          </IonList>
        </aside>

        <div className="chat-main-column">
          <IonContent className="ion-padding chat-content-area">
            <div className="screen-stack">
              {!selectedChat ? (
                <div className="chat-empty-state">
                  <p className="muted">{t('chat.emptyChats')}</p>
                  <IonButton onClick={createChat}>{t('chat.newChat')}</IonButton>
                </div>
              ) : (
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
              )}

              {voiceState ? <IonText color="medium">{voiceState}</IonText> : null}
              {sendError ? <IonText color="danger">{sendError}</IonText> : null}
            </div>
          </IonContent>

          <div className="chat-composer-docked">
            <div className="chat-composer">
              <IonTextarea
                ref={composerRef}
                value={composerText}
                autoGrow
                rows={2}
                placeholder={t('chat.messageInput')}
                onKeyDown={handleComposerKeyDown}
                onIonInput={(event) => {
                  setComposerText(String(event.detail.value ?? ''))
                  markCatTyping()
                }}
              />
              <div className="chat-composer__actions">
                <IonButton
                  className={`chat-composer__icon-button ${isMicActive ? 'is-recording' : ''}`}
                  fill="clear"
                  disabled={isSending || !isSpeechRecognitionSupported}
                  aria-label={
                    isSpeechRecognitionSupported
                      ? isMicActive ? t('chat.stopVoice') : t('chat.voiceToText')
                      : t('chat.voiceUnsupported')
                  }
                  onClick={startVoiceInput}
                >
                  <IonIcon slot="icon-only" icon={micOutline} />
                </IonButton>
                <IonButton
                  className="chat-composer__icon-button"
                  fill="clear"
                  disabled={isSending || !composerText.trim()}
                  aria-label={isSending ? t('chat.sending') : t('chat.send')}
                  onClick={() => sendMessage('text')}
                >
                  <IonIcon slot="icon-only" icon={paperPlaneOutline} />
                </IonButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      {activeMenu ? (
        <div
          className="chat-actions-dropdown__menu"
          style={{ top: activeMenu.top, right: activeMenu.right }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              renameChat(activeMenu.chat)
              setActiveMenu(null)
            }}
          >
            {t('chat.rename')}
          </button>
          <button
            type="button"
            className="is-danger"
            onClick={() => deleteChat(activeMenu.chat)}
          >
            {t('chat.delete')}
          </button>
        </div>
      ) : null}
    </IonPage>
  )
}
