import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { CatStateContext } from './catState'
import type { CatActivity } from './catState'

export function CatStateProvider({ children }: { children: ReactNode }) {
  const [activity, setActivity] = useState<CatActivity>('idle')
  const value = useMemo(() => ({ activity, setActivity }), [activity])

  return <CatStateContext.Provider value={value}>{children}</CatStateContext.Provider>
}
