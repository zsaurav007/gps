'use server'

import bcrypt from 'bcryptjs'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function createHeadmaster(formData: FormData) {
  const schoolId = formData.get('schoolId') as string
  const username = formData.get('username') as string
  const plainTextPassword = formData.get('password') as string
  const fullName = formData.get('fullName') as string

  const supabase = await createClient()

  // 1. Strict Check: Ensure no headmaster currently exists for this school
  const { data: existingHeadmaster } = await supabase
    .schema('gps')
    .from('school_users')
    .select('id')
    .eq('school_id', schoolId)
    .eq('role', 'headmaster')
    .maybeSingle()

  if (existingHeadmaster) {
    throw new Error('A Headmaster already exists for this school. You must replace them instead.')
  }

  // 2. Hash the password
  const saltRounds = 10
  const passwordHash = await bcrypt.hash(plainTextPassword, saltRounds)

  // 3. Insert the new Headmaster
  const { error } = await supabase
    .schema('gps')
    .from('school_users')
    .insert({
      school_id: schoolId,
      username: username,
      password_hash: passwordHash,
      full_name: fullName,
      role: 'headmaster'
    })

  if (error) {
    console.error('Database Error:', error.message)
    throw new Error('Failed to create Headmaster account. Username might be taken.')
  }

  // 4. Refresh the dashboard and redirect
  revalidatePath('/platform-dashboard')
  redirect('/platform-dashboard')
}

export async function replaceHeadmaster(formData: FormData) {
  const schoolId = formData.get('schoolId') as string
  const username = formData.get('username') as string
  const plainTextPassword = formData.get('password') as string
  const fullName = formData.get('fullName') as string

  const supabase = await createClient()

  // 1. Find the existing headmaster so we know who to delete
  const { data: oldHeadmaster, error: fetchError } = await supabase
    .schema('gps')
    .from('school_users')
    .select('id')
    .eq('school_id', schoolId)
    .eq('role', 'headmaster')
    .single()

  if (fetchError || !oldHeadmaster) {
    throw new Error('Could not find existing headmaster to replace.')
  }

  // 2. Hash the new password
  const saltRounds = 10
  const passwordHash = await bcrypt.hash(plainTextPassword, saltRounds)

  // 3. Create the NEW headmaster
  const { error: insertError } = await supabase
    .schema('gps')
    .from('school_users')
    .insert({
      school_id: schoolId,
      username: username,
      password_hash: passwordHash,
      full_name: fullName,
      role: 'headmaster'
    })

  if (insertError) {
    console.error('Insert Error:', insertError.message)
    throw new Error('Failed to create new Headmaster. Username might be taken.')
  }

  // 4. If creation was successful, DELETE the old headmaster
  const { error: deleteError } = await supabase
    .schema('gps')
    .from('school_users')
    .delete()
    .eq('id', oldHeadmaster.id)

  if (deleteError) {
    console.error('Delete Error:', deleteError.message)
    throw new Error('New headmaster created, but failed to delete the old one.')
  }

  // 5. Refresh the data and redirect to the school's view page
  revalidatePath(`/platform-dashboard/school/${schoolId}`)
  redirect(`/platform-dashboard/school/${schoolId}`)
}

export async function updateHeadmaster(formData: FormData) {
  const schoolId = formData.get('schoolId') as string
  const headmasterId = formData.get('headmasterId') as string
  const fullName = formData.get('fullName') as string
  const isActive = formData.get('isActive') === 'true'

  const supabase = await createClient()

  const { error } = await supabase
    .schema('gps')
    .from('school_users')
    .update({ 
      full_name: fullName,
      is_active: isActive
    })
    .eq('id', headmasterId)

  if (error) {
    console.error('Update Error:', error.message)
    throw new Error('Failed to update headmaster details.')
  }

  revalidatePath(`/platform-dashboard/school/${schoolId}`)
  redirect(`/platform-dashboard/school/${schoolId}`)
}

// ==========================================
// SECURITY & PASSWORD MANAGEMENT
// ==========================================

export async function verifyMasterAdmin(adminPassword: string) {
  const supabase = await createClient()

  // 1. Get current admin session
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) throw new Error("Unauthorized access.")

  // 2. Verify Master Admin Password by attempting a silent auth sign-in
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: adminPassword,
  })

  if (authError) {
    throw new Error("Invalid Master Admin password. Access denied.")
  }

  return true
}

export async function resetHeadmasterPassword(headmasterId: string, newPlainTextPassword: string) {
  const supabase = await createClient()
  
  // Verify Admin is making the request
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized.")

  // Hash the new password before saving
  const saltRounds = 10
  const passwordHash = await bcrypt.hash(newPlainTextPassword, saltRounds)

  const { error } = await supabase
    .schema('gps')
    .from('school_users')
    .update({ password_hash: passwordHash })
    .eq('id', headmasterId)

  if (error) throw new Error(error.message)
  return { success: true }
}