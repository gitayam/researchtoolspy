import { useI18nStore } from '@/stores/i18n'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Globe } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function LanguageSwitcher() {
  const { language, setLanguage } = useI18nStore()
  const { i18n } = useTranslation()

  const handleLanguageChange = (lang: 'en' | 'es') => {
    setLanguage(lang)
    i18n.changeLanguage(lang)
    // Update HTML lang attribute for accessibility
    document.documentElement.lang = lang
  }

  const languageLabels = {
    en: 'English',
    es: 'Español'
  }

  const languageFlags = {
    en: '🇺🇸',
    es: '🇪🇸'
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">{languageLabels[language]}</span>
          <span className="sm:hidden">{languageFlags[language]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => handleLanguageChange('en')}
          className={language === 'en' ? 'bg-accent' : ''}
        >
          {languageFlags.en} English
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleLanguageChange('es')}
          className={language === 'es' ? 'bg-accent' : ''}
        >
          {languageFlags.es} Español
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
