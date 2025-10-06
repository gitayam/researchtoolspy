# Symbols Media Enhancement Plan

## 🎯 Requirement

**From User Feedback:**
> "The symbols portion needs to switch to upload audio when auditory. But also those should have an option to link to image or audio directly as an option."

## 📊 Current State

**SymbolsManager.tsx** currently only supports:
- ✅ Visual, Auditory, Social, Other symbol types
- ✅ Image upload for all types (base64 → upload)
- ❌ No audio upload support
- ❌ No direct URL linking option

## 🎨 Enhanced Design

### 1. Type-Aware Media Upload

**Symbol Type → Media Type Mapping:**
```
Visual Symbol    → Image Upload/Link
Auditory Symbol  → Audio Upload/Link
Social Symbol    → Image Upload/Link (gesture/behavior photos)
Other Symbol     → Both Image and Audio options
```

### 2. Upload vs Link Modes

**For Each Media Type, User Can Choose:**

**Mode 1: Upload File**
- Select file from device
- Validate size and format
- Convert to base64 (temporary)
- Upload to storage (permanent URL)

**Mode 2: Link to External Media**
- Paste URL to existing media
- Validate URL format
- Store URL directly (no upload needed)
- Preview if possible

### 3. UI Design

#### Visual Symbol (Image)
```tsx
<Tabs>
  <TabsList>
    <TabsTrigger value="upload">Upload Image</TabsTrigger>
    <TabsTrigger value="link">Link to Image</TabsTrigger>
  </TabsList>

  <TabsContent value="upload">
    <Input type="file" accept="image/*" />
    <p className="text-xs">Max 5MB. JPG, PNG, GIF, WEBP</p>
  </TabsContent>

  <TabsContent value="link">
    <Input placeholder="https://example.com/image.jpg" />
    <Button>Preview</Button>
  </TabsContent>
</Tabs>
```

#### Auditory Symbol (Audio)
```tsx
<Tabs>
  <TabsList>
    <TabsTrigger value="upload">Upload Audio</TabsTrigger>
    <TabsTrigger value="link">Link to Audio</TabsTrigger>
  </TabsList>

  <TabsContent value="upload">
    <Input type="file" accept="audio/*" />
    <p className="text-xs">Max 10MB. MP3, WAV, OGG, M4A</p>
  </TabsContent>

  <TabsContent value="link">
    <Input placeholder="https://example.com/sound.mp3" />
    <Button>Preview</Button>
  </TabsContent>
</Tabs>
```

#### Social Symbol (Image - gestures/behaviors)
```tsx
<Tabs>
  <TabsList>
    <TabsTrigger value="upload">Upload Photo</TabsTrigger>
    <TabsTrigger value="link">Link to Photo</TabsTrigger>
  </TabsList>

  <TabsContent value="upload">
    <Input type="file" accept="image/*" />
    <p className="text-xs">Photo of gesture or social marker</p>
  </TabsContent>

  <TabsContent value="link">
    <Input placeholder="https://example.com/gesture.jpg" />
    <Button>Preview</Button>
  </TabsContent>
</Tabs>
```

#### Other Symbol (Both Image and Audio)
```tsx
<Tabs>
  <TabsList>
    <TabsTrigger value="image">Image</TabsTrigger>
    <TabsTrigger value="audio">Audio</TabsTrigger>
  </TabsList>

  <TabsContent value="image">
    <Tabs>
      <TabsTrigger value="upload">Upload</TabsTrigger>
      <TabsTrigger value="link">Link</TabsTrigger>
    </Tabs>
  </TabsContent>

  <TabsContent value="audio">
    <Tabs>
      <TabsTrigger value="upload">Upload</TabsTrigger>
      <TabsTrigger value="link">Link</TabsTrigger>
    </Tabs>
  </TabsContent>
</Tabs>
```

## 💾 Data Model (Updated)

```typescript
export interface SymbolItem {
  id: string
  name: string
  symbol_type: SymbolType
  description?: string
  context?: string

  // Visual media (images)
  image_url?: string        // Stored URL or external link
  image_data?: string       // Base64 (temporary, before upload)

  // Auditory media (audio) - NEW
  audio_url?: string        // Stored URL or external link
  audio_data?: string       // Base64 (temporary, before upload)

  // Source tracking - NEW
  media_source?: 'upload' | 'link'
}
```

## 🛠️ Implementation Steps

### Step 1: Update SymbolsManager Component

**File:** `src/components/frameworks/SymbolsManager.tsx`

