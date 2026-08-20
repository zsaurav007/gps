import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { decrypt } from '@/lib/auth/jwt'
import { createClient } from '@/lib/supabase/server'
import StudentDirectory from './StudentDirectory'

export default async function StudentDirectoryPage() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('school_session')?.value
  if (!sessionCookie) redirect('/login')

  const sessionData = await decrypt(sessionCookie)
  if (!sessionData) redirect('/login')

  const supabase = await createClient()

  // Fetch BOTH students and classes to pass into our advanced Client Component
  const [
    { data: students },
    { data: classes }
  ] = await Promise.all([
    supabase.schema('gps').from('students').select('*').eq('school_id', sessionData.schoolId).order('created_at', { ascending: false }),
    supabase.schema('gps').from('classes').select('id, name').eq('school_id', sessionData.schoolId).order('name', { ascending: true })
  ])

  return (
    <main className="min-h-screen bg-stone-50 p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Card */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center bg-white p-6 md:p-8 rounded-sm shadow-sm border border-stone-200 border-t-4 border-t-[#6b4c9a] gap-5">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">Student Directory</h1>
            <p className="text-sm font-medium text-stone-600 mt-2">Manage student enrollments, profiles, and academic records.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link 
              href="/school-dashboard" 
              className="text-xs uppercase tracking-widest font-bold text-[#6b4c9a] hover:text-[#5a3f82] transition-colors flex items-center justify-center gap-2 bg-[#fbf9fc] px-5 py-3 rounded-sm border border-[#dad3e3]"
            >
              &larr; Dashboard
            </Link>
            <Link 
              href="/school-dashboard/add-student"
              className="bg-[#6b4c9a] text-white px-5 py-3 rounded-sm text-xs uppercase tracking-widest font-bold hover:bg-[#5a3f82] transition-colors shadow-sm flex items-center justify-center"
            >
              + Add Student
            </Link>
          </div>
        </div>

        {/* Render the powerful Client Component instead of the static table */}
        <StudentDirectory 
          students={students || []} 
          classes={classes || []} 
        />

      </div>
    </main>
  )
}