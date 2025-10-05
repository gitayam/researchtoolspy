import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, Globe, FileText, Link as LinkIcon, Code, Database, Share2, FileStack, ArrowLeft, Grid3x3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function ToolsPage() {
  const { toolId } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [searchTerm, setSearchTerm] = useState('')

  const tools = [
    {
      id: 'content-extraction',
      name: t('toolsPage.contentExtractionName'),
      description: t('toolsPage.contentExtractionDesc'),
      icon: FileText,
      features: t('toolsPage.contentExtractionFeatures', { returnObjects: true }) as string[]
    },
    {
      id: 'batch-processing',
      name: t('toolsPage.batchProcessingName'),
      description: t('toolsPage.batchProcessingDesc'),
      icon: FileStack,
      features: t('toolsPage.batchProcessingFeatures', { returnObjects: true }) as string[]
    },
    {
      id: 'url',
      name: t('toolsPage.urlProcessingName'),
      description: t('toolsPage.urlProcessingDesc'),
      icon: Globe,
      features: t('toolsPage.urlProcessingFeatures', { returnObjects: true }) as string[]
    },
    {
      id: 'citations-generator',
      name: t('toolsPage.citationsGeneratorName'),
      description: t('toolsPage.citationsGeneratorDesc'),
      icon: LinkIcon,
      features: t('toolsPage.citationsGeneratorFeatures', { returnObjects: true }) as string[]
    },
    {
      id: 'ach',
      name: t('toolsPage.achName'),
      description: t('toolsPage.achDesc'),
      icon: Grid3x3,
      features: t('toolsPage.achFeatures', { returnObjects: true }) as string[]
    },
    {
      id: 'scraping',
      name: t('toolsPage.webScrapingName'),
      description: t('toolsPage.webScrapingDesc'),
      icon: Code,
      features: t('toolsPage.webScrapingFeatures', { returnObjects: true }) as string[]
    },
    {
      id: 'social-media',
      name: t('toolsPage.socialMediaName'),
      description: t('toolsPage.socialMediaDesc'),
      icon: Share2,
      features: t('toolsPage.socialMediaFeatures', { returnObjects: true }) as string[]
    },
    {
      id: 'documents',
      name: t('toolsPage.documentsName'),
      description: t('toolsPage.documentsDesc'),
      icon: Database,
      features: t('toolsPage.documentsFeatures', { returnObjects: true }) as string[]
    }
  ]

  const filteredTools = tools.filter(tool =>
    tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tool.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // If toolId is provided, show the specific tool detail
  if (toolId) {
    const tool = tools.find(t => t.id === toolId)
    if (!tool) {
      return (
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{t('toolsPage.toolNotFound')}</h2>
          <Button onClick={() => navigate('/dashboard/tools')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('toolsPage.backToTools')}
          </Button>
        </div>
      )
    }

    const Icon = tool.icon

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/dashboard/tools')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('toolsPage.back')}
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <Icon className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{tool.name}</h1>
                <p className="text-gray-600 dark:text-gray-400">{tool.description}</p>
              </div>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('toolsPage.features')}</CardTitle>
            <CardDescription>{t('toolsPage.featuresDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {tool.features.map((feature, index) => (
                <li key={index} className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-center py-8">
              <Icon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{t('toolsPage.comingSoon')}</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {t('toolsPage.comingSoonDesc')}
              </p>
              <Button disabled>
                {t('toolsPage.launchTool')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show tools list
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('toolsPage.title')}</h1>
        <p className="text-gray-600 dark:text-gray-400">{t('toolsPage.subtitle')}</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder={t('toolsPage.searchPlaceholder')}
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTools.map((tool) => {
          const Icon = tool.icon
          return (
            <Card
              key={tool.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/dashboard/tools/${tool.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <Icon className="h-8 w-8 text-blue-600" />
                </div>
                <CardTitle className="mt-4">{tool.name}</CardTitle>
                <CardDescription>{tool.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {tool.features.slice(0, 3).map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <div className="h-1 w-1 rounded-full bg-blue-600" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
