'use server'

import bcrypt from 'bcryptjs'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { encrypt } from '@/lib/auth/jwt'
import { redirect } from 'next/navigation'

export async function loginSchoolUser(formData: FormData) {
  const username = formData.get('username') as string
  const plainTextPassword = formData.get('password') as string

  const supabase = await createClient()

  // 1. Fetch the user from the custom table
  const { data: user, error } = await supabase
    .schema('gps')
    .from('school_users')
    .select('id, school_id, username, password_hash, role, is_active')
    .eq('username', username)
    .single()

  if (error || !user) {
    throw new Error('Invalid username or password.')
  }

  if (!user.is_active) {
    throw new Error('This account has been deactivated.')
  }

  // 2. Verify the hashed password
  const passwordsMatch = await bcrypt.compare(plainTextPassword, user.password_hash)
  if (!passwordsMatch) {
    throw new Error('Invalid username or password.')
  }

  // 3. Create the JWT session payload
  const sessionData = {
    userId: user.id,
    schoolId: user.school_id,
    role: user.role,
  }
  
  // Encrypt the payload into a JWT string
  const encryptedSessionData = await encrypt(sessionData)

  // 4. Set the HTTP-only cookie
  const cookieStore = await cookies()
  cookieStore.set('school_session', encryptedSessionData, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 1 day in seconds
  })

  // 5. Redirect to the school workspace
  redirect('/school-dashboard')
}