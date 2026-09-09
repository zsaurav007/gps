import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { decrypt } from '@/lib/auth/jwt'
import { createClient } from '@/lib/supabase/server'
import DeleteTeacherButton from './DeleteTeacherButton' 

export default async function TeachersDirectoryPage() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('school_session')?.value
  if (!sessionCookie) redirect('/login')

  const sessionData = await decrypt(sessionCookie)
  if (!sessionData) redirect('/login')

  const supabase = await createClient()

  // 1. Fetch the Head Teacher securely from school_users table
  const { data: headTeacher } = await supabase
    .schema('gps')
    .from('school_users')
    .select('*')
    .eq('school_id', sessionData.schoolId)
    .eq('role', 'headmaster')
    .single()

  // 2. Fetch all regular teachers for this school
  const { data: teachers } = await supabase
    .schema('gps')
    .from('teachers')
    .select('*')
    .eq('school_id', sessionData.schoolId)
    .order('created_at', { ascending: false })

  // 3. Merge them into a single array (Head Teacher always at the top)
  const allStaff: any[] = []
  
  if (headTeacher) {
    allStaff.push({
      id: headTeacher.id,
      full_name: headTeacher.full_name,
      photo_url: headTeacher.photo_url,
      // Fetches assigned subjects, defaults to Admin if empty
      subjects_taught: headTeacher.subjects_taught || 'Administration & Leadership',
      joining_date: headTeacher.created_at,
      is_head_teacher: true
    })
  }

  if (teachers) {
    teachers.forEach(t => {
      allStaff.push({
        id: t.id,
        full_name: t.full_name,
        photo_url: t.photo_url,
        subjects_taught: t.subjects_taught || 'Unassigned',
        joining_date: t.joining_date,
        is_head_teacher: false
      })
    })
  }

  return (
    <main className="min-h-screen bg-stone-50 p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Card */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center bg-white p-6 md:p-8 rounded-sm shadow-sm border border-stone-200 border-t-4 border-t-[#6b4c9a] gap-5">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">Faculty Directory</h1>
            <p className="text-sm font-medium text-stone-600 mt-2">Manage staff profiles and teaching assignments.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link 
              href="/school-dashboard" 
              className="text-xs uppercase tracking-widest font-bold text-[#6b4c9a] hover:text-[#5a3f82] transition-colors flex items-center justify-center gap-2 bg-[#fbf9fc] px-5 py-3 rounded-sm border border-[#dad3e3]"
            >
              &larr; Dashboard
            </Link>
            <Link 
              href="/school-dashboard/add-teacher"
              className="bg-[#6b4c9a] text-white px-5 py-3 rounded-sm text-xs uppercase tracking-widest font-bold hover:bg-[#5a3f82] transition-colors shadow-sm flex items-center justify-center"
            >
              + Add Teacher
            </Link>
          </div>
        </div>

        {/* Teachers Grid */}
        {allStaff.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-stretch">
            {allStaff.map((staff) => (
              <div 
                key={staff.id} 
                className={`bg-white rounded-sm shadow-sm border overflow-hidden flex flex-col group transition-all duration-300 hover:shadow-md h-full
                  ${staff.is_head_teacher ? 'border-[#6b4c9a] ring-1 ring-[#6b4c9a]' : 'border-stone-200 hover:border-stone-300'}
                `}
              >
                
                {/* Profile Banner & Photo */}
                <div className={`p-6 flex flex-col items-center justify-center border-b relative
                  ${staff.is_head_teacher ? 'bg-[#fbf9fc] border-[#dad3e3]' : 'bg-stone-50 border-stone-100'}
                `}>
                  {staff.is_head_teacher && (
                    <span className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-widest text-white bg-[#6b4c9a] px-2 py-1 rounded-sm shadow-sm">
                      Head Teacher
                    </span>
                  )}
                  
                  <div className={`w-24 h-24 rounded-full border-2 shadow-sm overflow-hidden mb-4 flex items-center justify-center bg-white shrink-0
                    ${staff.is_head_teacher ? 'border-[#6b4c9a]/30' : 'border-stone-200'}
                  `}>
                    {staff.photo_url ? (
                      <img src={staff.photo_url} alt={staff.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <span className={`text-3xl font-bold uppercase
                        ${staff.is_head_teacher ? 'text-[#6b4c9a]' : 'text-stone-300'}
                      `}>
                        {staff.full_name.charAt(0)}
                      </span>
                    )}
                  </div>
                  
                  <h3 className="text-base font-bold text-stone-900 text-center uppercase tracking-wide leading-tight mb-3">
                    {staff.full_name}
                  </h3>
                  
                  {/* Intelligent Scrollable Readable Text Block */}
                  <div className={`w-full p-2.5 rounded-sm border shadow-inner mt-auto
                    ${staff.is_head_teacher ? 'bg-white border-[#dad3e3]' : 'bg-white border-stone-200'}
                  `}>
                    <div className="max-h-[58px] overflow-y-auto custom-scrollbar pr-1">
                      <p className={`text-xs font-semibold leading-relaxed text-center
                        ${staff.is_head_teacher ? 'text-[#6b4c9a]' : 'text-stone-600'}
                      `}>
                        {staff.subjects_taught}
                      </p>
                    </div>
                  </div>

                </div>

                {/* Staff Details */}
                <div className="p-5 flex-grow flex flex-col justify-center space-y-3 bg-white">
                  <div className="flex justify-between items-center border-b border-stone-100 pb-2.5">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Joined</span>
                    <span className="text-xs font-bold text-stone-800 uppercase tracking-wide">
                      {staff.joining_date ? new Date(staff.joining_date).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                    </span>
                  </div>
                  {!staff.is_head_teacher && (
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Status</span>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2 py-1 rounded-sm border border-emerald-200">
                        Active
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="p-4 bg-stone-50 border-t border-stone-200 flex justify-end gap-2 mt-auto">
                  <Link 
                    href={`/school-dashboard/teachers/${staff.id}/edit`}
                    className="flex-1 text-center px-3 py-2.5 bg-white border border-stone-300 text-stone-700 rounded-sm text-[10px] uppercase tracking-widest font-bold hover:bg-stone-50 hover:text-[#6b4c9a] transition-colors shadow-sm"
                  >
                    Edit
                  </Link>
                  
                  {/* Hide Delete button for Head Teacher */}
                  {!staff.is_head_teacher && (
                    <div className="flex-1">
                      <DeleteTeacherButton 
                        teacherId={staff.id} 
                        teacherName={staff.full_name} 
                      />
                    </div>
                  )}
                </div>

              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-sm shadow-sm p-16 border border-stone-200 flex flex-col items-center justify-center min-h-[400px]">
            <div className="w-16 h-16 bg-stone-50 border border-stone-200 rounded-full flex items-center justify-center mb-4 shadow-sm">
              <svg className="w-8 h-8 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
            </div>
            <p className="text-stone-500 font-medium text-sm tracking-wide mb-6">No teachers have been added to this institution yet.</p>
            <Link 
              href="/school-dashboard/add-teacher"
              className="bg-[#6b4c9a] text-white px-8 py-3.5 rounded-sm hover:bg-[#5a3f82] transition-colors text-[11px] uppercase tracking-widest font-bold shadow-sm"
            >
              Add Your First Teacher
            </Link>
          </div>
        )}

      </div>

      {/* Global Style specifically applied for tiny scrollbars within this component */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #d6d3d1; border-radius: 4px; }
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #d6d3d1 transparent; }
      `}} />
    </main>
  )
}