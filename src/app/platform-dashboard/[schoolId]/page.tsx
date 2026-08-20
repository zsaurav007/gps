import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { deleteSchool } from '@/app/actions/school-actions'

export default async function SchoolViewPage({ params }: { params: Promise<{ schoolId: string }> }) {
  // Await the params to support Next.js 15+ patterns
  const resolvedParams = await params
  const { schoolId } = resolvedParams

  const supabase = await createClient()

  // 1. Verify Platform Admin Auth
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/admin-login')
  }

  // 2. Fetch the specific school's details
  const { data: school, error: schoolError } = await supabase
    .schema('gps')
    .from('schools')
    .select('*')
    .eq('id', schoolId)
    .single()

  if (schoolError || !school) {
    redirect('/platform-dashboard')
  }

  // 3. Fetch the assigned Headmaster's details
  const { data: headmaster } = await supabase
    .schema('gps')
    .from('school_users')
    .select('id, full_name, username, is_active, created_at')
    .eq('school_id', schoolId)
    .eq('role', 'headmaster')
    .maybeSingle()

  return (
    <main className="min-h-screen bg-stone-50 p-6 md:p-8 font-sans text-stone-900">
      <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
        
        {/* Header Card */}
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 md:p-8 rounded-sm shadow-sm border border-stone-200 border-t-4 border-t-[#6b4c9a] gap-5">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-stone-500 uppercase mb-1.5">Platform Administration</p>
            <h1 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">
              Institution Overview
            </h1>
            <p className="text-sm font-medium text-stone-600 mt-2">
              Manage facility details, administrative access, and platform lifecycle.
            </p>
          </div>
          <div className="shrink-0 pt-2 md:pt-0 border-t border-stone-100 md:border-t-0 md:border-l md:pl-6 mt-4 md:mt-0">
            <Link 
              href="/platform-dashboard" 
              className="text-xs uppercase tracking-widest font-bold text-stone-600 hover:text-stone-900 transition-colors flex items-center justify-center gap-2 bg-stone-50 hover:bg-stone-100 px-5 py-3 rounded-sm border border-stone-200"
            >
              &larr; Platform Dashboard
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          
          {/* School Details Card */}
          <div className="bg-white rounded-sm shadow-sm border border-stone-200 flex flex-col h-full hover:border-stone-300 transition-colors">
            <div className="flex justify-between items-center border-b border-stone-200 p-6 bg-[#fbf9fc]">
              <h2 className="text-sm font-bold tracking-widest text-stone-900 uppercase">Facility Information</h2>
              <Link 
                href={`/platform-dashboard/school/${school.id}/edit`}
                className="text-[10px] uppercase tracking-widest font-bold text-stone-600 bg-white border border-stone-200 px-3 py-1.5 rounded-sm hover:text-[#6b4c9a] hover:border-[#dad3e3] transition-all shadow-sm"
              >
                Edit Details
              </Link>
            </div>
            
            <div className="p-6 space-y-6 flex-grow">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">School Name</p>
                <p className="text-sm font-bold text-stone-900 uppercase tracking-wide">{school.name}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Registry Code</p>
                <p className="inline-flex px-3 py-1.5 text-[10px] font-bold tracking-widest bg-stone-50 text-stone-600 rounded-sm border border-stone-200 shadow-sm uppercase">
                  {school.school_code}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">Registration Status</p>
                <span className="inline-block px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-sm">
                  {school.registration_status}
                </span>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Database UUID</p>
                <p className="text-[10px] font-mono font-medium text-stone-400 break-all bg-stone-50 p-2 border border-stone-100 rounded-sm">
                  {school.id}
                </p>
              </div>
            </div>
          </div>

          {/* Headmaster Details Card */}
          <div className="bg-white rounded-sm shadow-sm border border-stone-200 flex flex-col h-full hover:border-stone-300 transition-colors">
            <div className="border-b border-stone-200 p-6 bg-[#fbf9fc]">
              <h2 className="text-sm font-bold tracking-widest text-stone-900 uppercase">Administration</h2>
            </div>
            
            <div className="p-6 flex flex-col flex-grow">
              {headmaster ? (
                <div className="space-y-6 flex-grow">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Headmaster Name</p>
                    <p className="text-sm font-bold text-stone-900 uppercase tracking-wide">{headmaster.full_name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Login Username</p>
                    <p className="text-sm font-bold text-[#6b4c9a] uppercase tracking-wide">@{headmaster.username}</p>
                  </div>
                  <div className="flex gap-8">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">Account Status</p>
                      <span className={`inline-block px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest rounded-sm border ${headmaster.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-[#fcf8f8] text-[#b4483e] border-[#b4483e]/20'}`}>
                        {headmaster.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Account Created</p>
                      <p className="text-xs font-bold text-stone-800 uppercase tracking-widest">
                        {new Date(headmaster.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  
                  {/* Edit & Replace Headmaster Actions */}
                  <div className="pt-6 mt-auto border-t border-stone-100 flex flex-wrap gap-3">
                    <Link 
                      href={`/platform-dashboard/school/${school.id}/edit-headmaster`}
                      className="flex-1 text-center bg-white border border-stone-200 text-stone-600 px-4 py-2.5 rounded-sm hover:bg-stone-50 hover:text-[#6b4c9a] transition-colors text-[10px] uppercase tracking-widest font-bold shadow-sm"
                    >
                      Edit Account
                    </Link>
                    <Link 
                      href={`/platform-dashboard/school/${school.id}/replace-headmaster`}
                      className="flex-1 text-center bg-[#fcf8f8] border border-[#b4483e]/20 text-[#b4483e] px-4 py-2.5 rounded-sm hover:bg-[#b4483e] hover:text-white transition-colors text-[10px] uppercase tracking-widest font-bold shadow-sm"
                    >
                      Replace Access
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="flex-grow flex flex-col items-center justify-center py-8">
                  <div className="w-12 h-12 rounded-full bg-stone-50 border border-stone-200 flex items-center justify-center text-stone-400 mb-4">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                  </div>
                  <p className="text-xs font-medium text-stone-500 tracking-wide mb-6">No administrative access granted yet.</p>
                  <Link 
                    href={`/platform-dashboard/${school.id}/add-headmaster`}
                    className="bg-[#6b4c9a] text-white px-6 py-3 rounded-sm hover:bg-[#5a3f82] transition-colors text-[10px] uppercase tracking-widest font-bold shadow-sm"
                  >
                    Assign Headmaster Now
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========================================== */}
        {/* DANGER ZONE */}
        {/* ========================================== */}
        <div className="mt-8 bg-white border border-[#b4483e]/30 rounded-sm shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 md:p-8 border-b border-[#b4483e]/10 bg-[#fcf8f8]">
            <h2 className="text-lg font-semibold text-[#b4483e] uppercase tracking-wide flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              Destructive Zone
            </h2>
            <p className="text-xs font-medium text-stone-600 mt-2">
              These actions are permanent and cannot be undone. Proceed with extreme caution.
            </p>
          </div>
          
          <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Step 1: Download Data */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white border border-stone-200 text-stone-600 text-[9px] font-bold">1</span>
                <h3 className="text-xs font-bold text-stone-800 uppercase tracking-widest">Mandatory Backup</h3>
              </div>
              <p className="text-xs text-stone-600 mb-6 leading-relaxed">
                You must download a complete backup of all institutional data (students, faculty, and academic records) before the system will authorize environment termination.
              </p>
              <button 
                type="button" 
                className="w-full bg-white border border-stone-300 text-stone-700 px-5 py-3.5 rounded-sm hover:bg-stone-50 transition-colors text-[10px] font-bold uppercase tracking-widest shadow-sm flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                Download Architecture Data
              </button>
            </div>

            {/* Step 2: Delete Form */}
            <div className="md:border-l md:border-[#b4483e]/20 md:pl-8 pt-8 md:pt-0 border-t border-[#b4483e]/20 md:border-t-0 mt-8 md:mt-0">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#fcf8f8] border border-[#b4483e]/30 text-[#b4483e] text-[9px] font-bold">2</span>
                <h3 className="text-xs font-bold text-[#b4483e] uppercase tracking-widest">Terminate Environment</h3>
              </div>
              <form action={deleteSchool} className="flex flex-col gap-5">
                <input type="hidden" name="schoolId" value={school.id} />
                <input type="hidden" name="actualSchoolName" value={school.name} />
                <input type="hidden" name="adminEmail" value={user.email} />

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-2">
                    Type <span className="text-stone-900 border-b border-stone-300 pb-0.5">{school.name}</span> to confirm
                  </label>
                  <input 
                    type="text" 
                    name="schoolNameConfirm" 
                    required 
                    autoComplete="off"
                    placeholder="Enter institution name exactly..."
                    className="w-full p-3.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 focus:outline-none focus:border-[#b4483e] focus:ring-1 focus:ring-[#b4483e] transition-all shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-2">
                    Verify Master Admin Password
                  </label>
                  <input 
                    type="password" 
                    name="passwordConfirm" 
                    required 
                    placeholder="Enter your administrative password..."
                    className="w-full p-3.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 focus:outline-none focus:border-[#b4483e] focus:ring-1 focus:ring-[#b4483e] transition-all shadow-sm"
                  />
                </div>

                <button 
                  type="submit" 
                  className="mt-2 w-full bg-[#b4483e] text-white px-5 py-3.5 rounded-sm hover:bg-[#9a3d34] transition-colors text-xs font-bold uppercase tracking-widest shadow-sm flex items-center justify-center gap-2"
                >
                  Permanently Delete School
                </button>
              </form>
            </div>

          </div>
        </div>

      </div>
    </main>
  )
}