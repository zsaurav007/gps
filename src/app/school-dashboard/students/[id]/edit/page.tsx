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
      <div className="min-h-screen bg-[#FAFAFA] p-6 flex items-center justify-center font-sans">
        <div className="bg-white p-10 rounded-sm border border-stone-200 shadow-sm text-center max-w-md w-full">
          <svg className="w-12 h-12 text-stone-300 mx-auto mb-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          <h1 className="text-xl font-normal text-stone-900 uppercase tracking-wide">Student Not Found</h1>
          <p className="text-sm font-medium text-stone-500 mt-2 mb-8">The requested student profile could not be loaded or does not exist.</p>
          <Link 
            href="/school-dashboard/students" 
            className="inline-block bg-[#6b4c9a] text-white px-8 py-3.5 rounded-sm text-[11px] uppercase tracking-widest font-bold hover:bg-[#5a3f82] transition-colors shadow-sm"
          >
            Return to Directory
          </Link>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#FAFAFA] p-3 md:p-5 lg:p-6 font-sans text-stone-900">
      <div className="max-w-4xl mx-auto space-y-5 lg:space-y-6">
        
        {/* Aesthetic Matte Header */}
        <div className="bg-white rounded-sm border border-stone-200 p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-stone-900 to-[#6b4c9a]"></div>
          
          <div className="flex-1 mb-5 md:mb-0">
            <p className="text-[11px] font-medium tracking-widest text-stone-500 uppercase mb-1">
              Student Roster
            </p>
            <h1 className="text-2xl md:text-3xl font-normal tracking-wide uppercase bg-gradient-to-r from-stone-900 to-[#815ba4] bg-clip-text text-transparent break-words">
              Edit Student Profile
            </h1>
          </div>
          
          <div className="flex items-center border-t border-stone-100 pt-4 md:border-t-0 md:pt-0 md:border-l md:pl-5 shrink-0">
            <Link 
              href="/school-dashboard/students" 
              className="text-[10px] font-medium tracking-widest uppercase text-stone-500 hover:text-[#6b4c9a] transition-colors flex items-center gap-1.5"
            >
              <span className="text-sm leading-none">&larr;</span> Cancel & Return
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-sm border border-stone-200 p-6 md:p-8 shadow-sm">
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