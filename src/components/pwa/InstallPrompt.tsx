'use client'

import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string[]>([])

  const addDebug = (msg: string) => {
    console.log('[PWA Debug]', msg)
    setDebugInfo(prev => [...prev, `${new Date().toISOString().split('T')[1].slice(0, 8)}: ${msg}`])
  }

  useEffect(() => {
    addDebug('InstallPrompt mounted')
    
    // Check if already installed (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    const isIOSStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true
    
    addDebug(`display-mode standalone: ${isStandalone}`)
    addDebug(`iOS standalone: ${isIOSStandalone}`)
    
    if (isStandalone || isIOSStandalone) {
      setIsInstalled(true)
      addDebug('Already installed, hiding prompt')
      return
    }

    // Check device type
    const userAgent = navigator.userAgent
    const isIOSDevice = /iPad|iPhone|iPod/.test(userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream
    const isAndroidDevice = /Android/.test(userAgent)
    
    setIsIOS(isIOSDevice)
    setIsAndroid(isAndroidDevice)
    addDebug(`iOS device: ${isIOSDevice}`)
    addDebug(`Android device: ${isAndroidDevice}`)

    // Check service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        addDebug(`SW registered: ${!!reg}`)
        if (reg) {
          addDebug(`SW scope: ${reg.scope}`)
        }
      }).catch(err => {
        addDebug(`SW check error: ${err.message}`)
      })
    } else {
      addDebug('Service Worker not supported')
    }

    // Listen for the beforeinstallprompt event (Chrome, Edge, etc.)
    const handleBeforeInstallPrompt = (e: Event) => {
      addDebug('beforeinstallprompt event fired!')
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Listen for app installed event
    const handleAppInstalled = () => {
      addDebug('App installed event fired!')
      setIsInstalled(true)
      setDeferredPrompt(null)
      setShowPrompt(false)
    }

    window.addEventListener('appinstalled', handleAppInstalled)

    // For iOS, show prompt after a delay
    if (isIOSDevice) {
      setTimeout(() => {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches
        const isIOSStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true
        if (!isStandalone && !isIOSStandalone) {
          addDebug('Showing iOS install prompt')
          setShowPrompt(true)
        }
      }, 3000)
    }

    // For Android without beforeinstallprompt, show after delay
    if (isAndroidDevice) {
      setTimeout(() => {
        if (!deferredPrompt && !window.matchMedia('(display-mode: standalone)').matches) {
          addDebug('Android: checking for manual prompt')
        }
      }, 5000)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    addDebug('Install button clicked')
    if (deferredPrompt) {
      addDebug('Calling prompt()')
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      addDebug(`User choice: ${outcome}`)
      if (outcome === 'accepted') {
        setIsInstalled(true)
      }
      setDeferredPrompt(null)
      setShowPrompt(false)
    }
  }

  const handleDismiss = () => {
    addDebug('Prompt dismissed')
    setShowPrompt(false)
  }

  // Don't show if already installed
  if (isInstalled) {
    return null
  }

  return (
    <>
      {/* Debug Panel - Remove in production */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-4 right-4 bg-black/80 text-green-400 text-xs p-2 rounded max-w-xs max-h-40 overflow-auto z-[100] font-mono">
          {debugInfo.map((info, i) => (
            <div key={i}>{info}</div>
          ))}
        </div>
      )}
      
      {/* Install Prompt */}
      {showPrompt && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg p-4 z-50">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <img 
                src="/icons/icon-96x96.png" 
                alt="Open Web Agent" 
                className="w-12 h-12 rounded-lg"
              />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold text-sm">Install Open Web Agent</h3>
              <p className="text-zinc-400 text-xs mt-1">
                Install this app on your device for a better experience and offline access.
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
              aria-label="Dismiss"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          
          {isIOS ? (
            <div className="mt-3 text-xs text-zinc-400">
              <p>
                To install, tap the share button{' '}
                <span className="inline-block">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                    <polyline points="16 6 12 2 8 6"></polyline>
                    <line x1="12" y1="2" x2="12" y2="15"></line>
                  </svg>
                </span>{' '}
                then "Add to Home Screen"{' '}
                <span className="inline-block">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </span>
              </p>
            </div>
          ) : deferredPrompt ? (
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleDismiss}
                className="flex-1 px-3 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Not now
              </button>
              <button
                onClick={handleInstallClick}
                className="flex-1 px-3 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors"
              >
                Install
              </button>
            </div>
          ) : (
            <div className="mt-3 text-xs text-zinc-400">
              <p>
                To install, open Chrome menu{' '}
                <span className="inline-block">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline">
                    <circle cx="12" cy="12" r="1"></circle>
                    <circle cx="19" cy="12" r="1"></circle>
                    <circle cx="5" cy="12" r="1"></circle>
                  </svg>
                </span>{' '}
                and tap "Install app" or "Add to Home Screen".
              </p>
            </div>
          )}
        </div>
      )}
    </>
  )
}
