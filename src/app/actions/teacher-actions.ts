'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Helper for the delete button to fetch the photo URL so the browser can delete it
export async function getTeacherPhotoUrl(teacherId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .schema('gps')
    .from('teachers')
    .select('photo_url')
    .eq('id', teacherId)
    .single()
  
  return data?.photo_url
}

export async function addTeacher(formData: FormData) {
  const schoolId = formData.get('schoolId') as string
  const fullName = formData.get('fullName') as string
  const joiningDate = formData.get('joiningDate') as string
  const birthDate = formData.get('birthDate') as string
  const bloodGroup = formData.get('bloodGroup') as string
  
  const subjectsArray = formData.getAll('subjectsTaught') as string[]
  const subjectsTaught = subjectsArray.join(', ')
  
  // We receive the final Cloudinary URL directly from the client form
  const uploadedPhotoUrl = formData.get('uploadedPhotoUrl') as string | null

  const supabase = await createClient()

  try {
    const { error } = await supabase.schema('gps').from('teachers').insert({
      school_id: schoolId, 
      full_name: fullName, 
      joining_date: joiningDate,
      birth_date: birthDate, 
      blood_group: bloodGroup || null,
      subjects_taught: subjectsTaught, 
      photo_url: uploadedPhotoUrl // Saved directly!
    })

    if (error) throw error
  } catch (err: any) {
    console.error("Database Insert Error:", err)
    throw new Error(`Failed to create teacher: ${err.message}`)
  }

  // CACHE BUSTING
  revalidatePath('/school-dashboard', 'layout')
  return { success: true }
}

export async function updateTeacher(formData: FormData) {
  const teacherId = formData.get('teacherId') as string
  const fullName = formData.get('fullName') as string
  const joiningDate = formData.get('joiningDate') as string
  const birthDate = formData.get('birthDate') as string
  const bloodGroup = formData.get('bloodGroup') as string
  
  const subjectsArray = formData.getAll('subjectsTaught') as string[]
  const subjectsTaught = subjectsArray.join(', ')
  
  const uploadedPhotoUrl = formData.get('uploadedPhotoUrl') as string | null
  const removePhoto = formData.get('removePhoto') === 'true'

  const supabase = await createClient()

  // 1. Prepare the exact payload we want to send to the database
  const updatePayload: any = {
    full_name: fullName, 
    joining_date: joiningDate, 
    birth_date: birthDate,
    blood_group: bloodGroup || null,
    subjects_taught: subjectsTaught,
  }

  // 2. Handle image logic (Cloudinary deletion is now handled by the browser! We only sync the DB.)
  if (uploadedPhotoUrl) {
    updatePayload.photo_url = uploadedPhotoUrl
  } else if (removePhoto) {
    updatePayload.photo_url = null 
  }

  // 3. Send the specific payload to Supabase
  const { error } = await supabase
    .schema('gps')
    .from('teachers')
    .update(updatePayload)
    .eq('id', teacherId)

  if (error) throw new Error(`Failed to update teacher: ${error.message}`)

  // CACHE BUSTING
  revalidatePath('/school-dashboard', 'layout')
  return { success: true }
}

export async function deleteTeacher(formData: FormData) {
  const teacherId = formData.get('teacherId') as string
  const supabase = await createClient()

  // Cloudinary deletion is handled strictly by the browser. 
  // The server's only job is to delete the database row.
  const { error } = await supabase
    .schema('gps')
    .from('teachers')
    .delete()
    .eq('id', teacherId)

  if (error) throw new Error(`Failed to delete teacher from database: ${error.message}`)

  // CACHE BUSTING
  revalidatePath('/school-dashboard', 'layout')
}

// Instant Photo Removal for the Edit Form
export async function removeTeacherPhotoInstant(teacherId: string) {
  const supabase = await createClient()

  // Cloudinary deletion already happened in the browser!
  // We just need to wipe it from the Database instantly.
  const { error } = await supabase
    .schema('gps')
    .from('teachers')
    .update({ photo_url: null })
    .eq('id', teacherId)

  if (error) throw new Error(`Failed to remove photo: ${error.message}`)

  // Update the UI
  revalidatePath('/school-dashboard', 'layout')
  return { success: true }
}