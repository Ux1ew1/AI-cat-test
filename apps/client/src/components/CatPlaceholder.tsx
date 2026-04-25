import { useTranslation } from 'react-i18next'

export function CatPlaceholder() {
  const { t } = useTranslation()

  return (
    <div className="cat-placeholder">
      <strong>{t('cat.title')}</strong>
      <p className="muted">{t('cat.description')}</p>
    </div>
  )
}
