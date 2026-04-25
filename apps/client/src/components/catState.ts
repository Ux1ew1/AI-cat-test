import { createContext, useContext } from 'react'

export type CatActivity = 'idle' | 'listening' | 'writing'

export type CatStateContextValue = {
  activity: CatActivity
  setActivity: (activity: CatActivity) => void
}

export const CatStateContext = createContext<CatStateContextValue | null>(null)

export function useCatState() {
  const context = useContext(CatStateContext)

  if (!context) {
    throw new Error('useCatState must be used within CatStateProvider')
  }

  return context
}
