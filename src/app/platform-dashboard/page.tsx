import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import BroadcastClientForm from './BroadcastClientForm'
import ClearBroadcastButton from './ClearBroadcastButton'
import GlobalBroadcastBanner from '@/components/GlobalBroadcastBanner'
import PlatformRestoreWidget from '@/components/PlatformRestoreWidget'

export const dynamic = 'force-dynamic'

const Icons = {
  Add: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.5" d="M12 4v16m8-8H4"></path></svg>,
  Lifecycle: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.5" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m-8 7v6m-4-3h8"></path></svg>,
  View: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
}

export default async function PlatformDashboardPage() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/admin-login')
  }

  const [
    schoolsRes, 
    headmastersRes, 
    studentsRes, 
    teachersRes,
    activeBroadcastRes
  ] = await Promise.all([
    supabase.schema('gps').from('schools').select('*').order('created_at', { ascending: false }),
    supabase.schema('gps').from('school_users').select('school_id, full_name, username').eq('role', 'headmaster'),
    supabase.schema('gps').from('students').select('id', { count: 'exact', head: true }),
    supabase.schema('gps').from('teachers').select('id', { count: 'exact', head: true }),
    supabase.schema('gps').from('global_broadcasts').select('*').eq('is_active', true).maybeSingle()
  ])

  const schools = schoolsRes.data || []
  const headmasters = headmastersRes.data || []
  const totalSchools = schools.length
  const totalHeadmasters = headmasters.length
  const totalStudents = studentsRes.count || 0
  const totalTeachers = teachersRes.count || 0
  
  const activeBroadcast = activeBroadcastRes.data

  return (
    <main className="min-h-screen bg-stone-50 p-6 md:p-8 font-sans text-stone-900 pb-16">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        
        {/* Header Card */}
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 md:p-8 rounded-sm shadow-sm border border-stone-200 border-t-4 border-t-[#6b4c9a] gap-6">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-stone-500 uppercase mb-1.5">Platform Administration</p>
            <h1 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">
              Global Command Center
            </h1>
            <p className="text-[11px] font-bold tracking-widest text-stone-400 mt-2 uppercase">Auth: {user.email}</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 shrink-0 pt-2 md:pt-0 border-t border-stone-100 md:border-t-0 md:border-l md:border-stone-200 md:pl-6 w-full md:w-auto">
            <Link 
              href="/platform-dashboard/lifecycle"
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border border-stone-200 text-stone-700 px-5 py-3.5 rounded-sm hover:bg-[#fbf9fc] hover:border-[#dad3e3] hover:text-[#6b4c9a] transition-all font-bold tracking-widest text-[10px] uppercase shadow-sm"
            >
              {Icons.Lifecycle} Data Lifecycle
            </Link>
            <Link 
              href="/platform-dashboard/add-school"
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#6b4c9a] text-white px-5 py-3.5 rounded-sm hover:bg-[#5a3f82] transition-colors font-bold tracking-widest text-[10px] uppercase shadow-sm"
            >
              {Icons.Add} Register School
            </Link>
          </div>
        </div>

        {/* Global Statistics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white rounded-sm border border-stone-200 p-6 shadow-sm flex flex-col justify-center hover:border-[#6b4c9a]/50 hover:bg-gradient-to-br hover:from-white hover:to-[#f5effa] transition-all duration-300">
            <p className="text-[10px] font-bold tracking-widest text-stone-500 uppercase mb-3">Institutions</p>
            <p className="text-3xl sm:text-4xl font-bold text-stone-900 tracking-wide">{totalSchools}</p>
          </div>
          <div className="bg-white rounded-sm border border-stone-200 p-6 shadow-sm flex flex-col justify-center hover:border-[#6b4c9a]/50 hover:bg-gradient-to-br hover:from-white hover:to-[#f5effa] transition-all duration-300">
            <p className="text-[10px] font-bold tracking-widest text-stone-500 uppercase mb-3">Headmasters</p>
            <p className="text-3xl sm:text-4xl font-bold text-stone-900 tracking-wide">{totalHeadmasters}</p>
          </div>
          <div className="bg-white rounded-sm border border-stone-200 p-6 shadow-sm flex flex-col justify-center hover:border-[#6b4c9a]/50 hover:bg-gradient-to-br hover:from-white hover:to-[#f5effa] transition-all duration-300">
            <p className="text-[10px] font-bold tracking-widest text-stone-500 uppercase mb-3">Total Teachers</p>
            <p className="text-3xl sm:text-4xl font-bold text-stone-900 tracking-wide">{totalTeachers}</p>
          </div>
          <div className="bg-white rounded-sm border border-stone-200 p-6 shadow-sm flex flex-col justify-center hover:border-[#6b4c9a]/50 hover:bg-gradient-to-br hover:from-white hover:to-[#f5effa] transition-all duration-300">
            <p className="text-[10px] font-bold tracking-widest text-stone-500 uppercase mb-3">Total Students</p>
            <p className="text-3xl sm:text-4xl font-bold text-stone-900 tracking-wide">{totalStudents}</p>
          </div>
        </div>

        {/* ========================================== */}
        {/* GLOBAL BROADCAST CENTER */}
        {/* ========================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Create Broadcast Form */}
          <div className="bg-white rounded-sm border border-stone-200 shadow-sm p-6 md:p-8">
            <h2 className="text-[11px] font-bold tracking-widest text-stone-800 uppercase mb-6 flex items-center gap-2">
              <span className="text-[#6b4c9a]">📡</span> Broadcast Center
            </h2>
            <BroadcastClientForm activeImageUrl={activeBroadcast?.image_url || null} />
          </div>

          {/* Active Broadcast Preview */}
          <div className="bg-white rounded-sm border border-stone-200 shadow-sm p-6 md:p-8 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-[11px] font-bold tracking-widest text-stone-800 uppercase flex items-center gap-2">
                <span className="relative flex h-2 w-2 mr-1">
                  {activeBroadcast && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#6b4c9a] opacity-75"></span>}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${activeBroadcast ? 'bg-[#6b4c9a]' : 'bg-stone-300'}`}></span>
                </span>
                Live Preview
              </h2>
              {activeBroadcast && (
                <ClearBroadcastButton imageUrl={activeBroadcast.image_url} />
              )}
            </div>
            
            <div className="flex-1 flex flex-col justify-center bg-stone-50 border border-stone-200 border-dashed rounded-sm p-4">
              {activeBroadcast ? (
                // Render the exact same production-ready component as a preview
                <div className="transform scale-95 origin-center w-full">
                  <GlobalBroadcastBanner />
                </div>
              ) : (
                <div className="py-12 text-center">
                  <p className="text-xs text-stone-400 font-medium tracking-wide italic">
                    No active broadcasts. Your network is quiet.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Schools List Section */}
        <div className="bg-white rounded-sm border border-stone-200 shadow-sm overflow-hidden">
          <div className="p-6 md:px-8 border-b border-stone-200 flex justify-between items-center bg-[#fbf9fc]">
            <h2 className="text-sm font-bold tracking-widest text-stone-900 uppercase">Registered Institutions Directory</h2>
          </div>
          
          {schools.length > 0 ? (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-max">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200">
                    <th className="py-4 px-6 text-[10px] font-bold tracking-widest text-stone-500 uppercase">Institution Name</th>
                    <th className="py-4 px-6 text-[10px] font-bold tracking-widest text-stone-500 uppercase">Registry Code</th>
                    <th className="py-4 px-6 text-[10px] font-bold tracking-widest text-stone-500 uppercase">Headmaster</th>
                    <th className="py-4 px-6 text-[10px] font-bold tracking-widest text-stone-500 uppercase text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {schools.map((school) => {
                    const assignedHeadmaster = headmasters.find((hm: any) => hm.school_id === school.id)

                    return (
                      <tr key={school.id} className="hover:bg-stone-50/50 transition-colors group bg-white">
                        <td className="py-5 px-6">
                          <p className="text-sm font-bold text-stone-900 tracking-wide uppercase">{school.name}</p>
                        </td>
                        <td className="py-5 px-6">
                          <span className="inline-flex px-3 py-1.5 text-[10px] font-bold tracking-widest bg-stone-50 text-stone-600 rounded-sm border border-stone-200 shadow-sm uppercase">
                            {school.school_code}
                          </span>
                        </td>
                        <td className="py-5 px-6">
                          {assignedHeadmaster ? (
                            <div>
                              <p className="text-xs font-bold text-stone-800 uppercase tracking-wide">{assignedHeadmaster.full_name}</p>
                              <p className="text-[10px] font-bold text-stone-400 tracking-widest mt-1 uppercase">ID: {assignedHeadmaster.username}</p>
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold text-[#b4483e] uppercase tracking-widest bg-[#fcf8f8] border border-[#b4483e]/20 px-2.5 py-1.5 rounded-sm">Unassigned</span>
                          )}
                        </td>
                        <td className="py-5 px-6">
                          <div className="flex items-center justify-end gap-3">
                            {!assignedHeadmaster && (
                              <Link 
                                href={`/platform-dashboard/${school.id}/add-headmaster`}
                                className="flex items-center gap-1.5 text-[10px] text-stone-600 hover:text-[#6b4c9a] hover:bg-[#fbf9fc] hover:border-[#dad3e3] font-bold bg-white border border-stone-200 px-4 py-2.5 rounded-sm uppercase tracking-widest transition-all shadow-sm"
                              >
                                {Icons.Add} Appoint
                              </Link>
                            )}
                            <Link 
                              href={`/platform-dashboard/school/${school.id}`}
                              className="flex items-center gap-1.5 text-[10px] text-stone-700 hover:text-[#6b4c9a] font-bold bg-stone-100 hover:bg-[#fbf9fc] border border-stone-200 px-4 py-2.5 rounded-sm uppercase tracking-widest transition-all shadow-sm"
                            >
                              {Icons.View} Inspect
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-16 text-center bg-stone-50">
              <p className="text-xs font-medium text-stone-500 tracking-wide">No institutions registered yet in the global database.</p>
            </div>
          )}
        </div>

        {/* ========================================== */}
        {/* GLOBAL SYSTEM RESTORE WIDGET */}
        {/* ========================================== */}
        <div className="pt-4">
          <PlatformRestoreWidget />
        </div>

      </div>
    </main>
  )
}