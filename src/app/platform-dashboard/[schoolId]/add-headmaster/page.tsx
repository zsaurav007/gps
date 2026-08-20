import { createHeadmaster } from '@/app/actions/user-actions'
import Link from 'next/link'

// Note: params is treated as a Promise in newer Next.js versions
export default async function AddHeadmasterPage({ params }: { params: Promise<{ schoolId: string }> }) {
  // Await the params
  const resolvedParams = await params
  const { schoolId } = resolvedParams

  return (
    <main className="min-h-screen bg-stone-50 p-6 md:p-8 font-sans text-stone-900">
      <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
        
        {/* Header Card */}
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 md:p-8 rounded-sm shadow-sm border border-stone-200 border-t-4 border-t-[#6b4c9a] gap-5">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-stone-500 uppercase mb-1.5">Platform Administration</p>
            <h1 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">
              Assign Headmaster
            </h1>
            <p className="text-sm font-medium text-stone-600 mt-2">
              Create credentials for the institution's primary administrator.
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
        
        {/* Form Card */}
        <div className="bg-white rounded-sm shadow-sm border border-stone-200 p-6 md:p-8">
          <form action={createHeadmaster} className="flex flex-col gap-6">
            {/* Hidden input to securely pass the schoolId to the server action */}
            <input type="hidden" name="schoolId" value={schoolId} />

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-2">
                  Headmaster Full Name
                </label>
                <input 
                  type="text" 
                  name="fullName" 
                  required 
                  placeholder="e.g., Shafiqul Islam"
                  className="w-full p-3.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-2">
                  Username
                </label>
                <input 
                  type="text" 
                  name="username" 
                  required 
                  placeholder="e.g., shafiqul.hm"
                  className="w-full p-3.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-2">
                  Initial Password
                </label>
                <input 
                  type="password" 
                  name="password" 
                  required 
                  minLength={6}
                  placeholder="Enter a secure password..."
                  className="w-full p-3.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm"
                />
                <p className="text-[10px] text-stone-500 mt-2 font-bold tracking-widest uppercase">
                  Note: Provide this temporary password to the Headmaster so they can access their dashboard.
                </p>
              </div>
            </div>

            <div className="border-t border-stone-100 pt-6 mt-2">
              <button 
                type="submit" 
                className="w-full bg-[#6b4c9a] text-white px-5 py-3.5 rounded-sm hover:bg-[#5a3f82] transition-colors text-xs uppercase tracking-widest font-bold shadow-sm"
              >
                Create & Assign Account
              </button>
            </div>
          </form>
        </div>
        
      </div>
    </main>
  )
}