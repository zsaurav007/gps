import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { decrypt } from '@/lib/auth/jwt'
import { createClient } from '@/lib/supabase/server'
import SetupForms from './SetupForms'

export default async function SchoolSetupPage() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('school_session')?.value
  if (!sessionCookie) redirect('/login')

  const sessionData = await decrypt(sessionCookie)
  if (!sessionData) redirect('/login')

  const supabase = await createClient()

  // Fetch Existing Data
  const { data: settings } = await supabase
    .schema('gps')
    .from('school_settings')
    .select('weekly_holidays')
    .eq('school_id', sessionData.schoolId)
    .maybeSingle()

  const currentHolidays = settings?.weekly_holidays || []

  // Fetch Classes, Subjects, and the Mapping Link
  const [
    { data: classes },
    { data: subjects },
    { data: classSubjects }
  ] = await Promise.all([
    supabase.schema('gps').from('classes').select('*').eq('school_id', sessionData.schoolId).order('name'),
    supabase.schema('gps').from('subjects').select('*').eq('school_id', sessionData.schoolId).order('name'),
    supabase.schema('gps').from('class_subjects').select('*')
  ])

  return (
    <main className="min-h-screen bg-stone-50 p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Card */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white p-6 md:p-8 rounded-sm shadow-sm border border-stone-200 border-t-4 border-t-[#6b4c9a] gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">School Setup</h1>
            <p className="text-sm font-medium text-stone-600 mt-2">Configure weekly holidays, manage classes, and assign subject curriculums.</p>
          </div>
          <Link 
            href="/school-dashboard" 
            className="text-xs uppercase tracking-widest font-bold text-[#6b4c9a] hover:text-[#5a3f82] transition-colors shrink-0 flex items-center justify-center gap-2 bg-[#fbf9fc] px-5 py-3 rounded-sm border border-[#dad3e3]"
          >
            &larr; Dashboard
          </Link>
        </div>

        {/* Client Component carrying all the interactivity */}
        <SetupForms 
          schoolId={sessionData.schoolId} 
          currentHolidays={currentHolidays}
          classes={classes || []}
          subjects={subjects || []}
          classSubjects={classSubjects || []}
        />

      </div>
    </main>
  )
}