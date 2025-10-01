import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/useTheme'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const nextTheme = isDark ? 'light' : 'dark'

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={'Switch to ' + nextTheme + ' mode'}
      className="transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
      title={'Current theme: ' + theme}
    >
      {isDark ? (
        <Sun className="h-5 w-5 text-gray-400 dark:text-gray-300" />
      ) : (
        <Moon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
      )}
    </Button>
  )
}
