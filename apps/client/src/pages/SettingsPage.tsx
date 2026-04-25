import {
  IonContent,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSegment,
  IonSegmentButton,
} from '@ionic/react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../components/PageHeader'

export function SettingsPage() {
  const { t, i18n } = useTranslation()

  return (
    <IonPage>
      <PageHeader title={t('pages.settingsTitle')} />
      <IonContent fullscreen className="ion-padding">
        <div className="screen-stack">
          <IonList inset>
            <IonItem>
              <IonLabel>{t('settings.language')}</IonLabel>
              <IonSegment
                value={i18n.language}
                onIonChange={(event) => {
                  const nextLanguage = event.detail.value
                  if (nextLanguage === 'ru' || nextLanguage === 'en') {
                    void i18n.changeLanguage(nextLanguage)
                  }
                }}
              >
                <IonSegmentButton value="ru">
                  <IonLabel>RU</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="en">
                  <IonLabel>EN</IonLabel>
                </IonSegmentButton>
              </IonSegment>
            </IonItem>
          </IonList>

          <div className="section-card">
            <strong>{t('settings.model')}</strong>
          </div>

          <div className="section-card">
            <strong>{t('settings.cat')}</strong>
          </div>
        </div>
      </IonContent>
    </IonPage>
  )
}
