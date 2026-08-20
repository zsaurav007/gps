import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { encrypt } from '@/lib/auth/jwt'
import { deleteSchool } from '@/app/actions/school-actions'
import DangerZoneClient from '@/components/DangerZoneClient' // <--- Import the new component

export default async function SchoolViewPage({ params }: { params: Promise<{ schoolId: string }> }) {
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
  const { data: headmaster, error: headmasterError } = await supabase
    .schema('gps')
    .from('school_users')
    .select('id, school_id, full_name, username, role, is_active, created_at')
    .eq('school_id', schoolId)
    .eq('role', 'headmaster')
    .maybeSingle()

  if (headmasterError) {
    console.error('🚨 HEADMASTER FETCH ERROR:', headmasterError.message)
  }

  // SERVER ACTIONS (toggleSuspension & triggerGodMode remain exactly the same)
  async function toggleSuspension() {
    'use server'
    if (!headmaster) return
    const supabaseClient = await createClient()
    const newStatus = !headmaster.is_active
    await supabaseClient.schema('gps').from('school_users').update({ is_active: newStatus }).eq('id', headmaster.id)
    revalidatePath(`/platform-dashboard/school/${schoolId}`)
  }

  async function triggerGodMode() {
    'use server'
    if (!headmaster) return
    const sessionPayload = {
      userId: headmaster.id,
      schoolId: headmaster.school_id,
      username: headmaster.username,
      role: headmaster.role,
      isImpersonated: true 
    }
    const encryptedSession = await encrypt(sessionPayload)
    const cookieStore = await cookies()
    cookieStore.set('school_session', encryptedSession, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 // 1 day
    })
    redirect('/school-dashboard')
  }

  return (
    <main className="min-h-screen bg-stone-50 p-6 md:p-8 font-sans pb-16">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Navigation Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white p-6 md:p-8 rounded-sm shadow-sm border border-stone-200 border-t-4 border-t-[#6b4c9a] gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">School Overview</h1>
            <p className="text-sm font-medium text-stone-600 mt-2">Manage facility details, administration, and system status.</p>
          </div>
          <Link 
            href="/platform-dashboard" 
            className="text-xs uppercase tracking-widest font-bold text-[#6b4c9a] hover:text-[#5a3f82] transition-colors shrink-0 flex items-center justify-center gap-2 bg-[#fbf9fc] px-5 py-3 rounded-sm border border-[#dad3e3] shadow-sm"
          >
            &larr; Dashboard
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch">
          
          {/* FACILITY DETAILS CARD (Same as before) */}
          <div className="bg-white rounded-sm shadow-sm border border-stone-200 p-6 md:p-8 flex flex-col">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-stone-200">
              <h2 className="text-sm font-bold text-stone-800 uppercase tracking-wider">Facility Information</h2>
              <Link 
                href={`/platform-dashboard/school/${school.id}/edit`}
                className="text-[10px] uppercase tracking-widest font-bold bg-stone-50 border border-stone-200 text-stone-600 px-3 py-2 rounded-sm hover:border-[#6b4c9a] hover:text-[#6b4c9a] transition-colors"
              >
                Edit Details
              </Link>
            </div>
            
            <div className="space-y-6 flex-grow">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">School Name</p>
                <p className="text-sm font-medium text-stone-900">{school.name}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">System Code</p>
                <p className="text-sm font-medium text-stone-900 bg-stone-50 inline-block px-3 py-1.5 border border-stone-200 rounded-sm">{school.school_code}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">Registration Status</p>
                <span className={`inline-block px-3 py-1.5 border text-[10px] font-bold uppercase tracking-widest rounded-sm ${
                  school.registration_status === 'active' 
                    ? 'bg-[#fbf9fc] border-[#dad3e3] text-[#6b4c9a]' 
                    : 'bg-[#fcf8f8] border-[#b4483e]/30 text-[#b4483e]'
                }`}>
                  {school.registration_status}
                </span>
              </div>
            </div>
          </div>

          {/* ADMINISTRATION CARD (Same as before) */}
          <div className="bg-white rounded-sm shadow-sm border border-stone-200 p-6 md:p-8 flex flex-col">
            <div className="mb-6 pb-4 border-b border-stone-200">
              <h2 className="text-sm font-bold text-stone-800 uppercase tracking-wider">Administration</h2>
            </div>
            
            {headmaster ? (
              <div className="space-y-6 flex-grow flex flex-col">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">Headmaster Name</p>
                  <p className="text-sm font-medium text-stone-900">{headmaster.full_name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">Login Username</p>
                  <p className="text-sm font-medium text-stone-900">@{headmaster.username}</p>
                </div>
                
                {/* Edit, Replace, Suspend, and God Mode Actions */}
                <div className="pt-6 mt-auto border-t border-stone-200 flex flex-wrap gap-2.5">
                  <Link 
                    href={`/platform-dashboard/school/${school.id}/edit-headmaster`}
                    className="bg-white border border-stone-300 text-stone-700 px-4 py-2.5 rounded-sm text-[10px] uppercase tracking-widest font-bold hover:bg-stone-50 hover:border-[#6b4c9a] hover:text-[#6b4c9a] transition-all shadow-sm"
                  >
                    Edit
                  </Link>
                  <Link 
                    href={`/platform-dashboard/school/${school.id}/replace-headmaster`}
                    className="bg-white border border-[#b4483e]/50 text-[#b4483e] px-4 py-2.5 rounded-sm text-[10px] uppercase tracking-widest font-bold hover:bg-[#fcf8f8] hover:border-[#b4483e] transition-all shadow-sm"
                  >
                    Replace
                  </Link>
                  
                  <form action={toggleSuspension}>
                    <button 
                      type="submit" 
                      className={`px-4 py-2.5 rounded-sm transition-all text-[10px] uppercase tracking-widest font-bold border shadow-sm ${
                        headmaster.is_active 
                          ? 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100' 
                          : 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                      }`}
                    >
                      {headmaster.is_active ? 'Suspend' : 'Reactivate'}
                    </button>
                  </form>

                  <form action={triggerGodMode} className="w-full sm:w-auto flex-grow sm:flex-grow-0 mt-2 sm:mt-0">
                    <button 
                      type="submit" 
                      className="w-full bg-[#6b4c9a] text-white px-5 py-2.5 rounded-sm text-[10px] uppercase tracking-widest font-bold hover:bg-[#5a3f82] transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                      <span>🚀</span> Login as Admin
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center space-y-5 py-12 bg-stone-50 border border-stone-200 border-dashed rounded-sm mt-2">
                <p className="text-sm font-medium text-stone-500 italic">No Headmaster assigned yet.</p>
                <Link 
                  href={`/platform-dashboard/${school.id}/add-headmaster`}
                  className="bg-[#6b4c9a] text-white px-6 py-3.5 rounded-sm text-[11px] uppercase tracking-widest font-bold hover:bg-[#5a3f82] transition-colors shadow-sm"
                >
                  + Assign Headmaster
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ==========================================
            NEW DANGER ZONE CLIENT COMPONENT
        ========================================== */}
        <div className="mt-8">
          <DangerZoneClient 
            schoolId={school.id}
            schoolName={school.name}
            adminEmail={user.email}
            deleteAction={deleteSchool}
          />
        </div>

      </div>
    </main>
  )
}