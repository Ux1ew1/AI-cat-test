import { IonButton, IonButtons, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/react'
import { settingsOutline } from 'ionicons/icons'
import { useTranslation } from 'react-i18next'

type PageHeaderProps = {
  title: string
}

export function PageHeader({ title }: PageHeaderProps) {
  const { t } = useTranslation()

  return (
    <IonHeader translucent>
      <IonToolbar>
        <IonTitle>{title}</IonTitle>
        <IonButtons slot="end">
          <IonButton routerLink="/settings" aria-label={t('common.openSettings')}>
            <IonIcon slot="icon-only" icon={settingsOutline} />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>
  )
}
