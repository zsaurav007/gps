import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { decrypt } from '@/lib/auth/jwt'
import { createClient } from '@/lib/supabase/server'
import ReportsEngine from './ReportsEngine'

export interface ExamMark {
  exam_id: string;
  student_id: string;
  subject_id: string;
  total_obtained: number | string;
  isAbsent?: boolean;
  [key: string]: any;
}

export async function fetchMarksForExams(examIds: string[]): Promise<ExamMark[]> {
  'use server'
  const supabase = await createClient()
  const { data, error } = await supabase.schema('gps').from('exam_marks').select('*').in('exam_id', examIds)
  if (error) throw new Error(error.message)
  return (data as ExamMark[]) || []
}

export default async function ReportsPage() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('school_session')?.value
  if (!sessionCookie) redirect('/login')

  const sessionData = await decrypt(sessionCookie)
  if (!sessionData) redirect('/login')

  const supabase = await createClient()
  const schoolId = sessionData.schoolId

  // Added subjects and exam_configurations to the fetch block
  const [
    { data: exams },
    { data: classes },
    { data: students },
    { data: schoolData },
    { data: subjects },
    { data: examConfigs }
  ] = await Promise.all([
    supabase.schema('gps').from('exams').select('id, name, class_id, exam_date').eq('school_id', schoolId).order('created_at', { ascending: false }),
    supabase.schema('gps').from('classes').select('id, name').eq('school_id', schoolId).order('name', { ascending: true }),
    supabase.schema('gps').from('students').select('*').eq('school_id', schoolId).order('first_name', { ascending: true }),
    supabase.schema('gps').from('schools').select('name, address, emis_no, ipemis_no, established_date').eq('id', schoolId).single(),
    supabase.schema('gps').from('subjects').select('*').eq('school_id', schoolId),
    supabase.schema('gps').from('exam_configurations').select('*')
  ])

  return (
    <main className="min-h-screen bg-stone-50 p-6 md:p-8 font-sans text-stone-900 print:bg-white print:p-0">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">

        {/* Header Card (Hidden on Print) */}
        <div className="flex flex-col md:flex-row md:items-start lg:items-center justify-between bg-white p-6 md:p-8 rounded-sm shadow-sm border border-stone-200 border-t-4 border-t-[#6b4c9a] gap-6 print:hidden">
          <div className="flex-1">
            <div className="flex items-end flex-wrap gap-2.5 leading-none mb-3.5">
              <h1 className="text-2xl md:text-3xl font-black text-stone-900">রিপোর্ট ও রেজাল্ট</h1>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b4c9a] mb-0.5">/ Reports & Results</span>
            </div>
            <p className="text-[15px] font-bold text-stone-800 leading-relaxed mb-1">
              একক পরীক্ষার রিপোর্ট বা বার্ষিক সমন্বিত ফলাফল তৈরি করুন।
            </p>
            <p className="text-[11px] font-bold text-stone-500 italic leading-relaxed">
              Generate single exam reports or compile annual cumulative ledgers.
            </p>
          </div>
          
          <div className="shrink-0 w-full md:w-auto">
            <Link 
              href="/school-dashboard" 
              className="w-full sm:w-auto bg-white border border-stone-300 text-stone-800 px-6 py-3.5 rounded-sm hover:bg-stone-50 transition-colors shadow-sm flex items-center justify-center gap-2 group"
            >
              <span className="text-[14px] font-bold">&larr; ড্যাশবোর্ড</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500 mt-0.5">/ Dashboard</span>
            </Link>
          </div>
        </div>

        {/* Engine Component */}
        <ReportsEngine 
          exams={exams || []}
          classes={classes || []}
          students={students || []}
          schoolData={schoolData || { name: 'Standard Primary School' }}
          subjects={subjects || []}
          examConfigs={examConfigs || []}
          fetchMarksForExams={fetchMarksForExams}
        />

      </div>
    </main>
  )
}