'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { v2 as cloudinary } from 'cloudinary'

// ==========================================
// 1. CLOUDINARY AUTH FOR DYNAMIC BROADCASTS
// ==========================================
export async function getBroadcastCloudinaryAuth(folderName: string, transformation: string) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })

  const timestamp = Math.round(new Date().getTime() / 1000)
  
  const signature = cloudinary.utils.api_sign_request(
    { folder: folderName, timestamp, transformation },
    process.env.CLOUDINARY_API_SECRET!
  )

  return { 
    timestamp, 
    signature, 
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!, 
    apiKey: process.env.CLOUDINARY_API_KEY!, 
    transformation 
  }
}

// ==========================================
// 2. DATABASE ACTIONS
// ==========================================
export async function saveBroadcast(message: string | null, imageUrl: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  // HARD DELETE the previous broadcast
  await supabase.schema('gps').from('global_broadcasts').delete().eq('is_active', true)

  // Insert the new broadcast
  await supabase.schema('gps').from('global_broadcasts').insert({
    message: message && message.trim() !== '' ? message.trim() : null,
    image_url: imageUrl,
    is_active: true
  })

  revalidatePath('/platform-dashboard')
}

export async function clearBroadcastServer() {
  const supabase = await createClient()
  await supabase.schema('gps').from('global_broadcasts').delete().eq('is_active', true)
  revalidatePath('/platform-dashboard')
}