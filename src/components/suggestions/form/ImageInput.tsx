import { useRef, useState } from 'react'
import { ImagePlus, Loader2, X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { uploadImage } from '@/hooks/useUploadImage'
import { ALLOWED_IMAGE_MIME, MAX_IMAGE_BYTES } from '@/lib/imageConstraints'
import { cn } from '@/lib/utils'

interface Props {
  value: string | null
  onChange: (next: string | null) => void
  disabled?: boolean
}

export function ImageInput({ value, onChange, disabled }: Props) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [dropError, setDropError] = useState<string | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setUploading(true)
    try {
      const url = await uploadImage(file)
      onChange(url)
    } catch {
      /* toasts handled inside uploadImage */
    } finally {
      setUploading(false)
    }
  }

  // LR-07: validate a dropped file inline before handing off to uploadImage.
  // uploadImage also validates and throws, but surfacing an inline error in
  // the dropzone gives screen-reader users live feedback and avoids a bare
  // toast for drops.
  const validateAndAccept = (file: File) => {
    setDropError(null)
    if (!ALLOWED_IMAGE_MIME.includes(file.type)) {
      setDropError('Unsupported format. Use JPG, PNG, or WebP.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setDropError('Image too large. Max 2 MB.')
      return
    }
    void handleFile(file)
  }

  const openPicker = () => {
    if (disabled || uploading) return
    fileRef.current?.click()
  }

  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold">Image (optional)</h3>
      {value ? (
        <div className="flex items-center gap-3 rounded-md border p-3">
          <img
            src={value}
            alt=""
            className="h-16 w-16 rounded object-cover bg-muted"
          />
          <span className="flex-1 text-xs text-muted-foreground truncate">{value}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            <X className="h-4 w-4 mr-1" /> Clear
          </Button>
        </div>
      ) : (
        <Tabs defaultValue="upload">
          <TabsList>
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="url">Paste URL</TabsTrigger>
          </TabsList>
          <TabsContent value="upload" className="pt-3">
            <input
              ref={fileRef}
              type="file"
              accept={ALLOWED_IMAGE_MIME.join(',')}
              className="hidden"
              disabled={disabled || uploading}
              onChange={(e) => {
                const input = e.currentTarget
                const f = input.files?.[0]
                if (f) {
                  validateAndAccept(f)
                }
                input.value = ''
              }}
            />
            {/* LR-07: dropzone. Whole region is a button so keyboard Enter/Space
                opens the file picker; drag-over adds a ring via tokens. */}
            <div
              role="region"
              aria-label="Image upload"
              className="space-y-2"
            >
              <button
                type="button"
                disabled={disabled || uploading}
                onClick={openPicker}
                onDragEnter={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (disabled || uploading) return
                  setDragOver(true)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (disabled || uploading) return
                  setDragOver(true)
                }}
                onDragLeave={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setDragOver(false)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setDragOver(false)
                  if (disabled || uploading) return
                  const f = e.dataTransfer?.files?.[0]
                  if (f) validateAndAccept(f)
                }}
                className={cn(
                  'flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-8 text-sm transition-colors',
                  'hover:bg-muted/40',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  dragOver && 'bg-muted/60 ring-2 ring-ring',
                  (disabled || uploading) && 'cursor-not-allowed opacity-60',
                )}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <span className="text-muted-foreground">Uploading…</span>
                  </>
                ) : (
                  <>
                    <ImagePlus className="h-8 w-8 text-muted-foreground" />
                    <span className="font-medium">
                      Drop an image here, or click to browse
                    </span>
                    <span className="text-xs text-muted-foreground">
                      JPG, PNG, or WebP · max 2 MB
                    </span>
                  </>
                )}
              </button>
              <div aria-live="polite" role="status" className="min-h-0">
                {dropError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{dropError}</AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="url" className="pt-3">
            <Input
              type="url"
              placeholder="https://…"
              disabled={disabled}
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onBlur={(e) => {
                const v = e.currentTarget.value.trim()
                onChange(v || null)
              }}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
