'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateHeadTeacherPhoto(formData: FormData) {
  const headTeacherId = formData.get('headTeacherId') as string
  const uploadedPhotoUrl = formData.get('uploadedPhotoUrl') as string | null
  const removePhoto = formData.get('removePhoto') === 'true'
  const birthDate = formData.get('birthDate') as string | null
  const bloodGroup = formData.get('bloodGroup') as string | null

  const supabase = await createClient()

  const updatePayload: any = {}
  
  // Handle Photo Update
  if (uploadedPhotoUrl) {
    updatePayload.photo_url = uploadedPhotoUrl
  } else if (removePhoto) {
    updatePayload.photo_url = null
  }

  // Handle Birthday Update
  if (birthDate !== null) {
    updatePayload.birth_date = birthDate || null
  }

  // Handle Blood Group Update
  if (bloodGroup !== null) {
    updatePayload.blood_group = bloodGroup || null
  }

  // If there are absolutely no fields to update, return early
  if (Object.keys(updatePayload).length === 0) {
    return { success: true }
  }

  const { error } = await supabase
    .schema('gps')
    .from('school_users')
    .update(updatePayload)
    .eq('id', headTeacherId)

  if (error) throw new Error(`Failed to update head teacher profile: ${error.message}`)

  revalidatePath('/school-dashboard', 'layout')
  return { success: true }
}

export async function removeHeadTeacherPhotoInstant(headTeacherId: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .schema('gps')
    .from('school_users')
    .update({ photo_url: null })
    .eq('id', headTeacherId)

  if (error) throw new Error(`Failed to wipe head teacher DB photo url: ${error.message}`)

  revalidatePath('/school-dashboard', 'layout')
  return { success: true }
}