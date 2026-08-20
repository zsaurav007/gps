'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createExam } from '@/app/actions/exam-actions'
import Dropdown from '@/components/ui/dropdown' 

export default function CreateExamForm({ schoolId, classes }: { schoolId: string, classes: any[], exams: any[] }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedClassId, setSelectedClassId] = useState<string | number>("")

  const classOptions = classes.map(cls => ({ label: cls.name, value: cls.id }))

  return (
    <div className="font-sans text-stone-900 sticky top-8">
      {/* =========================================
          CREATE EXAM SECTION
      ========================================= */}
      <section className="bg-white rounded-sm shadow-sm border border-stone-200 overflow-hidden">
        <div className="bg-[#fbf9fc] p-6 border-b border-[#dad3e3]">
          <h2 className="text-lg font-semibold text-stone-900 uppercase tracking-wide">Create Exam</h2>
          <p className="text-xs font-medium text-stone-600 mt-1.5">Schedule a new examination.</p>
        </div>

        {classes.length === 0 ? (
          <div className="p-8 text-center bg-stone-50 flex flex-col items-center justify-center">
            <svg className="w-8 h-8 text-stone-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            <p className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Setup Required</p>
            <p className="text-xs font-medium text-stone-400 leading-relaxed">
              No classes available. Please create classes and subjects first from the School Setup page before scheduling an exam.
            </p>
          </div>
        ) : (
          <form 
            id="create-exam-form"
            action={async (formData) => {
              if (!selectedClassId) { alert("Please select a Target Class."); return }
              if (isSubmitting) return
              setIsSubmitting(true)
              try {
                const result = await createExam(formData)
                if (result?.success) {
                  const formElement = document.getElementById('create-exam-form') as HTMLFormElement
                  if (formElement) formElement.reset()
                  setSelectedClassId("") 
                  alert("Exam created successfully! It will now appear in the manager.")
                  router.refresh()
                }
              } catch (error: any) { alert(`Error: ${error.message}`) } 
              finally { setIsSubmitting(false) }
            }} 
            className="p-6 flex flex-col gap-5"
          >
            <input type="hidden" name="schoolId" value={schoolId} />
            <input type="hidden" name="classId" value={selectedClassId} />
            
            <div className="relative">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">Target Class</label>
              <Dropdown options={classOptions} value={selectedClassId} onChange={setSelectedClassId} placeholder="-- Select --" hasSearch={true} />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">Exam Name</label>
              <input type="text" name="name" placeholder="e.g. Midterm" required className="w-full p-2.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all" />
              <p className="text-[10px] text-stone-500 font-medium uppercase tracking-wider mt-1.5">Auto-numbers if name exists</p>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">Start Date</label>
              <input type="date" name="examDate" required className="w-full p-2.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all" />
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full h-[42px] bg-[#6b4c9a] text-white px-5 rounded-sm text-xs uppercase tracking-widest font-bold hover:bg-[#5a3f82] transition-colors disabled:opacity-50 shadow-sm mt-2 flex items-center justify-center">
              {isSubmitting ? 'Scheduling...' : '+ Create Exam'}
            </button>
          </form>
        )}
      </section>
    </div>
  )
}