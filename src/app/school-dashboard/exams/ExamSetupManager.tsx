'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { saveExamConfiguration, removeSubjectFromExam, deleteExam, updateExam } from '@/app/actions/exam-actions'
import Dropdown from '@/components/ui/dropdown'

export default function ExamSetupManager({ exams, classes, subjects, classSubjects, existingConfigs }: any) {
  const router = useRouter()
  
  // Filtering & UI State
  const [filterClassId, setFilterClassId] = useState<string | number>('')
  const [expandedExamId, setExpandedExamId] = useState<string | null>(null)
  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Edit State (initialized when an exam is expanded)
  const [editDate, setEditDate] = useState<string>('')
  const [currentExamConfigs, setCurrentExamConfigs] = useState<Record<string, any>>({})

  // Dropdown options
  const filterClassOptions = [{ label: 'All Classes', value: '' }, ...classes.map((c: any) => ({ label: `Class: ${c.name}`, value: c.id }))]

  // Derived filtered exams list
  const filteredExams = useMemo(() => {
    if (!filterClassId) return exams
    return exams.filter((e: any) => e.class_id === filterClassId)
  }, [exams, filterClassId])

  // Get available subjects for the currently expanded exam's class
  const availableSubjectOptions = useMemo(() => {
    if (!expandedExamId) return []
    const exam = exams.find((e: any) => e.id === expandedExamId)
    if (!exam) return []
    
    const assignedSubjectIds = classSubjects.filter((cs: any) => cs.class_id === exam.class_id).map((cs: any) => cs.subject_id)
    const available = subjects.filter((s: any) => assignedSubjectIds.includes(s.id))
    
    return available
      .filter((s: any) => !currentExamConfigs[s.id])
      .map((s: any) => ({ label: `+ Add ${s.name}`, value: s.id }))
  }, [expandedExamId, exams, classSubjects, subjects, currentExamConfigs])

  // Handle expanding an exam to edit it
  const handleExpandExam = (exam: any) => {
    if (expandedExamId === exam.id) {
      setExpandedExamId(null)
      return
    }
    
    // Initialize editing state for this specific exam
    setExpandedExamId(exam.id)
    setEditDate(exam.exam_date || '')
    setExpandedSubjectId(null)
    
    const configsForExam = existingConfigs.filter((c: any) => c.exam_id === exam.id)
    const newState: Record<string, any> = {}
    configsForExam.forEach((c: any) => {
      newState[c.subject_id] = {
        breakdowns: c.breakdowns || [],
        isIndividualPass: c.is_individual_pass,
        totalMax: c.total_max_marks,
        totalPass: c.total_pass_mark
      }
    })
    setCurrentExamConfigs(newState)
  }

  // Handle Deleting Exam
  const handleDeleteExam = async (examId: string, examName: string) => {
    if (!window.confirm(`Are you absolutely sure you want to permanently delete "${examName}"? All marks and setups will be erased.`)) return
    try {
      await deleteExam(examId)
      alert("Exam deleted successfully.")
      if (expandedExamId === examId) setExpandedExamId(null)
      router.refresh()
    } catch (error: any) { alert(`Error: ${error.message}`) }
  }

  // Handle Adding Subject
  const handleAddSubject = (subjectId: string | number) => {
    if (!subjectId) return
    if (!currentExamConfigs[subjectId]) {
      setCurrentExamConfigs(prev => ({
        ...prev,
        [subjectId]: { breakdowns: [], isIndividualPass: false, totalMax: 100, totalPass: 33 }
      }))
    }
    setExpandedSubjectId(String(subjectId)) 
  }

  // Handle Removing Subject
  const handleRemoveSubject = async (subjectId: string) => {
    if (!window.confirm("Remove this subject from the exam curriculum?")) return
    const newState = { ...currentExamConfigs }
    delete newState[subjectId]
    setCurrentExamConfigs(newState)
    if (expandedSubjectId === subjectId) setExpandedSubjectId(null)
    try { await removeSubjectFromExam(expandedExamId!, subjectId) } catch (e) {}
  }

  // Handle Updating Subject Config State
  const updateSubjectConfig = (subjectId: string, updates: any) => {
    setCurrentExamConfigs(prev => {
      const current = prev[subjectId]
      const updated = { ...current, ...updates }
      if (updated.breakdowns.length > 0) {
        updated.totalMax = updated.breakdowns.reduce((sum: number, b: any) => sum + (Number(b.max) || 0), 0)
        if (updated.isIndividualPass) {
          updated.totalPass = updated.breakdowns.reduce((sum: number, b: any) => sum + (Number(b.pass) || 0), 0)
        }
      }
      return { ...prev, [subjectId]: updated }
    })
  }

  // Master Save Function (Saves Date & Subject Configs)
  const handleMasterSave = async (exam: any) => {
    setIsSubmitting(true)
    try {
      // 1. Save Date if changed
      const fd = new FormData()
      fd.append('examId', exam.id)
      fd.append('name', exam.name) 
      fd.append('examDate', editDate)
      await updateExam(fd)

      // 2. Save Subject Configs
      const promises = Object.keys(currentExamConfigs).map(subjectId => {
        const conf = currentExamConfigs[subjectId]
        return saveExamConfiguration({
          examId: exam.id, classId: exam.class_id, subjectId: subjectId,
          breakdowns: conf.breakdowns, isIndividualPass: conf.isIndividualPass,
          totalMax: Number(conf.totalMax), totalPass: Number(conf.totalPass)
        })
      })
      await Promise.all(promises)
      
      alert("Exam setup updated successfully!")
      setExpandedExamId(null)
      router.refresh()
    } catch (error: any) { alert(`Error: ${error.message}`) } 
    finally { setIsSubmitting(false) }
  }

  return (
    <div className="bg-white rounded-sm shadow-sm border border-stone-200 overflow-hidden font-sans flex flex-col h-full max-h-[850px]">
      
      {/* HEADER & FILTER */}
      <div className="bg-[#fbf9fc] p-6 border-b border-[#dad3e3] shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div>
          <h2 className="text-xl font-semibold text-stone-900 uppercase tracking-wide">Exam Manager</h2>
          <p className="text-sm font-medium text-stone-600 mt-1">Configure subjects, dates, and grading for all exams.</p>
        </div>
        <div className="w-full sm:w-64 relative z-20">
          <Dropdown options={filterClassOptions} value={filterClassId} onChange={setFilterClassId} placeholder="Filter by Class..." hasSearch={true} />
        </div>
      </div>

      {/* EXAM LIST */}
      <div className="overflow-y-auto custom-scrollbar flex-grow bg-stone-50 p-6 space-y-4">
        {filteredExams.length === 0 ? (
          <div className="flex items-center justify-center h-48 border-2 border-dashed border-stone-300 rounded-sm bg-white text-stone-500 font-medium text-sm">
            No exams found. Create one from the left panel.
          </div>
        ) : (
          filteredExams.map((exam: any) => {
            const cls = classes.find((c: any) => c.id === exam.class_id)
            const isExpanded = expandedExamId === exam.id

            // Calculate current configs for summary display
            const configsForThisExam = existingConfigs.filter((c: any) => c.exam_id === exam.id)
            const examTotalMarks = configsForThisExam.reduce((sum: number, c: any) => sum + (Number(c.total_max_marks) || 0), 0)

            return (
              <div key={exam.id} className={`bg-white rounded-sm shadow-sm border transition-all duration-300 ${isExpanded ? 'border-[#6b4c9a] ring-1 ring-[#6b4c9a]' : 'border-stone-200 hover:border-stone-300 hover:shadow-md'}`}>
                
                {/* Accordion Header */}
                <div className={`p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 cursor-pointer transition-colors ${isExpanded ? 'bg-[#fbf9fc] border-b border-[#dad3e3]' : ''}`} onClick={() => handleExpandExam(exam)}>
                  
                  <div className="pr-8 w-full">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <span className="text-[9px] text-[#6b4c9a] bg-white border border-[#dad3e3] px-1.5 py-0.5 rounded-sm shadow-sm font-bold uppercase tracking-wider">Class: {cls?.name || 'Unknown'}</span>
                      <span className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">{exam.exam_date ? new Date(exam.exam_date).toLocaleDateString('en-GB') : 'TBD'}</span>
                    </div>
                    
                    <h3 className="text-lg font-bold text-stone-900 truncate leading-tight mb-3">{exam.name}</h3>
                    
                    {/* Dynamic Subjects & Total Marks Summary */}
                    {configsForThisExam.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {configsForThisExam.map((c: any) => {
                          const sName = subjects.find((s: any) => s.id === c.subject_id)?.name || 'Unknown'
                          return (
                            <span key={c.subject_id} className="text-[9px] font-bold uppercase tracking-wider text-stone-600 bg-stone-50 border border-stone-200 px-1.5 py-0.5 rounded-sm">
                              {sName}: {c.total_max_marks}
                            </span>
                          )
                        })}
                        <span className="text-[9px] font-bold uppercase tracking-wider text-white bg-[#6b4c9a] border border-[#5a3f82] px-2 py-0.5 rounded-sm ml-1 shadow-sm">
                          Total: {examTotalMarks}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-stone-400 font-medium uppercase tracking-wider italic">No subjects configured yet.</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0 sm:pt-1">
                    
                    {/* Conditionally rendered Add Marks Button */}
                    {configsForThisExam.length > 0 && (
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          router.push(`/school-dashboard/marks-entry?classId=${exam.class_id}&examId=${exam.id}`);
                        }} 
                        className="text-[10px] uppercase tracking-widest font-bold text-stone-700 bg-white hover:text-[#6b4c9a] hover:bg-stone-50 border border-stone-200 hover:border-[#dad3e3] px-3 py-1.5 rounded-sm transition-all shadow-sm flex items-center gap-1.5"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                        Add Marks
                      </button>
                    )}

                    {/* Styled Configure / Close Setup Button */}
                    <span className={`text-[10px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-sm transition-all shadow-sm border ${
                      isExpanded 
                        ? 'text-[#6b4c9a] bg-white border-[#dad3e3] hover:bg-[#fbf9fc]' 
                        : 'text-stone-700 bg-white border-stone-200 hover:bg-stone-50 hover:border-stone-300'
                    }`}>
                      {isExpanded ? 'Close Setup' : 'Configure'}
                    </span>
                    
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteExam(exam.id, exam.name); }} 
                      className="text-[10px] uppercase tracking-widest font-bold text-[#b4483e] bg-white hover:bg-[#fcf8f8] border border-stone-200 hover:border-[#b4483e]/30 px-3 py-1.5 rounded-sm transition-all shadow-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Expanded Manager Content */}
                {isExpanded && (
                  <div className="p-6 space-y-8">
                    
                    {/* Basic Info Editor */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 p-5 bg-stone-50 border border-stone-200 rounded-sm">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">Class (Unchangeable)</label>
                        <input type="text" value={cls?.name || ''} disabled className="w-full p-2.5 bg-stone-100 border border-stone-200 rounded-sm text-sm font-bold text-stone-600 cursor-not-allowed" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">Exam Name (Unchangeable)</label>
                        <input type="text" value={exam.name} disabled className="w-full p-2.5 bg-stone-100 border border-stone-200 rounded-sm text-sm font-bold text-stone-600 cursor-not-allowed" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#6b4c9a] mb-1.5">Exam Date (Editable)</label>
                        <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full p-2.5 bg-white border border-[#6b4c9a]/50 rounded-sm text-sm font-medium text-stone-900 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all" />
                      </div>
                    </div>

                    {/* Subject Configuration */}
                    <div>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                        <div>
                          <h4 className="text-sm font-bold text-stone-900 uppercase tracking-wide">Curriculum Setup</h4>
                          <p className="text-xs text-stone-500 font-medium mt-0.5">Define subjects and grading components.</p>
                        </div>
                        <div className="w-full sm:w-64 relative z-10">
                          {availableSubjectOptions.length === 0 ? (
                            <button
                              type="button"
                              onClick={() => {
                                const assignedSubjectIds = classSubjects.filter((cs: any) => cs.class_id === exam.class_id).map((cs: any) => cs.subject_id);
                                if (assignedSubjectIds.length === 0) {
                                  alert("No subjects available! Please create and assign subjects to this class first from the school setup page.");
                                } else {
                                  alert("All available subjects have already been added to this exam configuration.");
                                }
                              }}
                              className="w-full flex items-center justify-between p-3 bg-stone-50 border border-stone-200 rounded-sm text-sm font-medium text-stone-400 cursor-pointer hover:bg-stone-100 transition-colors text-left shadow-sm"
                            >
                              <span>+ Add Subject...</span>
                              <svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>
                          ) : (
                            <Dropdown options={availableSubjectOptions} value="" onChange={handleAddSubject} placeholder="+ Add Subject..." hasSearch={true} />
                          )}
                        </div>
                      </div>

                      {Object.keys(currentExamConfigs).length === 0 ? (
                        <div className="text-center py-10 text-xs text-stone-500 font-medium border border-dashed border-stone-300 rounded-sm">No subjects attached to this exam.</div>
                      ) : (
                        <div className="space-y-4">
                          {Object.keys(currentExamConfigs).map(subjectId => {
                            const subName = subjects.find((s: any) => s.id === subjectId)?.name || 'Unknown'
                            const conf = currentExamConfigs[subjectId]
                            const isSubExpanded = expandedSubjectId === subjectId

                            return (
                              <div key={subjectId} className="bg-white border border-stone-200 rounded-sm overflow-hidden shadow-sm">
                                <div className={`px-5 py-3.5 flex justify-between items-center cursor-pointer transition-colors ${isSubExpanded ? 'bg-[#fbf9fc] border-b border-[#dad3e3]' : 'hover:bg-stone-50'}`} onClick={() => setExpandedSubjectId(isSubExpanded ? null : subjectId)}>
                                  <div className="flex items-center gap-4">
                                    <h5 className="font-bold text-stone-800 text-sm">{subName}</h5>
                                    {!isSubExpanded && (
                                      <div className="hidden sm:flex gap-2">
                                        <span className="bg-stone-100 text-stone-600 px-2 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider">Max: {conf.totalMax}</span>
                                        <span className="bg-[#fcf8f8] text-[#b4483e] px-2 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider">Pass: {conf.totalPass}</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-[10px] uppercase tracking-widest font-bold text-[#6b4c9a]">{isSubExpanded ? 'Close' : 'Edit'}</span>
                                    <button onClick={(e) => { e.stopPropagation(); handleRemoveSubject(subjectId); }} className="text-[10px] uppercase tracking-widest font-bold text-[#b4483e] hover:bg-[#fcf8f8] px-2 py-1.5 rounded-sm transition-all border border-transparent hover:border-[#b4483e]/30">Remove</button>
                                  </div>
                                </div>

                                {isSubExpanded && (
                                  <div className="p-5 space-y-5 bg-white">
                                    {/* Breakdowns */}
                                    <div>
                                      <div className="flex justify-between items-center mb-3">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-stone-600">Grading Components (Optional)</label>
                                        <button onClick={() => updateSubjectConfig(subjectId, { breakdowns: [...conf.breakdowns, { name: '', max: 0, pass: 0 }] })} className="text-[10px] uppercase tracking-widest font-bold text-[#6b4c9a] bg-[#fbf9fc] border border-[#dad3e3] px-3 py-1.5 rounded-sm hover:bg-[#f3eff8] transition-colors shadow-sm">+ Add Part</button>
                                      </div>
                                      
                                      {conf.breakdowns.length > 0 && (
                                        <div className="bg-stone-50 p-4 rounded-sm border border-stone-200 space-y-3">
                                          {conf.breakdowns.map((b: any, idx: number) => (
                                            <div key={idx} className="flex flex-wrap sm:flex-nowrap gap-3 items-center">
                                              <input type="text" placeholder="Name (e.g. Written)" value={b.name} onChange={(e) => { const newB = [...conf.breakdowns]; newB[idx].name = e.target.value; updateSubjectConfig(subjectId, { breakdowns: newB }) }} className="flex-grow min-w-[120px] p-2 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 focus:outline-none focus:border-[#6b4c9a]" />
                                              <input type="number" placeholder="Max" value={b.max || ''} onChange={(e) => { const newB = [...conf.breakdowns]; newB[idx].max = e.target.value; updateSubjectConfig(subjectId, { breakdowns: newB }) }} className="w-20 p-2 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 focus:outline-none focus:border-[#6b4c9a]" />
                                              <input type="number" placeholder="Pass" value={b.pass || ''} onChange={(e) => { const newB = [...conf.breakdowns]; newB[idx].pass = e.target.value; updateSubjectConfig(subjectId, { breakdowns: newB }) }} className="w-20 p-2 bg-[#fcf8f8] border border-[#b4483e]/40 rounded-sm text-sm text-[#b4483e] font-bold focus:outline-none focus:border-[#b4483e]" />
                                              <button onClick={() => { const newB = conf.breakdowns.filter((_: any, i: number) => i !== idx); updateSubjectConfig(subjectId, { breakdowns: newB }) }} className="p-1.5 text-stone-400 hover:text-[#b4483e] transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                                            </div>
                                          ))}
                                          <label className="flex items-center gap-3 mt-3 p-3 bg-white border border-stone-200 rounded-sm cursor-pointer shadow-sm">
                                            <input type="checkbox" checked={conf.isIndividualPass} onChange={(e) => updateSubjectConfig(subjectId, { isIndividualPass: e.target.checked })} className="w-4 h-4 text-[#6b4c9a] bg-stone-50 border-stone-300 rounded-sm focus:ring-[#6b4c9a] accent-[#6b4c9a] cursor-pointer" />
                                            <span className="block text-[11px] font-bold text-stone-700 uppercase tracking-wide">Strict Component Passing Required</span>
                                          </label>
                                        </div>
                                      )}
                                    </div>
                                    
                                    <div className="flex gap-5 pt-4 border-t border-stone-100">
                                      <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">Total Max</label>
                                        <input type="number" value={conf.totalMax} onChange={e => updateSubjectConfig(subjectId, { totalMax: e.target.value })} disabled={conf.breakdowns.length > 0} className="w-24 p-2.5 text-sm font-bold bg-stone-100 border border-stone-300 rounded-sm text-stone-900 disabled:opacity-70 focus:outline-none focus:border-[#6b4c9a]" />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#b4483e] mb-1">Total Pass</label>
                                        <input type="number" value={conf.totalPass} onChange={e => updateSubjectConfig(subjectId, { totalPass: e.target.value })} disabled={conf.breakdowns.length > 0 && conf.isIndividualPass} className="w-24 p-2.5 text-sm font-bold bg-[#fcf8f8] border border-[#b4483e]/50 rounded-sm text-[#b4483e] disabled:opacity-70 focus:outline-none focus:border-[#b4483e]" />
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    
                    {/* Master Save */}
                    <div className="pt-6 border-t border-stone-200 flex justify-end">
                      <button onClick={() => handleMasterSave(exam)} disabled={isSubmitting} className="w-full sm:w-auto bg-[#6b4c9a] text-white px-8 py-3.5 rounded-sm text-xs uppercase tracking-widest font-bold hover:bg-[#5a3f82] transition-colors disabled:opacity-50 shadow-md">
                        {isSubmitting ? 'Saving All...' : 'Save Exam & Subjects'}
                      </button>
                    </div>

                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}