import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { decrypt } from '@/lib/auth/jwt'
import { createClient } from '@/lib/supabase/server'
import EditStudentForm from './EditStudentForm'

// Note: params is now treated as a Promise in newer Next.js versions
export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('school_session')?.value
  if (!sessionCookie) redirect('/login')

  const sessionData = await decrypt(sessionCookie)
  if (!sessionData) redirect('/login')

  // UNWRAP THE PARAMS PROMISE
  const resolvedParams = await params
  const studentId = resolvedParams.id

  const supabase = await createClient()

  // Fetch the specific student and all available classes
  const [
    { data: student, error: studentError },
    { data: classes }
  ] = await Promise.all([
    supabase.schema('gps').from('students').select('*').eq('id', studentId).eq('school_id', sessionData.schoolId).single(),
    supabase.schema('gps').from('classes').select('id, name').eq('school_id', sessionData.schoolId).order('name')
  ])

  if (studentError || !student) {
    console.error("Fetch Student Error:", studentError) // Helps debug in your terminal just in case
    return (
      <div className="min-h-screen bg-stone-50 p-6 flex items-center justify-center font-sans">
        <div className="bg-white p-10 rounded-sm border border-stone-200 shadow-sm text-center max-w-md w-full border-t-4 border-t-[#b4483e]">
          <svg className="w-12 h-12 text-stone-300 mx-auto mb-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          <h1 className="text-xl font-bold text-stone-900 uppercase tracking-wide">Student Not Found</h1>
          <p className="text-xs font-medium text-stone-500 mt-2 mb-8 uppercase tracking-wider">The requested student profile could not be loaded or does not exist.</p>
          <Link 
            href="/school-dashboard/students" 
            className="inline-block bg-[#6b4c9a] text-white px-8 py-3.5 rounded-sm text-[10px] uppercase tracking-widest font-bold hover:bg-[#5a3f82] transition-colors shadow-sm"
          >
            Return to Directory
          </Link>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-stone-50 p-6 md:p-8 font-sans text-stone-900">
      <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
        
        {/* Header Card */}
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 md:p-8 rounded-sm shadow-sm border border-stone-200 border-t-4 border-t-[#6b4c9a] gap-5">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-stone-500 uppercase mb-1.5">Student Roster</p>
            <h1 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">
              Edit Student Profile
            </h1>
            <p className="text-sm font-medium text-stone-600 mt-2">
              Modify demographic, academic, and guardian records for {student.first_name}.
            </p>
          </div>
          <div className="shrink-0 pt-2 md:pt-0 border-t border-stone-100 md:border-t-0 md:border-l md:pl-6 mt-4 md:mt-0">
            <Link 
              href="/school-dashboard/students" 
              className="text-xs uppercase tracking-widest font-bold text-stone-600 hover:text-stone-900 transition-colors flex items-center justify-center gap-2 bg-stone-50 hover:bg-stone-100 px-5 py-3 rounded-sm border border-stone-200 shadow-sm"
            >
              &larr; Cancel & Return
            </Link>
          </div>
        </div>

        {/* Form Container */}
        <div className="w-full">
          <EditStudentForm 
            schoolId={sessionData.schoolId} 
            classes={classes || []} 
            student={student} 
          />
        </div>
        
      </div>
    </main>
  )
}