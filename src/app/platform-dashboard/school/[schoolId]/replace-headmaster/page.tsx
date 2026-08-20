import { replaceHeadmaster } from '@/app/actions/user-actions'
import Link from 'next/link'

export default async function ReplaceHeadmasterPage({ params }: { params: { schoolId: string } }) {
  const resolvedParams = await params
  const { schoolId } = resolvedParams

  return (
    <main className="min-h-screen bg-stone-50 p-6 md:p-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header Card (Red accented for destructive action) */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white p-6 md:p-8 rounded-sm shadow-sm border border-stone-200 border-t-4 border-t-[#b4483e] gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">Replace Headmaster</h1>
            <p className="text-sm font-medium text-stone-600 mt-2">Provision a new administrator account for this school.</p>
          </div>
          <Link 
            href={`/platform-dashboard/school/${schoolId}`} 
            className="text-xs uppercase tracking-widest font-bold text-stone-700 hover:text-stone-900 transition-colors shrink-0 flex items-center justify-center gap-2 bg-stone-100 px-5 py-3 rounded-sm border border-stone-300 shadow-sm"
          >
            &larr; Cancel
          </Link>
        </div>

        {/* Form Section */}
        <section className="bg-white rounded-sm shadow-sm border border-stone-200 p-6 md:p-8">
          
          {/* Warning Notice */}
          <div className="bg-[#fcf8f8] p-5 rounded-sm mb-8 border border-[#b4483e]/30 border-l-4 border-l-[#b4483e] text-sm text-[#b4483e] font-medium shadow-sm flex items-start gap-3">
            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
            <span>
              <strong className="font-bold uppercase tracking-wider text-xs mr-2">Warning:</strong> 
              Creating this new account will immediately and permanently delete the existing Headmaster's account for this school.
            </span>
          </div>
          
          <form action={replaceHeadmaster} className="flex flex-col gap-6 lg:gap-8">
            <input type="hidden" name="schoolId" value={schoolId} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
              {/* New Headmaster Full Name */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">
                  New Headmaster Full Name
                </label>
                <input 
                  type="text" 
                  name="fullName" 
                  required 
                  className="w-full p-3.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm"
                />
              </div>

              {/* New Username */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">
                  New Username
                </label>
                <input 
                  type="text" 
                  name="username" 
                  required 
                  className="w-full p-3.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm"
                />
              </div>

              {/* Initial Password */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">
                  Initial Password
                </label>
                <input 
                  type="password" 
                  name="password" 
                  required 
                  minLength={6}
                  className="w-full p-3.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm"
                />
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-6 mt-4 border-t border-stone-200 flex flex-col sm:flex-row justify-end gap-3">
              <button 
                type="submit" 
                className="w-full sm:w-auto bg-[#b4483e] text-white px-8 py-3.5 rounded-sm text-xs uppercase tracking-widest font-bold hover:bg-[#9a3d34] transition-colors shadow-sm"
              >
                Confirm & Replace
              </button>
            </div>

          </form>
        </section>
      </div>
    </main>
  )
}