import {
  IonButton,
  IonContent,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonText,
  IonTextarea,
} from '@ionic/react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCatState } from '../components/catState'
import { PageHeader } from '../components/PageHeader'
import { aiService } from '../services/aiService'
import { notesService } from '../services/notesService'
import type { Note } from '../types/note'
import type { RecognitionWindow } from '../types/speechRecognition'

export function NotesPage() {
  const { t, i18n } = useTranslation()
  const { setActivity } = useCatState()
  const [notes, setNotes] = useState<Note[]>(() => notesService.list())
  const [selectedId, setSelectedId] = useState<string | null>(notes[0]?.id ?? null)
  const [viewMode, setViewMode] = useState<'processed' | 'original'>('processed')
  const [isProcessing, setIsProcessing] = useState(false)
  const [processError, setProcessError] = useState('')
  const [voiceState, setVoiceState] = useState('')

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedId) ?? null,
    [notes, selectedId],
  )

  function refreshSelection(nextNotes: Note[], fallbackId?: string) {
    setNotes(nextNotes)

    if (!nextNotes.length) {
      setSelectedId(null)
      return
    }

    const targetId = fallbackId ?? selectedId
    const hasTarget = targetId ? nextNotes.some((note) => note.id === targetId) : false
    setSelectedId(hasTarget ? targetId : nextNotes[0].id)
  }

  function createNote() {
    const language: 'ru' | 'en' = i18n.language === 'en' ? 'en' : 'ru'
    const note = notesService.createDraft(language)
    const nextNotes = notesService.list()
    refreshSelection(nextNotes, note.id)
  }

  function updateCurrentNote(patch: (note: Note) => Note) {
    if (!selectedNote) {
      return
    }

    patch(selectedNote)
    refreshSelection(notesService.list(), selectedNote.id)
  }

  function deleteCurrentNote() {
    if (!selectedNote) {
      return
    }

    const nextNotes = notesService.remove(selectedNote.id)
    refreshSelection(nextNotes)
  }

  function startVoiceInput() {
    const recognitionWindow = window as RecognitionWindow
    const SpeechRecognitionCtor =
      recognitionWindow.SpeechRecognition ?? recognitionWindow.webkitSpeechRecognition

    if (!SpeechRecognitionCtor) {
      setActivity('idle')
      setVoiceState(t('notes.voiceUnsupported'))
      return
    }

    const language: 'ru' | 'en' = i18n.language === 'en' ? 'en' : 'ru'
    const activeNote = selectedNote ?? notesService.createDraft(language)
    refreshSelection(notesService.list(), activeNote.id)

    const recognition = new SpeechRecognitionCtor()
    recognition.lang = language === 'en' ? 'en-US' : 'ru-RU'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    setActivity('writing')
    setVoiceState(t('notes.voiceWriting'))

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? ''
      if (transcript) {
        const currentNote = notesService.list().find((note) => note.id === activeNote.id) ?? activeNote
        const nextText = currentNote.originalText.trim()
          ? `${currentNote.originalText.trim()} ${transcript}`
          : transcript

        notesService.updateDraftContent(currentNote, nextText)
        refreshSelection(notesService.list(), activeNote.id)
        setViewMode('original')
      }

      setActivity('idle')
      setVoiceState(t('notes.voiceReady'))
    }

    recognition.onerror = () => {
      setActivity('idle')
      setVoiceState(t('notes.voiceError'))
    }

    recognition.onend = () => {
      setActivity('idle')
    }

    recognition.start()
  }

  async function processCurrentNote() {
    if (!selectedNote || isProcessing) {
      return
    }

    const text = selectedNote.originalText.trim()
    if (!text) {
      setProcessError(t('notes.emptyOriginal'))
      return
    }

    setIsProcessing(true)
    setProcessError('')

    try {
      const response = await aiService.summarizeNote({
        text,
        language: selectedNote.language,
      })

      notesService.applyAiResult(selectedNote, {
        processedText: response.processedText,
        summary: response.summary,
        title: response.title,
      })

      refreshSelection(notesService.list(), selectedNote.id)
      setViewMode('processed')
    } catch (error) {
      notesService.markError(selectedNote)
      refreshSelection(notesService.list(), selectedNote.id)
      setProcessError(
        error instanceof Error ? `${t('notes.processError')} ${error.message}` : t('notes.processError'),
      )
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <IonPage>
      <PageHeader title={t('pages.notesTitle')} />
      <IonContent fullscreen className="ion-padding">
        <div className="screen-stack">
          <div className="section-card">
            <h2>{t('pages.notesTitle')}</h2>
            <p className="muted">{t('pages.notesSubtitle')}</p>
            <div className="button-row">
              <IonButton onClick={createNote}>{t('notes.newNote')}</IonButton>
              <IonButton fill="outline" onClick={startVoiceInput}>
                {t('notes.voiceInput')}
              </IonButton>
            </div>
            {voiceState ? <IonText color="medium">{voiceState}</IonText> : null}
          </div>

          <div className="section-card">
            <IonList inset>
              {notes.length === 0 ? (
                <IonItem lines="none">
                  <IonLabel>{t('notes.empty')}</IonLabel>
                </IonItem>
              ) : (
                notes.map((note) => (
                  <IonItem
                    key={note.id}
                    button
                    detail={false}
                    onClick={() => {
                      setSelectedId(note.id)
                      setViewMode('processed')
                    }}
                  >
                    <IonLabel>
                      <h3>{note.title}</h3>
                      <p>{note.summary || t('notes.noSummary')}</p>
                    </IonLabel>
                  </IonItem>
                ))
              )}
            </IonList>
          </div>

          {selectedNote ? (
            <div className="section-card">
              <div className="screen-stack">
                <IonItem>
                  <IonLabel position="stacked">{t('notes.titleField')}</IonLabel>
                  <IonInput
                    value={selectedNote.title}
                    onIonInput={(event) => {
                      updateCurrentNote((note) =>
                        notesService.rename(note, String(event.detail.value ?? '')),
                      )
                    }}
                  />
                </IonItem>

                <IonItem>
                  <IonLabel position="stacked">{t('notes.originalText')}</IonLabel>
                  <IonTextarea
                    value={selectedNote.originalText}
                    autoGrow
                    rows={6}
                    onIonInput={(event) => {
                      updateCurrentNote((note) =>
                        notesService.updateDraftContent(note, String(event.detail.value ?? '')),
                      )
                    }}
                  />
                </IonItem>

                <div className="button-row">
                  <IonButton
                    disabled={isProcessing}
                    onClick={processCurrentNote}
                  >
                    {isProcessing ? t('notes.processing') : t('notes.process')}
                  </IonButton>

                  <IonButton
                    fill="outline"
                    onClick={() => {
                      setViewMode((prev) =>
                        prev === 'processed' ? 'original' : 'processed',
                      )
                    }}
                  >
                    {viewMode === 'processed'
                      ? t('notes.showOriginal')
                      : t('notes.showProcessed')}
                  </IonButton>

                  <IonButton color="danger" fill="clear" onClick={deleteCurrentNote}>
                    {t('notes.delete')}
                  </IonButton>
                </div>

                <IonItem>
                  <IonLabel position="stacked">
                    {viewMode === 'processed'
                      ? t('notes.processedText')
                      : t('notes.originalText')}
                  </IonLabel>
                  <IonText>
                    <p className="preview-block">
                      {viewMode === 'processed'
                        ? selectedNote.processedText || t('notes.nothingProcessed')
                        : selectedNote.originalText || t('notes.emptyOriginal')}
                    </p>
                  </IonText>
                </IonItem>

                {processError ? <IonText color="danger">{processError}</IonText> : null}

                <IonItem>
                  <IonLabel>
                    <h3>{t('notes.summary')}</h3>
                    <p>{selectedNote.summary || t('notes.noSummary')}</p>
                    <p>{t(`notes.status.${selectedNote.status}`)}</p>
                  </IonLabel>
                </IonItem>
              </div>
            </div>
          ) : null}

        </div>
      </IonContent>
    </IonPage>
  )
}
