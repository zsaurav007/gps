import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { decrypt } from '@/lib/auth/jwt'
import { createClient } from '@/lib/supabase/server'
import EditTeacherForm from './EditTeacherForm'
import EditHeadTeacherPhotoForm from './EditHeadTeacherPhotoForm'

export const metadata = {
  title: 'Edit Teacher | School Dashboard',
}

export default async function EditTeacherPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const targetId = resolvedParams.id

  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('school_session')?.value
  if (!sessionCookie) redirect('/login')

  const sessionData = await decrypt(sessionCookie)
  if (!sessionData) redirect('/login')

  const supabase = await createClient()

  // 1. Fetch subjects FIRST, because both Head Teachers and Regular Teachers need this list now
  const { data: subjects } = await supabase
    .schema('gps')
    .from('subjects')
    .select('id, name')
    .eq('school_id', sessionData.schoolId)
    .order('name')

  // 2. Check if the requested ID belongs to the Head Teacher in school_users
  const { data: headTeacher } = await supabase
    .schema('gps')
    .from('school_users')
    .select('*')
    .eq('id', targetId)
    .eq('school_id', sessionData.schoolId)
    .eq('role', 'headmaster')
    .single()

  // 3. If it is the Head Teacher, render the special restricted form
  if (headTeacher) {
    return (
      <main className="min-h-screen bg-[#FAFAFA] p-3 md:p-5 lg:p-6 font-sans text-stone-900">
        <div className="max-w-3xl mx-auto space-y-5 lg:space-y-6">
          
          {/* Aesthetic Matte Header */}
          <div className="bg-white rounded-sm border border-stone-200 p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-stone-900 to-[#6b4c9a]"></div>
            
            <div className="flex-1 mb-5 md:mb-0">
              <p className="text-xs font-bold tracking-widest text-stone-500 uppercase mb-1">
                প্রশাসনিক প্রোফাইল <span className="text-[9px] uppercase tracking-widest opacity-70 ml-1.5">/ ADMINISTRATIVE PROFILE</span>
              </p>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-wide uppercase bg-gradient-to-r from-stone-900 to-[#815ba4] bg-clip-text text-transparent break-words">
                প্রধান শিক্ষক এডিট <span className="text-[10px] md:text-xs font-bold text-stone-400 ml-2.5 tracking-widest">/ UPDATE HEADMASTER</span>
              </h1>
            </div>
            
            <div className="flex items-center border-t border-stone-100 pt-4 md:border-t-0 md:pt-0 md:border-l md:pl-5 shrink-0">
              <Link 
                href="/school-dashboard/teachers" 
                className="text-xs font-bold tracking-widest uppercase text-stone-500 hover:text-[#6b4c9a] transition-colors flex items-center gap-1.5"
              >
                <span className="text-base leading-none">&larr;</span> ডিরেক্টরিতে ফিরে যান <span className="text-[9px] uppercase tracking-widest opacity-70 ml-1">/ RETURN TO DIRECTORY</span>
              </Link>
            </div>
          </div>
          
          <div className="bg-white rounded-sm border border-stone-200 p-6 md:p-8 shadow-sm">
            <EditHeadTeacherPhotoForm 
              schoolId={sessionData.schoolId} 
              subjects={subjects || []} 
              headTeacher={headTeacher} 
            />
          </div>
          
        </div>
      </main>
    )
  }

  // 4. Otherwise, fetch the regular teacher profile from the teachers table
  const { data: teacher } = await supabase
    .schema('gps')
    .from('teachers')
    .select('*')
    .eq('id', targetId)
    .eq('school_id', sessionData.schoolId)
    .single()

  if (!teacher) {
    redirect('/school-dashboard/teachers')
  }

  return (
    <main className="min-h-screen bg-[#FAFAFA] p-3 md:p-5 lg:p-6 font-sans text-stone-900">
      <div className="max-w-4xl mx-auto space-y-5 lg:space-y-6">
        
        {/* Aesthetic Matte Header */}
        <div className="bg-white rounded-sm border border-stone-200 p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-stone-900 to-[#6b4c9a]"></div>
          
          <div className="flex-1 mb-5 md:mb-0">
            <p className="text-xs font-bold tracking-widest text-stone-500 uppercase mb-1">
              ফ্যাকাল্টি ম্যানেজমেন্ট <span className="text-[9px] uppercase tracking-widest opacity-70 ml-1.5">/ FACULTY MANAGEMENT</span>
            </p>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-wide uppercase bg-gradient-to-r from-stone-900 to-[#815ba4] bg-clip-text text-transparent break-words">
              শিক্ষক প্রোফাইল এডিট <span className="text-[10px] md:text-xs font-bold text-stone-400 ml-2.5 tracking-widest">/ EDIT TEACHER PROFILE</span>
            </h1>
          </div>
          
          <div className="flex items-center border-t border-stone-100 pt-4 md:border-t-0 md:pt-0 md:border-l md:pl-5 shrink-0">
            <Link 
              href="/school-dashboard/teachers" 
              className="text-xs font-bold tracking-widest uppercase text-stone-500 hover:text-[#6b4c9a] transition-colors flex items-center gap-1.5"
            >
              <span className="text-base leading-none">&larr;</span> বাতিল করে ফিরে যান <span className="text-[9px] uppercase tracking-widest opacity-70 ml-1">/ CANCEL & RETURN</span>
            </Link>
          </div>
        </div>
        
        <div className="bg-white rounded-sm border border-stone-200 p-6 md:p-8 shadow-sm">
          <EditTeacherForm 
            schoolId={sessionData.schoolId} 
            subjects={subjects || []} 
            teacher={teacher} 
          />
        </div>
        
      </div>
    </main>
  )
}