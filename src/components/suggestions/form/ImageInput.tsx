import { useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { uploadImage } from '@/hooks/useUploadImage'

interface Props {
  value: string | null
  onChange: (next: string | null) => void
  disabled?: boolean
}

export function ImageInput({ value, onChange, disabled }: Props) {
  const [uploading, setUploading] = useState(false)
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

  return (
    <div className="space-y-2">
      <Label>Image (optional)</Label>
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
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={disabled || uploading}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleFile(f)
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={disabled || uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Uploading…
                </>
              ) : (
                <>
                  <ImagePlus className="h-4 w-4 mr-1" /> Choose image (JPG/PNG/WebP, max 2 MB)
                </>
              )}
            </Button>
          </TabsContent>
          <TabsContent value="url" className="pt-3">
            <Input
              type="url"
              placeholder="https://…"
              disabled={disabled}
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
