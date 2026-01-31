// src/hooks/useClipboard.ts
import { useState, useCallback } from 'react'
import { useToast } from '@/components/ui/use-toast'

interface UseClipboardOptions {
  successMessage?: string
  errorMessage?: string
  timeout?: number
}

export function useClipboard(options: UseClipboardOptions = {}) {
  const {
    successMessage = 'Copied to clipboard',
    errorMessage = 'Failed to copy to clipboard',
    timeout = 2000,
  } = options

  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const copyToClipboard = useCallback(async (text: string): Promise<boolean> => {
    // Try modern clipboard API first
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), timeout)
        toast({
          title: 'Copied',
          description: successMessage,
        })
        return true
      } catch {
        // Fall through to fallback
      }
    }

    // Fallback for older browsers
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      textarea.style.top = '-9999px'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      const success = document.execCommand('copy')
      document.body.removeChild(textarea)

      if (success) {
        setCopied(true)
        setTimeout(() => setCopied(false), timeout)
        toast({
          title: 'Copied',
          description: successMessage,
        })
        return true
      }
    } catch {
      // Fall through to error
    }

    toast({
      title: 'Copy Failed',
      description: errorMessage,
      variant: 'destructive',
    })
    return false
  }, [successMessage, errorMessage, timeout, toast])

  return { copied, copyToClipboard }
}
