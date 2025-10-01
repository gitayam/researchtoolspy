import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    // 1. Check localStorage first (user preference)
    const stored = localStorage.getItem('theme') as Theme | null
    if (stored === 'light' || stored === 'dark') {
      applyTheme(stored)
      return
    }

    // 2. Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    applyTheme(prefersDark ? 'dark' : 'light')
  }, [])

  const applyTheme = (newTheme: Theme) => {
    setTheme(newTheme)
    document.documentElement.classList.toggle('dark', newTheme === 'dark')
  }

  const toggleTheme = () => {
    const newTheme: Theme = theme === 'light' ? 'dark' : 'light'
    applyTheme(newTheme)
    localStorage.setItem('theme', newTheme)
  }

  return { theme, toggleTheme, isDark: theme === 'dark' }
}
