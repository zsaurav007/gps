import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { decrypt } from '@/lib/auth/jwt'
import { createClient } from '@/lib/supabase/server'
import LifecycleClient from './LifecycleClient'

export const dynamic = 'force-dynamic'

export default async function DataLifecyclePage() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('school_session')?.value

  if (!sessionCookie) redirect('/login')

  const sessionData = await decrypt(sessionCookie)
  if (!sessionData) redirect('/login')

  const supabase = await createClient()

  // Fetch the data required for the system backup
  const [
    { data: students },
    { data: exams },
    { data: rawExamMarks },
    { data: school }
  ] = await Promise.all([
    supabase.schema('gps').from('students').select('*').eq('school_id', sessionData.schoolId),
    supabase.schema('gps').from('exams').select('*').eq('school_id', sessionData.schoolId),
    // Fetch marks by linking through the exams table to filter by school_id
    supabase.schema('gps').from('exam_marks').select('*, exams!inner(school_id)').eq('exams.school_id', sessionData.schoolId),
    supabase.schema('gps').from('schools').select('name').eq('id', sessionData.schoolId).single()
  ])

  // Clean the joined exams data out of the marks payload so it can be cleanly restored later
  const cleanedExamMarks = rawExamMarks?.map((mark: any) => {
    const { exams, ...rest } = mark
    return rest
  }) || []

  const rawBackupData = {
    students: students || [],
    exams: exams || [],
    exam_marks: cleanedExamMarks
  }

  return (
    <main className="min-h-screen bg-stone-50 p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Aesthetic Matte Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center bg-white p-6 md:p-8 rounded-sm shadow-sm border border-stone-200 border-t-4 border-t-[#6b4c9a] gap-5">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">Data Lifecycle</h1>
            <p className="text-sm font-medium text-stone-600 mt-2">Manage system backups, archiving, and data restoration.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link 
              href="/school-dashboard" 
              className="text-xs uppercase tracking-widest font-bold text-[#6b4c9a] hover:text-[#5a3f82] transition-colors flex items-center justify-center gap-2 bg-[#fbf9fc] px-5 py-3 rounded-sm border border-[#dad3e3]"
            >
              &larr; Dashboard
            </Link>
          </div>
        </div>

        {/* Client Component carrying all the interactivity */}
        <LifecycleClient 
          schoolId={sessionData.schoolId} 
          userId={sessionData.userId} 
          schoolName={school?.name || 'Institution'}
          rawBackupData={rawBackupData} 
        />

      </div>
    </main>
  )
}