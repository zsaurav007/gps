import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { decrypt } from '@/lib/auth/jwt'
import { createClient } from '@/lib/supabase/server'
import ReportsDashboard from './ReportsDashboard'
import CombinedReportsBuilder from './CombinedReportsBuilder'

// ==================================================================
// Type Definitions
// ==================================================================

export interface ExamMark {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface ExamData {
  id: string | number;
  name: string;
  class_id: string | number;
  exam_date: string;
}

export interface ClassData {
  id: string | number;
  name: string;
}

export interface StudentData {
  id: string | number;
  first_name: string;
  last_name: string;
  class_id: string | number;
}

export interface SchoolData {
  name: string;
}

// ==================================================================
// SERVER ACTION: Fetch marks for the Combined Report Engine
// ==================================================================
export async function fetchMarksForExams(examIds: string[]): Promise<ExamMark[]> {
  'use server'
  const supabase = await createClient()
  const { data, error } = await supabase
    .schema('gps')
    .from('exam_marks')
    .select('*')
    .in('exam_id', examIds)
    
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

  // Fetch dropdown dependencies, Students, AND the School Name
  // We cast the Promise.all result to strongly type the returned data arrays
  const [
    { data: exams },
    { data: classes },
    { data: students },
    { data: schoolData }
  ] = await Promise.all([
    supabase.schema('gps').from('exams').select('id, name, class_id, exam_date').eq('school_id', schoolId).order('created_at', { ascending: false }),
    supabase.schema('gps').from('classes').select('id, name').eq('school_id', schoolId).order('name', { ascending: true }),
    supabase.schema('gps').from('students').select('id, first_name, last_name, class_id').eq('school_id', schoolId).order('first_name', { ascending: true }),
    supabase.schema('gps').from('schools').select('name').eq('id', schoolId).single()
  ]) as [
    { data: ExamData[] | null },
    { data: ClassData[] | null },
    { data: StudentData[] | null },
    { data: SchoolData | null }
  ]

  // Fallback string just in case the database fetch fails
  const fetchedSchoolName = schoolData?.name || "Standard High School"

  return (
    <main className="min-h-screen bg-stone-50 p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Card */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white p-6 md:p-8 rounded-sm shadow-sm border border-stone-200 border-t-4 border-t-[#6b4c9a] gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">Reports & Analytics Engine</h1>
            <p className="text-sm font-medium text-stone-600 mt-2">Generate single exam report cards or compile dynamic cumulative ledgers.</p>
          </div>
          <Link href="/school-dashboard" className="text-xs uppercase tracking-widest font-bold text-[#6b4c9a] hover:text-[#5a3f82] transition-colors shrink-0 flex items-center justify-center gap-2 bg-[#fbf9fc] px-5 py-3 rounded-sm border border-[#dad3e3]">
            &larr; Dashboard
          </Link>
        </div>

        {/* Existing: Standard Single-Exam Report Dashboard */}
        <ReportsDashboard 
          exams={exams || []}
          classes={classes || []}
          schoolName={fetchedSchoolName}
        />
        
        {/* NEW: The Dynamic Combined Reports Engine */}
        <CombinedReportsBuilder 
          classes={classes || []}
          exams={exams || []}
          students={students || []}
          fetchMarksForExams={fetchMarksForExams}
        />
        
      </div>
    </main>
  )
}