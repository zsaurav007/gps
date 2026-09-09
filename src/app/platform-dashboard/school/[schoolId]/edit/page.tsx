import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { updateSchool } from '@/app/actions/school-actions'

export default async function EditSchoolPage({ params }: { params: { schoolId: string } }) {
  const resolvedParams = await params
  const { schoolId } = resolvedParams
  const supabase = await createClient()

  const { data: school } = await supabase
    .schema('gps')
    .from('schools')
    .select('*')
    .eq('id', schoolId)
    .single()

  if (!school) redirect('/platform-dashboard')

  return (
    <main className="min-h-screen bg-stone-50 p-6 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header Card */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white p-6 md:p-8 rounded-sm shadow-sm border border-stone-200 border-t-4 border-t-[#6b4c9a] gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">Edit School Details</h1>
            <p className="text-sm font-medium text-stone-600 mt-2">Update platform registration and official identification data.</p>
          </div>
          <Link 
            href={`/platform-dashboard/school/${schoolId}`} 
            className="text-xs uppercase tracking-widest font-bold text-[#6b4c9a] hover:text-[#5a3f82] transition-colors shrink-0 flex items-center justify-center gap-2 bg-[#fbf9fc] px-5 py-3 rounded-sm border border-[#dad3e3] shadow-sm"
          >
            &larr; Cancel
          </Link>
        </div>

        {/* Form Section */}
        <section className="bg-white rounded-sm shadow-sm border border-stone-200 p-6 md:p-8">
          <form action={updateSchool} className="flex flex-col gap-6 lg:gap-8">
            <input type="hidden" name="schoolId" value={schoolId} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
              
              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">
                  School Name
                </label>
                <input 
                  type="text" 
                  name="name" 
                  defaultValue={school.name}
                  required 
                  className="w-full p-3.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">
                  Official Address
                </label>
                <textarea 
                  name="address" 
                  defaultValue={school.address || ''}
                  rows={2}
                  className="w-full p-3.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">
                  EMIS No.
                </label>
                <input 
                  type="text" 
                  name="emisNo" 
                  defaultValue={school.emis_no || ''}
                  className="w-full p-3.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">
                  IPEMIS School Code
                </label>
                <input 
                  type="text" 
                  name="ipemisNo" 
                  defaultValue={school.ipemis_no || ''}
                  className="w-full p-3.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">
                  Established Date
                </label>
                <input 
                  type="date" 
                  name="establishedDate" 
                  defaultValue={school.established_date || ''}
                  className="w-full p-3.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">
                  Registration Status
                </label>
                <select 
                  name="status" 
                  defaultValue={school.registration_status}
                  className="w-full p-3.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              <div className="md:col-span-2 mt-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">
                  System Code
                </label>
                <input 
                  type="text" 
                  defaultValue={school.school_code}
                  disabled
                  className="w-full md:w-1/2 p-3.5 bg-stone-50 border border-stone-200 rounded-sm text-sm font-medium text-stone-500 cursor-not-allowed shadow-sm"
                />
                <p className="text-[11px] font-medium text-stone-500 mt-2 italic">
                  School codes are permanently generated and cannot be changed.
                </p>
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-6 mt-4 border-t border-stone-200 flex justify-end">
              <button 
                type="submit" 
                className="w-full md:w-auto bg-[#6b4c9a] text-white px-10 py-3.5 rounded-sm text-xs uppercase tracking-widest font-bold hover:bg-[#5a3f82] transition-colors shadow-sm"
              >
                Save Changes
              </button>
            </div>

          </form>
        </section>
      </div>
    </main>
  )
}