import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AdminLifecycleClient from './AdminLifecycleClient'

export const dynamic = 'force-dynamic'

export default async function AdminDataLifecyclePage() {
  const supabase = await createClient()

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    redirect('/admin-login')
  }

  const { data: schools } = await supabase
    .schema('gps')
    .from('schools')
    .select('id, name')
    .order('name')

  return (
    <main className="min-h-screen bg-stone-50 p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        
        {/* Header Card with Purple Accent */}
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 md:p-8 rounded-sm shadow-sm border border-stone-200 border-t-4 border-t-[#6b4c9a] gap-5">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-stone-500 uppercase mb-1.5">Master Administration</p>
            <h1 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">
              Global Data Lifecycle
            </h1>
            <p className="text-sm font-medium text-stone-600 mt-2 max-w-2xl">
              Execute year-end rollovers and systemic restorations on behalf of individual institutions. Ensure you select the correct school before initiating any destructive commands.
            </p>
          </div>
          <div className="shrink-0 pt-2 md:pt-0 border-t border-stone-100 md:border-t-0 md:border-l md:pl-6 mt-4 md:mt-0">
            <Link 
              href="/platform-dashboard" 
              className="text-xs uppercase tracking-widest font-bold text-[#6b4c9a] hover:text-[#5a3f82] transition-colors flex items-center justify-center gap-2 bg-[#fbf9fc] hover:bg-[#f5effa] px-5 py-3 rounded-sm border border-[#dad3e3]"
            >
              &larr; Platform Dashboard
            </Link>
          </div>
        </div>

        {/* Clean Client Component */}
        <AdminLifecycleClient 
          adminEmail={authData.user.email} 
          schools={schools || []} 
        />

      </div>
    </main>
  )
}