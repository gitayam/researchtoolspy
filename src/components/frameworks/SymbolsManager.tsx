import { useState, useRef, type ChangeEvent } from 'react'
import { Plus, X, Eye, Volume2, Users, HelpCircle, Upload, Edit2, Check, Image as ImageIcon, Link as LinkIcon, Music } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { SymbolItem, SymbolType } from '@/types/behavior'

interface SymbolsManagerProps {
  symbols: SymbolItem[]
  onChange: (symbols: SymbolItem[]) => void
}

const symbolTypeLabels: Record<SymbolType, string> = {
  visual: 'Visual',
  auditory: 'Auditory',
  social: 'Social',
  other: 'Other'
}

const symbolTypeIcons: Record<SymbolType, any> = {
  visual: Eye,
  auditory: Volume2,
  social: Users,
  other: HelpCircle
}

const symbolTypeColors: Record<SymbolType, string> = {
  visual: 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 text-blue-800 dark:text-blue-200',
  auditory: 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 text-purple-800 dark:text-purple-200',
  social: 'bg-green-50 dark:bg-green-900/20 border-green-300 text-green-800 dark:text-green-200',
  other: 'bg-gray-50 dark:bg-gray-800 border-gray-300 text-gray-800 dark:text-gray-200'
}

const symbolTypeDescriptions: Record<SymbolType, string> = {
  visual: 'Images, logos, colors, clothing, badges, signs',
  auditory: 'Sounds, music, verbal phrases, audio cues',
  social: 'Gestures, behaviors, social markers, status symbols',
  other: 'Other types of symbols or signals'
}

