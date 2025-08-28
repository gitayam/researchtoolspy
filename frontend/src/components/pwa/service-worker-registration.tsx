'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('SW registered: ', registration)
            
            // Check for updates
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New service worker is installed and ready
                    console.log('New service worker available')
                    // You could show a notification to the user here
                  }
                })
              }
            })
          })
          .catch((registrationError) => {
            console.log('SW registration failed: ', registrationError)
          })
      })
    }
  }, [])

  return null
}

export function useInstallPrompt() {
  useEffect(() => {
    let deferredPrompt: any = null

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault()
      // Stash the event so it can be triggered later
      deferredPrompt = e
      console.log('PWA install prompt available')
    }

    const handleAppInstalled = () => {
      console.log('PWA was installed')
      deferredPrompt = null
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const promptInstall = () => {
    // This would be used in a component to trigger install
    // Implementation would depend on storing deferredPrompt in context/state
  }

  return { promptInstall }
}