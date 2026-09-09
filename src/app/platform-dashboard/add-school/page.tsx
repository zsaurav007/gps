import { registerSchool } from '@/app/actions/school-actions'
import Link from 'next/link'

export default function AddSchoolPage() {
  return (
    <main className="min-h-screen bg-stone-50 p-6 md:p-8 font-sans text-stone-900">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
        
        {/* Header Card */}
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 md:p-8 rounded-sm shadow-sm border border-stone-200 border-t-4 border-t-[#6b4c9a] gap-5">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-stone-500 uppercase mb-1.5">Platform Administration</p>
            <h1 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">
              Register New School
            </h1>
            <p className="text-sm font-medium text-stone-600 mt-2">
              Provision a new institutional environment on the platform.
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
          <form action={registerSchool} className="flex flex-col gap-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-2">
                  Institution Name
                </label>
                <input 
                  type="text" 
                  name="name" 
                  required 
                  placeholder="e.g., Dhaka Government Primary School"
                  className="w-full p-3.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm"
                />
                <p className="text-[10px] font-bold tracking-widest uppercase text-stone-400 mt-2">
                  Note: A unique system code will be generated automatically upon registration.
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-2">
                  Official Address
                </label>
                <textarea 
                  name="address" 
                  rows={2}
                  placeholder="e.g., Shibganj, Bogura"
                  className="w-full p-3.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-2">
                  EMIS No.
                </label>
                <input 
                  type="text" 
                  name="emisNo" 
                  placeholder="e.g., 91110081405"
                  className="w-full p-3.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-2">
                  IPEMIS School Code
                </label>
                <input 
                  type="text" 
                  name="ipemisNo" 
                  placeholder="e.g., 115296"
                  className="w-full p-3.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-2">
                  Established Date
                </label>
                <input 
                  type="date" 
                  name="establishedDate" 
                  className="w-full p-3.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="border-t border-stone-100 pt-6 mt-4 flex justify-end">
              <button 
                type="submit" 
                className="w-full md:w-auto bg-[#6b4c9a] text-white px-10 py-3.5 rounded-sm hover:bg-[#5a3f82] transition-colors text-xs uppercase tracking-widest font-bold shadow-sm"
              >
                Deploy School Environment
              </button>
            </div>
            
          </form>
        </div>
        
      </div>
    </main>
  )
}