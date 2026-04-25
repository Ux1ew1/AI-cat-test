import { Redirect, Route } from 'react-router-dom'
import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  setupIonicReact,
} from '@ionic/react'
import { IonReactRouter } from '@ionic/react-router'
import { chatbubblesOutline, documentTextOutline } from 'ionicons/icons'
import { useTranslation } from 'react-i18next'
import { NotesPage } from './pages/NotesPage'
import { ChatPage } from './pages/ChatPage'
import { SettingsPage } from './pages/SettingsPage'
import './theme/ionic.css'
import './App.css'

setupIonicReact()

function App() {
  const { t } = useTranslation()

  return (
    <IonApp>
      <IonReactRouter>
        <IonTabs>
          <IonRouterOutlet>
            <Route exact path="/notes" component={NotesPage} />
            <Route exact path="/chat" component={ChatPage} />
            <Route exact path="/settings" component={SettingsPage} />
            <Route exact path="/">
              <Redirect to="/notes" />
            </Route>
          </IonRouterOutlet>

          <IonTabBar slot="bottom">
            <IonTabButton tab="notes" href="/notes">
              <IonIcon icon={documentTextOutline} />
              <IonLabel>{t('tabs.notes')}</IonLabel>
            </IonTabButton>
            <IonTabButton tab="chat" href="/chat">
              <IonIcon icon={chatbubblesOutline} />
              <IonLabel>{t('tabs.chat')}</IonLabel>
            </IonTabButton>
          </IonTabBar>
        </IonTabs>
      </IonReactRouter>
    </IonApp>
  )
}

export default App
