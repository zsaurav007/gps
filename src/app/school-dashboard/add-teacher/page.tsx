import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { decrypt } from '@/lib/auth/jwt'
import { createClient } from '@/lib/supabase/server'
import AddTeacherForm from './AddTeacherForm'

export default async function AddTeacherPage() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('school_session')?.value
  if (!sessionCookie) redirect('/login')

  const sessionData = await decrypt(sessionCookie)
  if (!sessionData) redirect('/login')

  const supabase = await createClient()

  // Fetch available subjects for this school
  const { data: subjects } = await supabase
    .schema('gps')
    .from('subjects')
    .select('id, name')
    .eq('school_id', sessionData.schoolId)
    .order('name')

  return (
    <main className="min-h-screen bg-stone-50 p-6 md:p-8 font-sans text-stone-900">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
        
        {/* Header Card */}
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 md:p-8 rounded-sm shadow-sm border border-stone-200 border-t-4 border-t-[#6b4c9a] gap-5">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-stone-500 uppercase mb-1.5">Staff Management</p>
            <h1 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">
              Register New Teacher
            </h1>
            <p className="text-sm font-medium text-stone-600 mt-2">
              Create a new faculty profile and assign instructional subjects.
            </p>
          </div>
          <div className="shrink-0 pt-2 md:pt-0 border-t border-stone-100 md:border-t-0 md:border-l md:pl-6 mt-4 md:mt-0">
            <Link 
              href="/school-dashboard/teachers" 
              className="text-xs uppercase tracking-widest font-bold text-stone-600 hover:text-stone-900 transition-colors flex items-center justify-center gap-2 bg-stone-50 hover:bg-stone-100 px-5 py-3 rounded-sm border border-stone-200 shadow-sm"
            >
              &larr; Cancel & Return
            </Link>
          </div>
        </div>
        
        {/* Form Container */}
        <div className="bg-white rounded-sm shadow-sm border border-stone-200 p-6 md:p-8">
          <AddTeacherForm schoolId={sessionData.schoolId} subjects={subjects || []} />
        </div>

      </div>
    </main>
  )
}