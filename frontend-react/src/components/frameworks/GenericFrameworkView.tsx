import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface FrameworkItem {
  id: string
  text: string
}

interface FrameworkSection {
  key: string
  label: string
  color: string
  bgColor: string
  icon: string
}

interface GenericFrameworkData {
  id: string
  title: string
  description: string
  created_at?: string
  updated_at?: string
  [key: string]: any
}

interface GenericFrameworkViewProps {
  data: GenericFrameworkData
  sections: FrameworkSection[]
  frameworkTitle: string
  onEdit: () => void
  onDelete: () => void
  backPath: string
}

export function GenericFrameworkView({
  data,
  sections,
  frameworkTitle,
  onEdit,
  onDelete,
  backPath
}: GenericFrameworkViewProps) {
  const navigate = useNavigate()

  const SectionView = ({
    section,
    items
  }: {
    section: FrameworkSection
    items: FrameworkItem[]
  }) => (
    <Card className={`border-l-4 ${section.color}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl">{section.icon}</span>
          {section.label}
          <Badge variant="secondary" className="ml-auto">
            {items.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
            No {section.label.toLowerCase()} identified
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, index) => (
              <li
                key={item.id}
                className={`p-3 rounded-lg ${section.bgColor} text-sm`}
              >
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {index + 1}.
                </span>{' '}
                {item.text}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate(backPath)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {data.title}
            </h1>
            {data.description && (
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {data.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Metadata */}
      {(data.created_at || data.updated_at) && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-6 text-sm text-gray-600 dark:text-gray-400">
              {data.created_at && (
                <div>
                  <span className="font-medium">Created:</span>{' '}
                  {new Date(data.created_at).toLocaleDateString()}
                </div>
              )}
              {data.updated_at && (
                <div>
                  <span className="font-medium">Last Updated:</span>{' '}
                  {new Date(data.updated_at).toLocaleDateString()}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`grid grid-cols-${sections.length} gap-4 text-center`}>
            {sections.map(section => (
              <div key={section.key} className={`p-4 rounded-lg ${section.bgColor}`}>
                <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {data[section.key]?.length || 0}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {section.label}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Framework Sections */}
      <div className={`grid grid-cols-1 ${sections.length === 4 ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-6`}>
        {sections.map(section => (
          <SectionView
            key={section.key}
            section={section}
            items={data[section.key] || []}
          />
        ))}
      </div>
    </div>
  )
}