export function SymbolsManager({ symbols, onChange }: SymbolsManagerProps) {
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<SymbolType>('visual')
  const [newDescription, setNewDescription] = useState('')
  const [newContext, setNewContext] = useState('')
  const [newImageData, setNewImageData] = useState<string>('')
  const [newAudioData, setNewAudioData] = useState<string>('')
  const [newMediaMode, setNewMediaMode] = useState<'upload' | 'link'>('upload')
  const [newImageUrl, setNewImageUrl] = useState<string>('')
  const [newAudioUrl, setNewAudioUrl] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioFileInputRef = useRef<HTMLInputElement>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState<SymbolType>('visual')
  const [editDescription, setEditDescription] = useState('')
  const [editContext, setEditContext] = useState('')
  const [editImageData, setEditImageData] = useState<string>('')
  const [editAudioData, setEditAudioData] = useState<string>('')
  const [editMediaMode, setEditMediaMode] = useState<'upload' | 'link'>('upload')
  const [editImageUrl, setEditImageUrl] = useState<string>('')
  const [editAudioUrl, setEditAudioUrl] = useState<string>('')
  const editFileInputRef = useRef<HTMLInputElement>(null)
  const editAudioFileInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>, isEdit: boolean = false) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB')
      return
    }

    // Convert to base64
    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      if (isEdit) {
        setEditImageData(base64)
      } else {
        setNewImageData(base64)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleAudioUpload = async (e: ChangeEvent<HTMLInputElement>, isEdit: boolean = false) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('audio/')) {
      alert('Please upload an audio file')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Audio must be less than 10MB')
      return
    }

    // Convert to base64
    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      if (isEdit) {
        setEditAudioData(base64)
      } else {
        setNewAudioData(base64)
      }
    }
    reader.readAsDataURL(file)
  }

  const validateMediaUrl = (url: string, type: 'image' | 'audio'): boolean => {
    if (!url.trim()) return false
    try {
      const urlObj = new URL(url)
      if (type === 'image') {
        return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(urlObj.pathname) || url.includes('imgur') || url.includes('cloudinary')
      } else {
        return /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(urlObj.pathname) || url.includes('soundcloud') || url.includes('audio')
      }
    } catch {
      return false
    }
  }

  const handleAdd = () => {
    if (!newName.trim()) {
      alert('Please enter a symbol name')
      return
    }

    const symbolItem: SymbolItem = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      symbol_type: newType,
      description: newDescription.trim() || undefined,
      context: newContext.trim() || undefined,
      media_source: newMediaMode,
    }

    // Add media based on mode and type
    if (newMediaMode === 'upload') {
      if (newType === 'auditory') {
        symbolItem.audio_data = newAudioData || undefined
      } else {
        symbolItem.image_data = newImageData || undefined
      }
    } else {
      // Link mode
      if (newType === 'auditory') {
        symbolItem.audio_url = newAudioUrl.trim() || undefined
      } else {
        symbolItem.image_url = newImageUrl.trim() || undefined
      }
    }

    onChange([...symbols, symbolItem])

    // Reset form
    setNewName('')
    setNewType('visual')
    setNewDescription('')
    setNewContext('')
    setNewImageData('')
    setNewAudioData('')
    setNewImageUrl('')
    setNewAudioUrl('')
    setNewMediaMode('upload')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    if (audioFileInputRef.current) {
      audioFileInputRef.current.value = ''
    }
  }

  const handleRemove = (id: string) => {
    onChange(symbols.filter(s => s.id !== id))
  }

  const startEdit = (item: SymbolItem) => {
    setEditingId(item.id)
    setEditName(item.name)
    setEditType(item.symbol_type)
    setEditDescription(item.description || '')
    setEditContext(item.context || '')
    setEditImageData(item.image_data || '')
    setEditAudioData(item.audio_data || '')
    setEditImageUrl(item.image_url || '')
    setEditAudioUrl(item.audio_url || '')
    setEditMediaMode(item.media_source || 'upload')
  }

  const saveEdit = () => {
    if (!editingId) return

    const updates: Partial<SymbolItem> = {
      name: editName.trim(),
      symbol_type: editType,
      description: editDescription.trim() || undefined,
      context: editContext.trim() || undefined,
      media_source: editMediaMode,
    }

    // Update media based on mode and type
    if (editMediaMode === 'upload') {
      if (editType === 'auditory') {
        updates.audio_data = editAudioData || undefined
        updates.audio_url = undefined
      } else {
        updates.image_data = editImageData || undefined
        updates.image_url = undefined
      }
    } else {
      // Link mode
      if (editType === 'auditory') {
        updates.audio_url = editAudioUrl.trim() || undefined
        updates.audio_data = undefined
      } else {
        updates.image_url = editImageUrl.trim() || undefined
        updates.image_data = undefined
      }
    }

    onChange(
      symbols.map(s =>
        s.id === editingId ? { ...s, ...updates } : s
      )
    )

    cancelEdit()
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditType('visual')
    setEditDescription('')
    setEditContext('')
    setEditImageData('')
    setEditAudioData('')
    setEditImageUrl('')
    setEditAudioUrl('')
    setEditMediaMode('upload')
    if (editFileInputRef.current) {
      editFileInputRef.current.value = ''
    }
    if (editAudioFileInputRef.current) {
      editAudioFileInputRef.current.value = ''
    }
  }

  // Group symbols by type
  const grouped = symbols.reduce((acc, item) => {
    if (!acc[item.symbol_type]) acc[item.symbol_type] = []
    acc[item.symbol_type].push(item)
    return acc
  }, {} as Record<SymbolType, SymbolItem[]>)

  // Calculate stats
  const stats = {
    total: symbols.length,
    byType: {
      visual: symbols.filter(s => s.symbol_type === 'visual').length,
      auditory: symbols.filter(s => s.symbol_type === 'auditory').length,
      social: symbols.filter(s => s.symbol_type === 'social').length,
      other: symbols.filter(s => s.symbol_type === 'other').length
    },
    withImages: symbols.filter(s => s.image_data || s.image_url).length,
    withAudio: symbols.filter(s => s.audio_data || s.audio_url).length
  }

  return (
    <div className="space-y-6">
      {/* Add New Symbol Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add Symbol or Signal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Symbol Type *</Label>
              <Select value={newType} onValueChange={(v) => setNewType(v as SymbolType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(symbolTypeLabels).map(([value, label]) => {
                    const Icon = symbolTypeIcons[value as SymbolType]
                    return (
                      <SelectItem key={value} value={value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <div>
                            <div className="font-medium">{label}</div>
                            <div className="text-xs text-muted-foreground">
                              {symbolTypeDescriptions[value as SymbolType]}
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{newType === 'auditory' ? 'Audio' : 'Image'} (Optional)</Label>
              <Tabs value={newMediaMode} onValueChange={(v) => setNewMediaMode(v as 'upload' | 'link')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="upload">
                    <Upload className="h-3 w-3 mr-1" />
                    Upload
                  </TabsTrigger>
                  <TabsTrigger value="link">
                    <LinkIcon className="h-3 w-3 mr-1" />
                    Link URL
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="upload" className="space-y-2">
                  {newType === 'auditory' ? (
                    <>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => audioFileInputRef.current?.click()}
                          className="flex-1"
                        >
                          <Music className="h-4 w-4 mr-2" />
                          {newAudioData ? 'Change Audio' : 'Upload Audio'}
                        </Button>
                        {newAudioData && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setNewAudioData('')
                              if (audioFileInputRef.current) audioFileInputRef.current.value = ''
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <input
                        ref={audioFileInputRef}
                        type="file"
                        accept="audio/*"
                        onChange={(e) => handleAudioUpload(e, false)}
                        className="hidden"
                      />
                      <p className="text-xs text-muted-foreground">Max 10MB. MP3, WAV, OGG, M4A</p>
                      {newAudioData && (
                        <audio controls className="w-full mt-2">
                          <source src={newAudioData} />
                        </audio>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex-1"
                        >
                          <ImageIcon className="h-4 w-4 mr-2" />
                          {newImageData ? 'Change Image' : 'Upload Image'}
                        </Button>
                        {newImageData && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setNewImageData('')
                              if (fileInputRef.current) fileInputRef.current.value = ''
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, false)}
                        className="hidden"
                      />
                      <p className="text-xs text-muted-foreground">Max 5MB. JPG, PNG, GIF, WEBP</p>
                      {newImageData && (
                        <img
                          src={newImageData}
                          alt="Preview"
                          className="max-w-full h-32 object-contain rounded border mt-2"
                        />
                      )}
                    </>
                  )}
                </TabsContent>

                <TabsContent value="link" className="space-y-2">
                  {newType === 'auditory' ? (
                    <>
                      <Input
                        placeholder="https://example.com/sound.mp3"
                        value={newAudioUrl}
                        onChange={(e) => setNewAudioUrl(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">Paste URL to audio file</p>
                      {newAudioUrl && validateMediaUrl(newAudioUrl, 'audio') && (
                        <audio controls className="w-full mt-2">
                          <source src={newAudioUrl} />
                        </audio>
                      )}
                    </>
                  ) : (
                    <>
                      <Input
                        placeholder="https://example.com/image.jpg"
                        value={newImageUrl}
                        onChange={(e) => setNewImageUrl(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">Paste URL to image</p>
                      {newImageUrl && validateMediaUrl(newImageUrl, 'image') && (
                        <img
                          src={newImageUrl}
                          alt="Preview"
                          className="max-w-full h-32 object-contain rounded border mt-2"
                        />
                      )}
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Symbol Name *</Label>
            <Input
              placeholder="What is this symbol? (e.g., Red baseball cap, Peace sign, Company logo)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>What Does It Represent?</Label>
            <Textarea
              placeholder="What does this symbol signify or communicate?"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Context / Usage</Label>
            <Input
              placeholder="When/where is this symbol used or displayed?"
              value={newContext}
              onChange={(e) => setNewContext(e.target.value)}
            />
          </div>

          <Button onClick={handleAdd} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Symbol
          </Button>
        </CardContent>
      </Card>

      {/* Statistics Overview */}
      {symbols.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.byType.visual}</div>
                <div className="text-sm text-muted-foreground">Visual</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.byType.auditory}</div>
                <div className="text-sm text-muted-foreground">Auditory</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.byType.social}</div>
                <div className="text-sm text-muted-foreground">Social</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">{stats.withImages}</div>
                <div className="text-sm text-muted-foreground">With Images</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{stats.withAudio}</div>
                <div className="text-sm text-muted-foreground">With Audio</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Symbols by Type */}
      {(['visual', 'auditory', 'social', 'other'] as SymbolType[]).map(type => {
        const items = grouped[type] || []
        if (items.length === 0) return null

        const Icon = symbolTypeIcons[type]

        return (
          <Card key={type}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Icon className="h-5 w-5" />
                {symbolTypeLabels[type]} Symbols
                <Badge variant="secondary">{items.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map(item => {
                const isEditing = editingId === item.id
                const imageSource = item.image_data || item.image_url

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-lg border-2 ${symbolTypeColors[type]}`}
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <Select value={editType} onValueChange={(v) => setEditType(v as SymbolType)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(symbolTypeLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Tabs value={editMediaMode} onValueChange={(v) => setEditMediaMode(v as 'upload' | 'link')}>
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="upload">Upload</TabsTrigger>
                            <TabsTrigger value="link">Link URL</TabsTrigger>
                          </TabsList>

                          <TabsContent value="upload" className="space-y-2">
                            {editType === 'auditory' ? (
                              <>
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => editAudioFileInputRef.current?.click()}
                                    className="flex-1"
                                  >
                                    <Music className="h-4 w-4 mr-2" />
                                    {editAudioData ? 'Change' : 'Upload'}
                                  </Button>
                                  {editAudioData && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setEditAudioData('')
                                        if (editAudioFileInputRef.current) editAudioFileInputRef.current.value = ''
                                      }}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                                <input
                                  ref={editAudioFileInputRef}
                                  type="file"
                                  accept="audio/*"
                                  onChange={(e) => handleAudioUpload(e, true)}
                                  className="hidden"
                                />
                                {editAudioData && (
                                  <audio controls className="w-full">
                                    <source src={editAudioData} />
                                  </audio>
                                )}
                              </>
                            ) : (
                              <>
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => editFileInputRef.current?.click()}
                                    className="flex-1"
                                  >
                                    <ImageIcon className="h-4 w-4 mr-2" />
                                    {editImageData ? 'Change' : 'Upload'}
                                  </Button>
                                  {editImageData && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setEditImageData('')
                                        if (editFileInputRef.current) editFileInputRef.current.value = ''
                                      }}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                                <input
                                  ref={editFileInputRef}
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleImageUpload(e, true)}
                                  className="hidden"
                                />
                                {editImageData && (
                                  <img
                                    src={editImageData}
                                    alt="Preview"
                                    className="max-w-full h-32 object-contain rounded border"
                                  />
                                )}
                              </>
                            )}
                          </TabsContent>

                          <TabsContent value="link" className="space-y-2">
                            {editType === 'auditory' ? (
                              <>
                                <Input
                                  placeholder="https://example.com/sound.mp3"
                                  value={editAudioUrl}
                                  onChange={(e) => setEditAudioUrl(e.target.value)}
                                />
                                {editAudioUrl && validateMediaUrl(editAudioUrl, 'audio') && (
                                  <audio controls className="w-full">
                                    <source src={editAudioUrl} />
                                  </audio>
                                )}
                              </>
                            ) : (
                              <>
                                <Input
                                  placeholder="https://example.com/image.jpg"
                                  value={editImageUrl}
                                  onChange={(e) => setEditImageUrl(e.target.value)}
                                />
                                {editImageUrl && validateMediaUrl(editImageUrl, 'image') && (
                                  <img
                                    src={editImageUrl}
                                    alt="Preview"
                                    className="max-w-full h-32 object-contain rounded border"
                                  />
                                )}
                              </>
                            )}
                          </TabsContent>
                        </Tabs>

                        <Input
                          placeholder="Symbol name..."
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />

                        <Textarea
                          placeholder="What does it represent?"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          rows={2}
                        />

                        <Input
                          placeholder="Context / usage..."
                          value={editContext}
                          onChange={(e) => setEditContext(e.target.value)}
                        />

                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveEdit}>
                            <Check className="h-4 w-4 mr-1" />
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEdit}>
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-4">
                        {imageSource && item.symbol_type !== 'auditory' && (
                          <div className="flex-shrink-0">
                            <img
                              src={imageSource}
                              alt={item.name}
                              className="w-24 h-24 object-cover rounded border"
                            />
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">
                                  {symbolTypeLabels[item.symbol_type]}
                                </Badge>
                                {!imageSource && (
                                  <Badge variant="outline" className="text-xs text-muted-foreground">
                                    <ImageIcon className="h-3 w-3 mr-1" />
                                    No image
                                  </Badge>
                                )}
                              </div>
                              <p className="font-medium">{item.name}</p>
                              {item.description && (
                                <p className="text-sm mt-1 opacity-90">{item.description}</p>
                              )}
                              {item.context && (
                                <p className="text-xs mt-1 opacity-75">
                                  <span className="font-medium">Context:</span> {item.context}
                                </p>
                              )}
                              {/* Show audio player for auditory symbols */}
                              {item.symbol_type === 'auditory' && (item.audio_data || item.audio_url) && (
                                <div className="mt-2">
                                  <audio controls className="w-full max-w-sm">
                                    <source src={item.audio_data || item.audio_url} />
                                    Your browser does not support audio playback.
                                  </audio>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startEdit(item)}
                                className="h-7 w-7 p-0"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemove(item.id)}
                                className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )
      })}

      {symbols.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No symbols added yet. Add symbols to see them organized by type.</p>
        </div>
      )}
    </div>
  )
}
