import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { decrypt } from '@/lib/auth/jwt'
import { createClient } from '@/lib/supabase/server'
import RoutineBuilderClient from './RoutineBuilderClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Routine Builder | School Dashboard',
}

export default async function RoutinePage() {
  // 1. Authenticate the User
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('school_session')?.value
  if (!sessionCookie) redirect('/login')

  const sessionData = await decrypt(sessionCookie)
  if (!sessionData) redirect('/login')

  const supabase = await createClient()
  const schoolId = sessionData.schoolId

  // 2. Fetch all existing setup data from your database schema simultaneously
  const [
    { data: classes, error: classesError },
    { data: subjects, error: subjectsError },
    { data: teachers, error: teachersError },
    { data: headTeachers, error: headTeachersError },
    { data: classSubjects, error: classSubjectsError },
    { data: settings, error: settingsError }
  ] = await Promise.all([
    supabase.schema('gps').from('classes')
      .select('id, name, periods_per_day')
      .eq('school_id', schoolId)
      .order('name', { ascending: true }),
      
    supabase.schema('gps').from('subjects')
      .select('id, name')
      .eq('school_id', schoolId)
      .order('name', { ascending: true }),
      
    // FIXED: Removed max_periods_per_day to prevent the database crash!
    supabase.schema('gps').from('teachers')
      .select('id, full_name, subjects_taught')
      .eq('school_id', schoolId),

    // Headmaster has the new columns you added earlier
    supabase.schema('gps').from('school_users')
      .select('id, full_name, subjects_taught, max_periods_per_day')
      .eq('school_id', schoolId)
      .eq('role', 'headmaster'),

    supabase.schema('gps').from('class_subjects')
      .select('class_id, subject_id'),

    supabase.schema('gps').from('school_settings')
      .select('weekly_holidays')
      .eq('school_id', schoolId)
      .maybeSingle()
  ])

  // 3. Catch and log silent DB errors to the terminal
  if (headTeachersError) {
    console.error("CRITICAL DB ERROR (Head Teacher):", headTeachersError.message)
  }
  if (teachersError) {
    console.error("CRITICAL DB ERROR (Teachers):", teachersError.message)
  }

  // 4. Combine Head Teacher and regular Teachers into one list, sorted alphabetically
  const allTeachers = [
    ...(headTeachers || []),
    ...(teachers || [])
  ].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))

  // 5. Inject the data into the Builder Client
  return (
    <RoutineBuilderClient 
      dbClasses={classes || []}
      dbSubjects={subjects || []}
      dbTeachers={allTeachers}
      dbClassSubjects={classSubjects || []}
      dbHolidays={settings?.weekly_holidays || []}
      dbRequirements={[]}
      dbQualifications={[]}
      dbPreferredAssignments={[]}
    />
  )
}