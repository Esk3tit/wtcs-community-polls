import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 2 * 1024 * 1024

export async function uploadImage(file: File): Promise<string> {
  if (!ALLOWED_MIME.includes(file.type)) {
    toast.error('Unsupported format. Use JPG, PNG, or WebP.')
    throw new Error('mime')
  }
  if (file.size > MAX_BYTES) {
    toast.error('Image too large. Max 2 MB.')
    throw new Error('size')
  }
  const { data: urlResponse, error: urlError } = await supabase.functions.invoke<{
    signedUrl: string
    token: string
    path: string
  }>('get-upload-url', { body: { filename: file.name, contentType: file.type } })
  if (urlError || !urlResponse) {
    toast.error('Could not get upload URL')
    throw urlError ?? new Error('no-url')
  }
  const { error: uploadError } = await supabase.storage
    .from('poll-images')
    .uploadToSignedUrl(urlResponse.path, urlResponse.token, file, {
      contentType: file.type,
      upsert: false,
    })
  if (uploadError) {
    toast.error('Upload failed')
    throw uploadError
  }
  const { data: publicData } = supabase.storage.from('poll-images').getPublicUrl(urlResponse.path)
  toast.success('Image uploaded')
  return publicData.publicUrl
}
