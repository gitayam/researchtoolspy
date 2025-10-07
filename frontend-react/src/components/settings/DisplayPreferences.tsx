/**
 * Display Preferences Component
 *
 * UI for managing display and appearance settings
 */

import { useCallback } from 'react'
import { Monitor, Moon, Sun, Type, Layout, Sparkles } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { DisplaySettings, Theme, Language, Density, SidebarBehavior, FontSize } from '@/types/settings'

interface DisplayPreferencesProps {
  settings: DisplaySettings
  onUpdate: (updates: Partial<DisplaySettings>) => Promise<void>
  updating?: boolean
}

export function DisplayPreferences({ settings, onUpdate, updating = false }: DisplayPreferencesProps) {
  const handleThemeChange = useCallback(
    async (theme: Theme) => {
      await onUpdate({ theme })

      // Apply theme immediately
      if (theme === 'dark') {
        document.documentElement.classList.add('dark')
      } else if (theme === 'light') {
        document.documentElement.classList.remove('dark')
      } else {
        // System preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        document.documentElement.classList.toggle('dark', prefersDark)
      }
    },
    [onUpdate]
  )

  const handleLanguageChange = useCallback(
    async (language: Language) => {
      await onUpdate({ language })

      // Update i18n if available
      if (window.i18n && window.i18n.changeLanguage) {
        window.i18n.changeLanguage(language)
      }
      document.documentElement.lang = language
    },
    [onUpdate]
  )

  return (
    <div className="space-y-6">
      {/* Theme Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="h-5 w-5" />
            Theme
          </CardTitle>
          <CardDescription>
            Choose your preferred color scheme
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={settings.theme}
            onValueChange={(value) => handleThemeChange(value as Theme)}
            className="grid grid-cols-3 gap-4"
            disabled={updating}
          >
            <div>
              <RadioGroupItem value="light" id="theme-light" className="peer sr-only" />
              <Label
                htmlFor="theme-light"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <Sun className="mb-3 h-6 w-6" />
                Light
              </Label>
            </div>
            <div>
              <RadioGroupItem value="dark" id="theme-dark" className="peer sr-only" />
              <Label
                htmlFor="theme-dark"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <Moon className="mb-3 h-6 w-6" />
                Dark
              </Label>
            </div>
            <div>
              <RadioGroupItem value="system" id="theme-system" className="peer sr-only" />
              <Label
                htmlFor="theme-system"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <Monitor className="mb-3 h-6 w-6" />
                System
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Language Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Language
          </CardTitle>
          <CardDescription>
            Choose your preferred language
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={settings.language}
            onValueChange={(value) => handleLanguageChange(value as Language)}
            disabled={updating}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Español</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Density */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layout className="h-5 w-5" />
            Density
          </CardTitle>
          <CardDescription>
            Adjust spacing and component sizing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={settings.density}
            onValueChange={(value) => onUpdate({ density: value as Density })}
            disabled={updating}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="compact">Compact - More content, less spacing</SelectItem>
              <SelectItem value="comfortable">Comfortable - Balanced (Recommended)</SelectItem>
              <SelectItem value="spacious">Spacious - More whitespace, easier reading</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Sidebar Behavior */}
      <Card>
        <CardHeader>
          <CardTitle>Sidebar Behavior</CardTitle>
          <CardDescription>
            How the sidebar should behave on smaller screens
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={settings.sidebar_behavior}
            onValueChange={(value) => onUpdate({ sidebar_behavior: value as SidebarBehavior })}
            disabled={updating}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="always_open">Always Open - Sidebar stays visible</SelectItem>
              <SelectItem value="auto_collapse">Auto Collapse - Collapse on mobile (Recommended)</SelectItem>
              <SelectItem value="manual">Manual - You control open/close</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Font Size */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="h-5 w-5" />
            Font Size
          </CardTitle>
          <CardDescription>
            Adjust text size for better readability
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={settings.font_size}
            onValueChange={(value) => onUpdate({ font_size: value as FontSize })}
            disabled={updating}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Small - 14px</SelectItem>
              <SelectItem value="medium">Medium - 16px (Default)</SelectItem>
              <SelectItem value="large">Large - 18px</SelectItem>
              <SelectItem value="x-large">Extra Large - 20px</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* UI Enhancements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            UI Enhancements
          </CardTitle>
          <CardDescription>
            Toggle visual enhancements and effects
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="tooltips">Tooltips</Label>
              <p className="text-sm text-muted-foreground">
                Show helpful tooltips on hover
              </p>
            </div>
            <Switch
              id="tooltips"
              checked={settings.show_tooltips}
              onCheckedChange={(checked) => onUpdate({ show_tooltips: checked })}
              disabled={updating}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="animations">Animations</Label>
              <p className="text-sm text-muted-foreground">
                Enable smooth transitions and effects
              </p>
            </div>
            <Switch
              id="animations"
              checked={settings.animation_enabled}
              onCheckedChange={(checked) => onUpdate({ animation_enabled: checked })}
              disabled={updating}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Extend Window type for i18n
declare global {
  interface Window {
    i18n?: {
      changeLanguage: (lang: string) => void
    }
  }
}
