import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { decrypt } from '@/lib/auth/jwt'
import { createClient } from '@/lib/supabase/server'
import ReportInfoClient from './ReportInfoClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Report Info | School Dashboard',
}

export default async function ReportInfoPage() {
  // 1. Authenticate User
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('school_session')?.value
  if (!sessionCookie) redirect('/login')

  const sessionData = await decrypt(sessionCookie)
  if (!sessionData) redirect('/login')

  const supabase = await createClient()
  const schoolId = sessionData.schoolId

  // 2. Fetch the required data concurrently
  const [
    { data: students },
    { data: teachers },
    { data: headTeachers },
    { data: classes }
  ] = await Promise.all([
    // Get all students
    supabase.schema('gps')
      .from('students')
      .select('*')
      .eq('school_id', schoolId),
      
    // Get all regular teachers
    supabase.schema('gps')
      .from('teachers')
      .select('*')
      .eq('school_id', schoolId),

    // Get the Head Teacher
    supabase.schema('gps')
      .from('school_users')
      .select('*')
      .eq('school_id', schoolId)
      .eq('role', 'headmaster'),

    // Get the classes to map class IDs to Names
    supabase.schema('gps')
      .from('classes')
      .select('id, name')
      .eq('school_id', schoolId)
      .order('name', { ascending: true })
  ])

  // 3. Combine Head Teacher with Regular Teachers for the report
  const allTeachers = [
    ...(headTeachers || []),
    ...(teachers || [])
  ].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))

  // 4. Render the Client Component with the fetched data
  return (
    <ReportInfoClient 
      students={students || []} 
      teachers={allTeachers} 
      classes={classes || []} 
    />
  )
}