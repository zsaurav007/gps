'use server'

import bcrypt from 'bcryptjs'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { encrypt } from '@/lib/auth/jwt'

// ------------------------------------------------------------------
// 1. MASTER ADMIN AUTHENTICATION (Supabase Auth)
// ------------------------------------------------------------------
export async function loginMasterUser(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  // Gracefully handle wrong admin passwords
  if (error) {
    console.error('Master Login Error:', error.message)
    redirect('/admin-login?error=invalid')
  }

  redirect('/platform-dashboard')
}


// ------------------------------------------------------------------
// 2. TENANT AUTHENTICATION (Custom JWT for Headmasters/Teachers)
// ------------------------------------------------------------------
export async function loginSchoolUser(formData: FormData) {
  const username = formData.get('username') as string
  const plainTextPassword = formData.get('password') as string

  const supabase = await createClient()

  // Fetch the user from the custom school_users table
  const { data: user, error } = await supabase
    .schema('gps')
    .from('school_users')
    .select('id, password_hash, role, school_id, is_active')
    .eq('username', username)
    .maybeSingle()

  // If user doesn't exist, or password doesn't match, trigger invalid credentials error
  if (error || !user || !(await bcrypt.compare(plainTextPassword, user.password_hash))) {
    redirect('/login?error=invalid')
  }

  // If the account was suspended by the Platform Admin, block login
  if (!user.is_active) {
    redirect('/login?error=suspended')
  }

  // 1. Create the session payload
  const sessionData = {
    userId: user.id,
    role: user.role,
    schoolId: user.school_id,
  }

  // 2. Encrypt into a JWT
  const token = await encrypt(sessionData)

  // 3. Store securely in an HTTP-only cookie
  const cookieStore = await cookies()
  cookieStore.set('school_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })

  // 4. Send them to the Tenant Workspace
  redirect('/school-dashboard')
}


// ------------------------------------------------------------------
// 3. UNIVERSAL LOGOUT
// ------------------------------------------------------------------
export async function logoutUser() {
  const supabase = await createClient()

  // 1. Sign out of the Supabase session (Platform Admin)
  await supabase.auth.signOut()

  // 2. Destroy the custom JWT session cookie (School Staff)
  const cookieStore = await cookies()
  cookieStore.delete('school_session')

  // 3. Redirect everyone back to the public login portal
  redirect('/login')
}