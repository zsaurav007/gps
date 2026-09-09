'use client'

import { useState } from 'react'
import { 
  updateHolidays, 
  addClassRecord, 
  deleteClassRecord, 
  updateClassRecord,
  assignBulkSubjectsToClass,
  removeSubjectFromClass
} from '@/app/actions/setup-actions'

// ============================================================================
// 🌟 PREDEFINED SUBJECTS LIST
// Add, remove, or modify subjects here to expand your school's default options.
// ============================================================================
const PREDEFINED_SUBJECTS = [
  'বাংলা (Bangla)',
  'English',
  'গণিত (Math)',
  'প্রাথমিক বিজ্ঞান (Science)',
  'বাংলাদেশ ও বিশ্বপরিচয় (BGS)',
  'ধর্ম ও নৈতিক শিক্ষা (Religion)',
  'চারু ও কারুকলা (Arts)',
  'শারীরিক ও স্বাস্থ্য শিক্ষা (Physical Ed)',
  'সঙ্গীত (Music)'
]

export default function SetupForms({ schoolId, currentHolidays, classes, subjects, classSubjects }: any) {
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  
  const [editingClassId, setEditingClassId] = useState<string | null>(null)
  const [managingSubjectsClassId, setManagingSubjectsClassId] = useState<string | null>(null)
  const [isHolidaysExpanded, setIsHolidaysExpanded] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Universal handler for standard form submissions with alerts
  const handleActionWithAlert = async (
    e: React.FormEvent<HTMLFormElement>, 
    actionFn: (formData: FormData) => Promise<any>, 
    successMessage: string,
    onSuccess?: () => void
  ) => {
    e.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    
    const form = e.currentTarget
    const formData = new FormData(form)
    
    try {
      await actionFn(formData)
      alert(successMessage)
      form.reset() 
      setEditingClassId(null)
      if (onSuccess) onSuccess()
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Smart Bulk Subject Assignment (Checkboxes + Custom)
  const handleBulkSubjectAdd = async (e: React.FormEvent<HTMLFormElement>, classId: string) => {
    e.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    
    const form = e.currentTarget
    const formData = new FormData(form)
    
    const selectedPredefined = formData.getAll('predefinedSubjects') as string[]
    const customSubject = (formData.get('customSubject') as string)?.trim()
    
    const allSubjectsToAdd = [...selectedPredefined]
    if (customSubject) allSubjectsToAdd.push(customSubject)
    
    if (allSubjectsToAdd.length === 0) {
      setIsSubmitting(false)
      return alert("Please check at least one predefined subject or type a custom one.")
    }
    
    try {
      await assignBulkSubjectsToClass(schoolId, classId, allSubjectsToAdd)
      alert("Subjects assigned successfully!")
      form.reset()
      setManagingSubjectsClassId(null) // Close the manage panel on success
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Delete Class with confirmation
  const handleDeleteClass = async (classId: string, className: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete Class ${className}? This will remove all students and subjects associated with it.`)) return
    const formData = new FormData()
    formData.append('classId', classId)
    try {
      await deleteClassRecord(formData)
      alert("Class deleted successfully.")
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  // Remove Subject with confirmation
  const handleRemoveSubject = async (classId: string, subjectId: string, subjectName: string) => {
    if (!window.confirm(`Remove ${subjectName} from this class curriculum?`)) return
    const formData = new FormData()
    formData.append('classId', classId)
    formData.append('subjectId', subjectId)
    try {
      await removeSubjectFromClass(formData)
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  return (
    <div className="space-y-12 lg:space-y-16 font-sans pb-16 text-stone-900 max-w-7xl mx-auto">
      
      {/* =========================================
          SECTION 1: GLOBAL SCHEDULE (Holidays)
      ========================================= */}
      <section className="bg-white rounded-sm shadow-sm border border-stone-200 p-6 md:p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
          <div>
            <h2 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">1. Global Schedule & Holidays</h2>
            <p className="text-sm font-medium text-stone-600 mt-2">Configure the official non-working days for your institution.</p>
          </div>
          
          {!isHolidaysExpanded && (
            <button 
              onClick={() => setIsHolidaysExpanded(true)} 
              className="bg-white border border-stone-300 text-stone-800 px-6 py-3 rounded-sm text-xs uppercase tracking-widest font-bold hover:bg-stone-50 transition-colors shadow-sm shrink-0"
            >
              Edit Schedule
            </button>
          )}
        </div>

        {!isHolidaysExpanded ? (
          <div className="mt-8 p-5 bg-[#fbf9fc] border border-[#dad3e3] rounded-sm flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm">
            <span className="text-xs font-bold text-[#6b4c9a] uppercase tracking-wider shrink-0">Current Holidays:</span>
            {currentHolidays && currentHolidays.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {currentHolidays.map((day: string) => (
                  <span key={day} className="bg-white border border-stone-200 text-stone-800 px-4 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider shadow-sm">
                    {day}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-sm font-medium text-stone-500 italic">No holidays configured yet.</span>
            )}
          </div>
        ) : (
          <form 
            className="mt-8 border-t border-stone-200 pt-8 transition-all"
            onSubmit={(e) => handleActionWithAlert(e, updateHolidays, "Holidays saved successfully!", () => setIsHolidaysExpanded(false))}
          >
            <input type="hidden" name="schoolId" value={schoolId} />
            
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
              {daysOfWeek.map(day => (
                <label 
                  key={day} 
                  className="group relative flex flex-col items-center justify-center p-5 bg-stone-50 border border-stone-200 rounded-sm cursor-pointer hover:bg-[#fbf9fc] hover:border-[#dad3e3] transition-all has-[:checked]:bg-[#fbf9fc] has-[:checked]:border-[#6b4c9a] has-[:checked]:shadow-sm"
                >
                  <input 
                    type="checkbox" 
                    name="holidays" 
                    value={day} 
                    defaultChecked={currentHolidays.includes(day)} 
                    className="absolute top-3 right-3 w-4 h-4 text-[#6b4c9a] bg-white border-stone-300 rounded-sm focus:ring-[#6b4c9a] cursor-pointer accent-[#6b4c9a]" 
                  />
                  <span className="text-sm font-bold text-stone-800 uppercase tracking-wider mt-2 group-hover:text-[#6b4c9a]">{day.slice(0, 3)}</span>
                  <span className="text-xs font-medium text-stone-500 mt-1">{day}</span>
                </label>
              ))}
            </div>
            
            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setIsHolidaysExpanded(false)} 
                className="w-full sm:w-auto bg-white border border-stone-300 text-stone-700 px-8 py-3.5 rounded-sm text-xs uppercase tracking-widest font-bold hover:bg-stone-50 transition-colors shadow-sm"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={isSubmitting} 
                className="w-full sm:w-auto bg-[#6b4c9a] text-white px-8 py-3.5 rounded-sm text-xs uppercase tracking-widest font-bold hover:bg-[#5a3f82] transition-colors disabled:opacity-50 shadow-sm"
              >
                Save Schedule
              </button>
            </div>
          </form>
        )}
      </section>

      {/* =========================================
          SECTION 2: CLASSES & CURRICULUM MANAGEMENT
      ========================================= */}
      <section className="bg-white rounded-sm shadow-sm border border-stone-200 p-6 md:p-8">
        <div className="flex flex-col mb-8 pb-5 border-b border-stone-200">
          <h2 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">2. Class & Curriculum Manager</h2>
          <p className="text-sm font-medium text-stone-600 mt-2">Create classes, set their daily academic periods, and assign the subjects taught in each.</p>
        </div>

        {/* Create Class Input Form Banner */}
        <form 
          onSubmit={(e) => handleActionWithAlert(e, addClassRecord, "New class created successfully!")} 
          className="bg-[#fbf9fc] p-6 rounded-sm border border-[#dad3e3] mb-10 grid grid-cols-1 lg:grid-cols-12 gap-5 items-end shadow-sm"
        >
          <input type="hidden" name="schoolId" value={schoolId} />
          
          <div className="lg:col-span-6">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">Class / Grade Name</label>
            <input 
              type="text" 
              name="className" 
              placeholder="e.g. 10 - Section A" 
              required 
              className="w-full p-3.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all" 
            />
          </div>
          
          <div className="lg:col-span-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">Periods Per Day</label>
            <input 
              type="number" 
              name="periodsPerDay" 
              defaultValue={6} 
              min={1} 
              max={15} 
              required 
              className="w-full p-3.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all" 
            />
          </div>
          
          <div className="lg:col-span-3">
            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="w-full bg-[#6b4c9a] text-white px-5 py-3.5 rounded-sm text-xs uppercase tracking-widest font-bold hover:bg-[#5a3f82] transition-colors disabled:opacity-50 shadow-sm"
            >
              + Create Class
            </button>
          </div>
        </form>

        {/* Classes Catalog Grid (Restored items-stretch) */}
        {classes.length === 0 ? (
          <div className="p-16 rounded-sm border-2 border-dashed border-stone-300 text-center text-stone-600 font-medium text-sm bg-stone-50">
            No classes registered yet. Create your first class above to begin configuring the curriculum.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 items-stretch">
            {classes.map((cls: any) => {
              const assignedSubjectIds = classSubjects.filter((cs: any) => cs.class_id === cls.id).map((cs: any) => cs.subject_id)
              const mappedSubjects = subjects.filter((s: any) => assignedSubjectIds.includes(s.id))
              
              // Filter out predefined subjects that are already mapped to this class
              const availablePredefined = PREDEFINED_SUBJECTS.filter(ps => !mappedSubjects.some((ms: any) => ms.name.toLowerCase() === ps.toLowerCase()))

              return (
                /* Restored h-full so cards are identical sizes */
                <div key={cls.id} className="bg-white rounded-sm shadow-sm border border-stone-200 overflow-hidden flex flex-col group hover:border-[#dad3e3] hover:shadow-md transition-all duration-300 h-full">
                  
                  {/* EDIT MODE */}
                  {editingClassId === cls.id ? (
                    <div className="p-6 bg-[#fbf9fc] flex-grow flex flex-col">
                      <div className="mb-5 pb-3 border-b border-[#dad3e3]">
                        <h3 className="text-sm font-bold text-[#6b4c9a] uppercase tracking-wider">Update Class Details</h3>
                      </div>
                      <form onSubmit={(e) => handleActionWithAlert(e, updateClassRecord, "Class updated successfully!")} className="space-y-4 flex-grow flex flex-col">
                        <input type="hidden" name="classId" value={cls.id} />
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">Class Name</label>
                          <input type="text" name="className" defaultValue={cls.name} required className="w-full p-3 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a]" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">Periods Per Day</label>
                          <input type="number" name="periodsPerDay" defaultValue={cls.periods_per_day} required className="w-full p-3 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a]" />
                        </div>
                        <div className="flex gap-3 pt-4 mt-auto">
                          <button type="submit" className="flex-1 bg-[#6b4c9a] text-white text-[11px] uppercase tracking-widest font-bold px-4 py-3 rounded-sm hover:bg-[#5a3f82] transition-colors shadow-sm">Save</button>
                          <button type="button" onClick={() => setEditingClassId(null)} className="flex-1 bg-white border border-stone-300 text-stone-700 text-[11px] uppercase tracking-widest font-bold px-4 py-3 rounded-sm hover:bg-stone-50 transition-colors shadow-sm">Cancel</button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    
                    /* NORMAL VIEW MODE */
                    <>
                      <div className="bg-stone-50 p-6 border-b border-stone-200 flex justify-between items-start group relative min-h-[105px]">
                        <div>
                          <h3 className="font-semibold text-stone-900 uppercase tracking-wide text-xl">
                            <span className="text-stone-400 font-medium mr-2">Class:</span>{cls.name}
                          </h3>
                          <p className="text-xs text-[#6b4c9a] uppercase tracking-wider font-bold mt-2">
                            {cls.periods_per_day} Daily Periods
                          </p>
                        </div>

                        {/* Hover Action Menu */}
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-stone-50 pl-2">
                          <button onClick={() => setEditingClassId(cls.id)} className="bg-white border border-stone-200 text-stone-500 hover:text-[#6b4c9a] hover:border-[#6b4c9a] p-2 rounded-sm transition-colors shadow-sm" title="Edit Class">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                          </button>
                          <button onClick={() => handleDeleteClass(cls.id, cls.name)} className="bg-white border border-stone-200 text-stone-500 hover:text-[#b4483e] hover:border-[#b4483e] p-2 rounded-sm transition-colors shadow-sm" title="Delete Class">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
                        </div>
                      </div>

                      {/* Assigned Subjects Listing with "Canvas" background */}
                      <div className="p-6 flex-grow flex flex-col relative z-0">
                        {/* Subtle placeholder border that stretches with the card */}
                        <div className="absolute inset-5 border-2 border-dashed border-stone-100 rounded-sm pointer-events-none -z-10 bg-stone-50/30"></div>

                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs font-bold text-stone-500 uppercase tracking-widest">Assigned Curriculum</span>
                          <span className="text-xs font-bold text-stone-600 bg-stone-100 px-3 py-1 rounded-sm border border-stone-200">{mappedSubjects.length} Items</span>
                        </div>
                        
                        {mappedSubjects.length > 0 ? (
                          <div className="flex flex-wrap gap-2.5">
                            {mappedSubjects.map((sub: any) => (
                              <span key={sub.id} className="inline-flex items-center gap-2 bg-white text-stone-800 border border-stone-300 text-[13px] font-bold px-3 py-2 rounded-sm tracking-wide hover:border-[#b4483e] hover:bg-[#fcf8f8] transition-colors group/tag shadow-sm">
                                {sub.name}
                                <button 
                                  onClick={() => handleRemoveSubject(cls.id, sub.id, sub.name)} 
                                  className="text-stone-400 group-hover/tag:text-[#b4483e] transition-colors ml-1"
                                  title={`Remove ${sub.name}`}
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="flex-grow flex items-center justify-center min-h-[60px]">
                            <p className="text-sm font-medium text-stone-400 italic">No subjects added to this class yet.</p>
                          </div>
                        )}
                      </div>

                      {/* Add Subjects Subform (Checkboxes + Custom Input) */}
                      {mappedSubjects.length === 0 || managingSubjectsClassId === cls.id ? (
                        <div className="p-5 sm:p-6 bg-stone-50 border-t border-stone-100 mt-auto">
                          <form onSubmit={(e) => handleBulkSubjectAdd(e, cls.id)} className="space-y-5">
                            
                            {/* Predefined Subjects Grid */}
                            {availablePredefined.length > 0 && (
                              <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-2">
                                  Standard Subjects (Check to Add)
                                </label>
                                <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
                                  {availablePredefined.map(subject => (
                                    <label key={subject} className="flex items-center gap-2 cursor-pointer group bg-white border border-stone-200 p-2 rounded-sm hover:border-[#6b4c9a] transition-colors shadow-sm has-[:checked]:border-[#6b4c9a] has-[:checked]:bg-[#fbf9fc]">
                                      <input 
                                        type="checkbox" 
                                        name="predefinedSubjects" 
                                        value={subject} 
                                        className="w-3.5 h-3.5 text-[#6b4c9a] border-stone-300 rounded-sm focus:ring-[#6b4c9a] cursor-pointer accent-[#6b4c9a]" 
                                      />
                                      <span className="text-[11px] text-stone-700 font-bold tracking-wide group-hover:text-[#6b4c9a] transition-colors truncate">
                                        {subject}
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Custom Subject Input */}
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-2">
                                Add Custom Subject
                              </label>
                              <div className="flex flex-col sm:flex-row gap-3">
                                <input 
                                  type="text" 
                                  name="customSubject" 
                                  placeholder="Type a custom subject..." 
                                  className="flex-grow p-2.5 border border-stone-300 rounded-sm text-sm font-medium bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm" 
                                />
                                <div className="flex gap-2 shrink-0">
                                  <button 
                                    type="submit" 
                                    disabled={isSubmitting} 
                                    className="bg-[#6b4c9a] border border-[#6b4c9a] text-white px-5 py-2.5 rounded-sm text-[11px] uppercase tracking-widest font-bold hover:bg-[#5a3f82] transition-colors disabled:opacity-50 shadow-sm"
                                  >
                                    Save
                                  </button>
                                  {mappedSubjects.length > 0 && (
                                    <button 
                                      type="button" 
                                      onClick={() => setManagingSubjectsClassId(null)}
                                      className="bg-white border border-stone-300 text-stone-700 px-5 py-2.5 rounded-sm text-[11px] uppercase tracking-widest font-bold hover:bg-stone-50 transition-colors shadow-sm"
                                    >
                                      Cancel
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                          </form>
                        </div>
                      ) : (
                        <div className="p-5 sm:p-6 bg-stone-50 border-t border-stone-100 flex justify-center mt-auto">
                          <button 
                            onClick={() => setManagingSubjectsClassId(cls.id)}
                            className="w-full bg-white border border-stone-300 text-stone-700 px-6 py-2.5 rounded-sm text-[11px] uppercase tracking-widest font-bold hover:border-[#6b4c9a] hover:text-[#6b4c9a] transition-colors shadow-sm"
                          >
                            Manage Subjects
                          </button>
                        </div>
                      )}
                    </>
                  )}

                </div>
              )
            })}
          </div>
        )}
      </section>

    </div>
  )
}