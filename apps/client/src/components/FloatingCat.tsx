import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useCatState } from './catState'

const routeOrder = ['/notes', '/chat', '/settings']

function getRouteIndex(pathname: string) {
  const normalizedPath = pathname === '/' ? '/notes' : pathname
  const index = routeOrder.indexOf(normalizedPath)
  return index === -1 ? routeOrder.length : index
}

export function FloatingCat() {
  const location = useLocation()
  const { activity } = useCatState()
  const previousPath = useRef(location.pathname)
  const [jumpDirection, setJumpDirection] = useState<'left' | 'right' | null>(null)
  const [isJumping, setIsJumping] = useState(false)
  const [isLanding, setIsLanding] = useState(false)
  const [activityFrame, setActivityFrame] = useState(0)

  useEffect(() => {
    if (previousPath.current === location.pathname) {
      return
    }

    const previousIndex = getRouteIndex(previousPath.current)
    const nextIndex = getRouteIndex(location.pathname)
    const nextDirection = nextIndex >= previousIndex ? 'right' : 'left'

    previousPath.current = location.pathname
    setJumpDirection(nextDirection)
    setIsJumping(true)
    setIsLanding(false)

    const jumpTimeoutId = window.setTimeout(() => {
      setIsJumping(false)
      setIsLanding(true)
    }, 430)

    const landingTimeoutId = window.setTimeout(() => {
      setIsLanding(false)
    }, 650)

    return () => {
      window.clearTimeout(jumpTimeoutId)
      window.clearTimeout(landingTimeoutId)
    }
  }, [location.pathname])

  useEffect(() => {
    if (activity === 'idle' || isJumping) {
      return
    }

    const intervalId = window.setInterval(() => {
      setActivityFrame((frame) => (frame === 0 ? 1 : 0))
    }, activity === 'writing' ? 320 : 420)

    return () => window.clearInterval(intervalId)
  }, [activity, isJumping])

  const directionClass = (isJumping || isLanding) && jumpDirection ? `is-jumping-${jumpDirection}` : ''
  const resolvedActivityFrame = activity === 'idle' || isJumping ? 0 : activityFrame
  const catImage = isJumping
    ? '/cats/jump.png'
    : isLanding
      ? '/cats/landed.png'
    : activity === 'listening'
      ? `/cats/listening${resolvedActivityFrame + 1}.png`
      : activity === 'writing'
        ? `/cats/writing${resolvedActivityFrame + 1}.png`
        : '/cats/sits.png'

  return (
    <div
      className={`floating-cat ${directionClass} ${isLanding ? 'is-landing' : ''} is-${activity}`}
      aria-hidden="true"
    >
      <img className="floating-cat__image" src={catImage} alt="" />
    </div>
  )
}
