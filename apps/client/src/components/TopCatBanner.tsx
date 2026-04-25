import { useTranslation } from 'react-i18next'

export function TopCatBanner() {
  const { t } = useTranslation()

  return (
    <div className="top-cat-banner" aria-label={t('cat.title')}>
      <div className="top-cat-banner__icon">=^.^=</div>
      <div>
        <strong>{t('cat.title')}</strong>
        <p className="muted">{t('cat.description')}</p>
      </div>
    </div>
  )
}
