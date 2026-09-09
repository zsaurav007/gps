import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { decrypt } from '@/lib/auth/jwt'
import { createClient } from '@/lib/supabase/server'
import StudentProfilePrint from './StudentProfilePrint'

export default async function ViewStudentPage({ params }: { params: Promise<{ id: string }> }) {
  // 1. Auth check
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('school_session')?.value
  if (!sessionCookie) redirect('/login')
  
  const sessionData = await decrypt(sessionCookie)
  if (!sessionData?.schoolId) redirect('/login')

  // 2. Resolve dynamic params
  const resolvedParams = await params
  const { id } = resolvedParams

  // 3. Fetch Data
  const supabase = await createClient()

  // Fetch the student, school info (ONLY name to prevent schema errors), and current head teacher
  const [
    { data: student, error: studentError },
    { data: school },
    { data: currentUser }
  ] = await Promise.all([
    supabase.schema('gps').from('students').select('*').eq('id', id).single(),
    supabase.schema('gps').from('schools').select('name').eq('id', sessionData.schoolId).single(),
    supabase.schema('gps').from('school_users').select('full_name').eq('id', sessionData.userId).single()
  ])

  if (studentError || !student) {
    notFound()
  }

  // Fetch the class name for the student
  const { data: classData } = await supabase
    .schema('gps')
    .from('classes')
    .select('name')
    .eq('id', student.class_id)
    .single()

  const className = classData?.name || 'Unknown Class'
  
  // Safe Fallbacks
  const schoolName = school?.name || 'কেলুঞ্জা সরকারি প্রাথমিক বিদ্যালয়'
  const headmasterName = currentUser?.full_name || 'প্রধান শিক্ষক'
  const schoolAddress = 'শিবগঞ্জ, বগুড়া।'

  return (
    <main className="min-h-screen bg-stone-50 p-6 md:p-8 font-sans text-stone-900 print:bg-transparent print:p-0">
      <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
        
        {/* Page Header Card (Hidden on Print) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 md:p-8 rounded-sm shadow-sm border border-stone-200 border-t-4 border-t-[#6b4c9a] gap-5 print:hidden">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-stone-500 uppercase mb-1.5">Student Roster</p>
            <h1 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">
              View Student Profile
            </h1>
            <p className="text-sm font-medium text-stone-600 mt-2">
              Official demographic and academic dossier for {student.first_name}.
            </p>
          </div>
          <div className="shrink-0 pt-2 md:pt-0 border-t border-stone-100 md:border-t-0 md:border-l md:pl-6 mt-4 md:mt-0">
            <Link 
              href="/school-dashboard/students" 
              className="text-xs uppercase tracking-widest font-bold text-stone-600 hover:text-stone-900 transition-colors flex items-center justify-center gap-2 bg-stone-50 hover:bg-stone-100 px-5 py-3 rounded-sm border border-stone-200 shadow-sm"
            >
              &larr; Back to Directory
            </Link>
          </div>
        </div>

        {/* Client Profile Component */}
        <div className="w-full">
          <StudentProfilePrint 
            student={student} 
            className={className} 
            schoolName={schoolName}
            headmasterName={headmasterName}
            schoolAddress={schoolAddress}
          />
        </div>

      </div>
    </main>
  )
}