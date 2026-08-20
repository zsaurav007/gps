'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function registerSchool(formData: FormData) {
  const name = formData.get('name') as string

  // Automatically generate a unique 6-character alphanumeric code with a prefix
  const randomString = Math.random().toString(36).substring(2, 8).toUpperCase()
  const generatedSchoolCode = `GPS-${randomString}`

  const supabase = await createClient()

  // Ensure the user is an authenticated Platform Admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }

  // Insert the new school into the database using the generated code
  const { error } = await supabase
    .schema('gps')
    .from('schools')
    .insert({
      name: name,
      school_code: generatedSchoolCode,
      registration_status: 'active',
    })

  if (error) {
    console.error('Database Error:', error.message)
    throw new Error('Failed to register school.')
  }

  // Refresh the dashboard data and redirect back to it
  revalidatePath('/platform-dashboard')
  redirect('/platform-dashboard')
}
export async function deleteSchool(formData: FormData) {
  const schoolId = formData.get('schoolId') as string
  const actualSchoolName = formData.get('actualSchoolName') as string
  const schoolNameConfirm = formData.get('schoolNameConfirm') as string
  const passwordConfirm = formData.get('passwordConfirm') as string
  const adminEmail = formData.get('adminEmail') as string

  // 1. Validate the typed school name matches exactly
  if (schoolNameConfirm !== actualSchoolName) {
    throw new Error('School name does not match. Deletion aborted.')
  }

  const supabase = await createClient()

  // 2. Validate the Master Admin's password securely via Supabase Auth
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: passwordConfirm,
  })

  if (authError) {
    throw new Error('Invalid master password. Deletion aborted.')
  }

  // 3. If password is correct, delete the school
  // Note: Due to PostgreSQL constraints, deleting the school should cascade 
  // and automatically delete all school_users associated with this school_id.
  const { error: deleteError } = await supabase
    .schema('gps')
    .from('schools')
    .delete()
    .eq('id', schoolId)

  if (deleteError) {
    console.error('Delete Error:', deleteError.message)
    throw new Error('Failed to delete the school from the database.')
  }

  // 4. Redirect back to dashboard upon successful deletion
  revalidatePath('/platform-dashboard')
  redirect('/platform-dashboard')
}

export async function updateSchool(formData: FormData) {
  const schoolId = formData.get('schoolId') as string
  const name = formData.get('name') as string
  const status = formData.get('status') as string

  const supabase = await createClient()

  const { error } = await supabase
    .schema('gps')
    .from('schools')
    .update({ 
      name: name,
      registration_status: status 
    })
    .eq('id', schoolId)

  if (error) {
    console.error('Update Error:', error.message)
    throw new Error('Failed to update school details.')
  }

  revalidatePath(`/platform-dashboard/school/${schoolId}`)
  redirect(`/platform-dashboard/school/${schoolId}`)
}