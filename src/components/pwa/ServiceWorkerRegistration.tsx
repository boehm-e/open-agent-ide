'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Register service worker
      navigator.serviceWorker
        .register('/sw.js', { 
          scope: '/',
        })
        .then((registration) => {
          console.log('[PWA] Service Worker registered with scope:', registration.scope)
          
          // Check for updates
          registration.addEventListener('updatefound', () => {
            console.log('[PWA] Service Worker update found')
          })
          
          // Log registration state
          if (registration.installing) {
            console.log('[PWA] Service Worker installing')
          } else if (registration.waiting) {
            console.log('[PWA] Service Worker waiting')
          } else if (registration.active) {
            console.log('[PWA] Service Worker active')
          }
        })
        .catch((error) => {
          console.error('[PWA] Service Worker registration failed:', error)
        })
        
      // Check if there's already a controlled service worker
      if (navigator.serviceWorker.controller) {
        console.log('[PWA] Service Worker already controlling this page')
      }
      
      // Listen for controller changes
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[PWA] Service Worker controller changed')
      })
    } else {
      console.warn('[PWA] Service Workers are not supported in this browser')
    }
  }, [])

  return null
}