**Changes:**
1. Add media mode state: `const [mediaMode, setMediaMode] = useState<'upload' | 'link'>('upload')`
2. Add audio upload handler (similar to image upload)
3. Add URL input handlers for both image and audio
4. Add URL validation function
5. Update UI to show tabs based on symbol type

**Audio Upload Handler:**
```typescript
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
```

**URL Validation:**
```typescript
const validateMediaUrl = (url: string, type: 'image' | 'audio'): boolean => {
  try {
    const urlObj = new URL(url)

    if (type === 'image') {
      // Check for image extensions
      return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(urlObj.pathname)
    } else {
      // Check for audio extensions
      return /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(urlObj.pathname)
    }
  } catch {
    return false
  }
}
```

### Step 2: Update Symbol Display

**Show appropriate media based on type:**
```tsx
{symbol.symbol_type === 'visual' || symbol.symbol_type === 'social' ? (
  symbol.image_url ? (
    <img src={symbol.image_url} alt={symbol.name} className="w-full h-40 object-cover rounded" />
  ) : null
) : symbol.symbol_type === 'auditory' ? (
  symbol.audio_url ? (
    <audio controls className="w-full">
      <source src={symbol.audio_url} />
      Your browser does not support audio playback.
    </audio>
  ) : null
) : null}
```

### Step 3: Update Report Generation

**File:** `src/lib/report-generator.ts`

**Add audio symbols to reports:**
```typescript
if (symbols && symbols.length > 0) {
  markdown += `## 🔣 Symbols & Signals\n\n`

  symbols.forEach((symbol: SymbolItem) => {
    const typeIcon = symbol.symbol_type === 'visual' ? '👁️' :
                    symbol.symbol_type === 'auditory' ? '🔊' :
                    symbol.symbol_type === 'social' ? '👥' : '❓'

    markdown += `### ${typeIcon} ${symbol.name}\n`
    markdown += `**Type:** ${symbol.symbol_type}\n`

    if (symbol.description) {
      markdown += `**Meaning:** ${symbol.description}\n`
    }

    if (symbol.context) {
      markdown += `**Context:** ${symbol.context}\n`
    }

    if (symbol.image_url) {
      markdown += `**Visual:** ![${symbol.name}](${symbol.image_url})\n`
    }

    if (symbol.audio_url) {
      markdown += `**Audio:** [Listen to ${symbol.name}](${symbol.audio_url})\n`
    }

    markdown += '\n'
  })
}
```

## 🎯 Acceptance Criteria

### Visual Symbols
- [x] Can upload image file (JPG, PNG, GIF, WEBP)
- [ ] Can link to external image URL
- [ ] Preview image before saving
- [ ] Validate image URL format

### Auditory Symbols
- [ ] Upload switches to audio file input
- [ ] Can upload audio file (MP3, WAV, OGG, M4A)
- [ ] Can link to external audio URL
- [ ] Preview/play audio before saving
- [ ] Validate audio URL format

### Social Symbols
- [x] Can upload photo of gesture/behavior
- [ ] Can link to external photo URL

### Other Symbols
- [ ] Can choose between image or audio
- [ ] Each with upload/link options

### General
- [ ] Media source (upload vs link) is tracked
- [ ] URLs are validated before saving
- [ ] File size limits enforced (5MB image, 10MB audio)
- [ ] Reports correctly display both images and audio links
- [ ] Export includes media references

## 📋 Testing Checklist

- [ ] Upload image for visual symbol
- [ ] Link to external image for visual symbol
- [ ] Upload audio for auditory symbol
- [ ] Link to external audio for auditory symbol
- [ ] Switch symbol type updates upload UI
- [ ] Invalid URLs are rejected
- [ ] Oversized files are rejected
- [ ] Base64 conversion works correctly
- [ ] Reports include both images and audio
- [ ] Export preserves media URLs

## 🚀 Deployment Plan

1. **Phase 1:** Update types (✅ DONE)
2. **Phase 2:** Update SymbolsManager component
3. **Phase 3:** Update report generation
4. **Phase 4:** Test all media types
5. **Phase 5:** Deploy with migration guide

## 💡 Future Enhancements

1. **Media Library**
   - Store uploaded media in Cloudflare R2
   - Reuse media across symbols
   - Search media by type

2. **Rich Previews**
   - Waveform visualization for audio
   - Image gallery view
   - Media metadata (duration, dimensions)

3. **External Integrations**
   - YouTube/Vimeo embed for video symbols
   - Spotify/SoundCloud for audio symbols
   - Instagram/Pinterest for image symbols

4. **Accessibility**
   - Alt text for images
   - Transcripts for audio
   - Screen reader support
