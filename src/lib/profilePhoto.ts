import { supabase } from './supabase'

export const avatarBucket = 'profile-photos'
export async function profilePhotoUrl(path: string | null | undefined) {
  if (!path) return null
  const {data,error} = await supabase.storage.from(avatarBucket).createSignedUrl(path,3600)
  if (error) throw error
  return data.signedUrl
}

export function validateProfilePhoto(file: File) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP image.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Choose a photo smaller than 5 MB.')
}

export async function prepareProfilePhoto(file: File): Promise<Blob> {
  validateProfilePhoto(file)
  const bitmap = await createImageBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 512
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Your browser could not prepare this photo. Try another browser.')
    context.fillStyle = '#ffffff'
    context.fillRect(0,0,512,512)
    const size = Math.min(bitmap.width,bitmap.height)
    context.drawImage(bitmap,(bitmap.width-size)/2,(bitmap.height-size)/2,size,size,0,0,512,512)
    return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob ? resolve(blob) : reject(new Error('Could not prepare this photo. Try another image.')),'image/jpeg',0.85))
  } finally { bitmap.close() }
}
