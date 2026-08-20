import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { decrypt } from '@/lib/auth/jwt'
import { createClient } from '@/lib/supabase/server'
import MarksEntrySheet from './MarksEntrySheet'

export default async function MarksEntryPage() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('school_session')?.value
  if (!sessionCookie) redirect('/login')

  const sessionData = await decrypt(sessionCookie)
  if (!sessionData) redirect('/login')

  const supabase = await createClient()
  const schoolId = sessionData.schoolId

  // Fetch dropdown dependencies AND exam configurations
  const [
    { data: exams },
    { data: classes },
    { data: subjects },
    { data: examConfigs }
  ] = await Promise.all([
    supabase.schema('gps').from('exams').select('id, name, class_id, exam_date').eq('school_id', schoolId).order('created_at', { ascending: false }),
    supabase.schema('gps').from('classes').select('id, name').eq('school_id', schoolId).order('name', { ascending: true }),
    supabase.schema('gps').from('subjects').select('id, name').eq('school_id', schoolId),
    supabase.schema('gps').from('exam_configurations').select('exam_id, subject_id') // Used to filter subjects
  ])

  return (
    <main className="min-h-screen bg-stone-50 p-6 md:p-8 font-sans text-stone-900">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        
        {/* Header Card */}
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 md:p-8 rounded-sm shadow-sm border border-stone-200 border-t-4 border-t-[#6b4c9a] gap-5">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-stone-500 uppercase mb-1.5">Academic Assessment</p>
            <h1 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">
              Continuous Marks Ledger
            </h1>
            <p className="text-sm font-medium text-stone-600 mt-2">
              Input student exam scores and continuous assessment marks.
            </p>
          </div>
          <div className="shrink-0 pt-2 md:pt-0 border-t border-stone-100 md:border-t-0 md:border-l md:pl-6 mt-4 md:mt-0">
            <Link 
              href="/school-dashboard" 
              className="text-xs uppercase tracking-widest font-bold text-[#6b4c9a] hover:text-[#5a3f82] transition-colors flex items-center justify-center gap-2 bg-[#fbf9fc] hover:bg-[#f5effa] px-5 py-3 rounded-sm border border-[#dad3e3]"
            >
              &larr; Dashboard
            </Link>
          </div>
        </div>

        <MarksEntrySheet 
          exams={exams || []}
          classes={classes || []}
          subjects={subjects || []}
          examConfigs={examConfigs || []}
        />
        
      </div>
    </main>
  )
}