'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { saveFullExamSetup, deleteExam } from '@/app/actions/exam-actions'
import Dropdown from '@/components/ui/dropdown'

// --- Number Conversion Helpers ---
const toBengaliNumber = (num: number | string) => {
  if (num === null || num === undefined || num === '') return ''
  const englishToBengali: Record<string, string> = {
    '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', 
    '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
  }
  return String(num).replace(/[0-9]/g, char => englishToBengali[char])
}

const toEnglishNumber = (str: string) => {
  if (!str) return ''
  const bengaliToEnglish: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', 
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
  }
  return String(str).replace(/[০-৯]/g, char => bengaliToEnglish[char])
}

export default function ExamSetupManager({ schoolId, exams, classes, subjects, classSubjects, existingConfigs }: any) {
  const router = useRouter()
  
  // --- Global State ---
  const [viewMode, setViewMode] = useState<'list' | 'form'>('list')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [filterClassId, setFilterClassId] = useState<string | number>('')

  // --- Form State ---
  const [editingExamId, setEditingExamId] = useState<string | null>(null)
  const [formClassId, setFormClassId] = useState<string | number>('')
  const [examName, setExamName] = useState<string>('')
  const [examDate, setExamDate] = useState<string>('')
  const [subjectConfigs, setSubjectConfigs] = useState<Record<string, any>>({})
  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null)

  // --- Dropdown Options ---
  const classOptions = classes.map((c: any) => ({ label: c.name, value: c.id }))
  const filterClassOptions = [{ label: 'সকল শ্রেণি / All Classes', value: '' }, ...classOptions]

  const filteredExams = useMemo(() => {
    if (!filterClassId) return exams
    return exams.filter((e: any) => e.class_id === filterClassId)
  }, [exams, filterClassId])

  // Get available subjects for the class selected inside the FORM
  const availableSubjectOptions = useMemo(() => {
    if (!formClassId) return []
    const assignedSubjectIds = classSubjects.filter((cs: any) => cs.class_id === formClassId).map((cs: any) => cs.subject_id)
    const available = subjects.filter((s: any) => assignedSubjectIds.includes(s.id))
    
    return available
      .filter((s: any) => !subjectConfigs[s.id])
      .map((s: any) => ({ label: `+ Add ${s.name}`, value: s.id }))
  }, [formClassId, classSubjects, subjects, subjectConfigs])

  // --- Actions: Form Triggers ---
  const handleOpenCreateForm = () => {
    setEditingExamId(null)
    setFormClassId('')
    setExamName('')
    setExamDate('')
    setSubjectConfigs({})
    setViewMode('form')
  }

  const handleOpenEditForm = (exam: any) => {
    setEditingExamId(exam.id)
    setFormClassId(exam.class_id)
    setExamName(exam.name)
    setExamDate(exam.exam_date || '')
    
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
    setSubjectConfigs(newState)
    setViewMode('form')
  }

  const handleDeleteExam = async (examId: string, name: string) => {
    if (!window.confirm(`আপনি কি "${name}" মুছে ফেলতে চান? / Are you sure you want to delete "${name}"?`)) return
    try {
      await deleteExam(examId)
      alert("পরীক্ষা সফলভাবে মুছে ফেলা হয়েছে! / Exam deleted successfully!")
      router.refresh()
    } catch (e: any) { alert(`Error: ${e.message}`) }
  }

  // --- Actions: Configuration Builders ---
  const handleAddSubject = (subId: string | number) => {
    if (!subId) return
    setSubjectConfigs(prev => ({
      ...prev,
      [subId]: { breakdowns: [], isIndividualPass: false, totalMax: 100, totalPass: 33 }
    }))
    setExpandedSubjectId(String(subId))
    alert("পাঠ্যক্রমে বিষয় যোগ করা হয়েছে! / Subject added to curriculum!")
  }

  const handleRemoveSubject = (subId: string) => {
    if (!window.confirm("এই বিষয়টি মুছে ফেলতে চান? / Remove this subject?")) return
    const newState = { ...subjectConfigs }
    delete newState[subId]
    setSubjectConfigs(newState)
    if (expandedSubjectId === subId) setExpandedSubjectId(null)
    alert("বিষয় মুছে ফেলা হয়েছে! / Subject removed!")
  }

  const updateSubjectConfig = (subId: string, updates: any) => {
    setSubjectConfigs(prev => {
      const current = prev[subId]
      const updated = { ...current, ...updates }
      if (updated.breakdowns.length > 0) {
        updated.totalMax = updated.breakdowns.reduce((sum: number, b: any) => sum + (Number(b.max) || 0), 0)
        if (updated.isIndividualPass) {
          updated.totalPass = updated.breakdowns.reduce((sum: number, b: any) => sum + (Number(b.pass) || 0), 0)
        }
      }
      return { ...prev, [subId]: updated }
    })
  }

  const handleAddBreakdown = (subId: string) => {
    updateSubjectConfig(subId, { breakdowns: [...subjectConfigs[subId].breakdowns, { name: '', max: 0, pass: 0 }] })
  }

  // --- Actions: Master Save ---
  const handleSaveExamSetup = async () => {
    if (!formClassId || !examName || !examDate) return alert("প্রাথমিক তথ্যগুলো পূরণ করুন! / Please fill all basic details!")
    if (Object.keys(subjectConfigs).length === 0) return alert("অন্তত একটি বিষয় যোগ করুন! / Please add at least one subject!")

    setIsSubmitting(true)
    try {
      await saveFullExamSetup({
        examId: editingExamId,
        schoolId,
        classId: String(formClassId),
        name: examName,
        examDate,
        configs: subjectConfigs
      })
      alert("পরীক্ষা ও সেটআপ সফলভাবে সংরক্ষণ করা হয়েছে! / Exam & Setup saved successfully!")
      setViewMode('list')
      router.refresh()
    } catch (e: any) { alert(`Error: ${e.message}`) }
    finally { setIsSubmitting(false) }
  }

  return (
    <div className="bg-white rounded-sm shadow-sm border border-stone-200 overflow-hidden font-sans flex flex-col min-h-[700px]">
      
      {/* 
      =========================================================
        HEADER ACTIONS
      ========================================================= 
      */}
      <div className="bg-[#fbf9fc] p-6 border-b border-[#dad3e3] flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative z-20">
        <div>
          <h2 className="flex items-end flex-wrap gap-2.5 leading-none">
            <span className="text-2xl font-bold text-stone-900">পরীক্ষা ইঞ্জিন</span>
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#6b4c9a] mb-0.5">/ Exam Engine</span>
          </h2>
          <p className="text-xs font-medium text-stone-500 mt-2 uppercase tracking-widest">Setup and manage assessments.</p>
        </div>
        
        {viewMode === 'list' ? (
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <div className="w-full sm:w-64">
              <Dropdown options={filterClassOptions} value={filterClassId} onChange={setFilterClassId} placeholder="শ্রেণি ফিল্টার করুন / Filter Class" hasSearch={true} />
            </div>
            <button onClick={handleOpenCreateForm} className="w-full sm:w-auto bg-[#6b4c9a] text-white px-6 py-3 rounded-sm transition-colors shadow-sm flex items-center justify-center gap-2 hover:bg-[#5a3f82]">
              <span className="text-base font-bold leading-none">পরীক্ষা যোগ করুন</span>
              <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-white leading-none mt-1">/ Add Exam</span>
            </button>
          </div>
        ) : (
          <button onClick={() => setViewMode('list')} className="w-full sm:w-auto bg-white border border-stone-300 text-stone-700 px-6 py-3 rounded-sm transition-colors shadow-sm flex items-center justify-center gap-2 hover:bg-stone-50">
            <span className="text-base font-bold leading-none">তালিকায় ফিরে যান</span>
            <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-stone-500 leading-none mt-1">/ Back to List</span>
          </button>
        )}
      </div>

      {/* 
      =========================================================
        VIEW 1: EXAM LISTING
      ========================================================= 
      */}
      {viewMode === 'list' && (
        <div className="p-6 bg-stone-50 flex-grow space-y-5">
          {filteredExams.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-stone-300 rounded-sm bg-white">
              <span className="text-xl font-bold text-stone-800 leading-none">কোনো পরীক্ষা পাওয়া যায়নি</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-stone-500 mt-2.5 leading-none">/ No Exams Found</span>
              <p className="text-xs mt-4 italic text-stone-500">Click "Add Exam" to create one.</p>
            </div>
          ) : (
            filteredExams.map((exam: any) => {
              const cls = classes.find((c: any) => c.id === exam.class_id)
              const configsForThisExam = existingConfigs.filter((c: any) => c.exam_id === exam.id)
              const examTotalMarks = configsForThisExam.reduce((sum: number, c: any) => sum + (Number(c.total_max_marks) || 0), 0)

              return (
                <div key={exam.id} className="bg-white rounded-sm shadow-sm border border-stone-200 hover:border-[#6b4c9a]/50 hover:shadow-md transition-all p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-5">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold text-white bg-stone-800 px-2 py-1 rounded-sm uppercase tracking-widest">{cls?.name || 'Class'}</span>
                      <span className="text-[10px] font-bold text-stone-600 uppercase tracking-widest border border-stone-200 px-2 py-1 rounded-sm bg-stone-50">
                        {exam.exam_date ? new Date(exam.exam_date).toLocaleDateString('en-GB') : 'No Date'}
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-stone-900 mb-3">{exam.name}</h3>
                    
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className="text-[10px] font-bold text-white bg-[#6b4c9a] px-2 py-1 rounded-sm shadow-sm flex items-baseline gap-1.5">
                        <span className="text-[13px]">মোট: {toBengaliNumber(examTotalMarks)}</span>
                        <span className="text-[8px] font-medium uppercase tracking-[0.2em] text-white">/ Total Marks</span>
                      </span>
                      {configsForThisExam.map((c: any) => {
                        const sName = subjects.find((s: any) => s.id === c.subject_id)?.name || 'Subject'
                        return (
                          <span key={c.subject_id} className="text-[12px] font-bold text-stone-700 bg-stone-50 border border-stone-200 px-2 py-1 rounded-sm">
                            {sName}
                          </span>
                        )
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 border-t border-stone-100 pt-4 sm:border-t-0 sm:pt-0">
                    <button 
                      onClick={() => router.push(`/school-dashboard/marks-entry?classId=${exam.class_id}&examId=${exam.id}`)}
                      className="text-[10px] font-bold uppercase tracking-widest text-[#6b4c9a] bg-[#fbf9fc] border border-[#dad3e3] hover:bg-[#f3eff8] px-4 py-2 rounded-sm transition-colors shadow-sm whitespace-nowrap"
                    >
                      Add Marks / নম্বর যোগ করুন
                    </button>
                    <button 
                      onClick={() => handleOpenEditForm(exam)}
                      className="text-[10px] font-bold uppercase tracking-widest text-stone-700 bg-white border border-stone-300 hover:bg-stone-50 px-4 py-2 rounded-sm transition-colors shadow-sm"
                    >
                      Edit / সম্পাদনা
                    </button>
                    <button 
                      onClick={() => handleDeleteExam(exam.id, exam.name)}
                      className="text-[10px] font-bold uppercase tracking-widest text-[#b4483e] bg-[#fcf8f8] border border-[#b4483e]/30 hover:bg-red-50 px-4 py-2 rounded-sm transition-colors shadow-sm"
                    >
                      Delete / মুছুন
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* 
      =========================================================
        VIEW 2: UNIFIED CREATION & CONFIGURATION FORM
      ========================================================= 
      */}
      {viewMode === 'form' && (
        <div className="flex flex-col flex-grow bg-white">
          
          {/* Section 1: Basic Details */}
          <div className="p-6 md:p-8 border-b border-stone-200 bg-stone-50">
            <h3 className="flex items-center gap-3 mb-6">
              <span className="bg-[#6b4c9a] text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0">1</span>
              <div className="flex items-end flex-wrap gap-2.5 leading-none mt-0.5">
                <span className="text-lg font-bold text-stone-800">প্রাথমিক তথ্য</span>
                <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-stone-600 mb-0.5">/ Basic Details</span>
              </div>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
              <div>
                <label className="flex items-end flex-wrap gap-2 mb-2.5 leading-none">
                  <span className="text-base font-bold text-stone-800">শ্রেণি</span>
                  <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-stone-600 mb-0.5">/ Class</span>
                </label>
                <Dropdown 
                  options={classOptions} 
                  value={formClassId} 
                  onChange={(val) => {
                    if(Object.keys(subjectConfigs).length > 0 && !window.confirm("শ্রেণি পরিবর্তন করলে বর্তমান বিষয়গুলো মুছে যাবে। চালিয়ে যাবেন? / Changing class clears current subjects. Continue?")) return;
                    setFormClassId(val)
                    setSubjectConfigs({}) 
                  }} 
                  placeholder="শ্রেণি নির্বাচন করুন" 
                  hasSearch={true} 
                  disabled={!!editingExamId} 
                />
              </div>
              <div>
                <label className="flex items-end flex-wrap gap-2 mb-2.5 leading-none">
                  <span className="text-base font-bold text-stone-800">পরীক্ষার নাম</span>
                  <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-stone-600 mb-0.5">/ Exam Name</span>
                </label>
                <input 
                  type="text" value={examName} onChange={e => setExamName(e.target.value)} placeholder="যেমন: ১ম প্রান্তিক মূল্যায়ন ২০২৬"
                  className="w-full p-2.5 bg-white border border-stone-300 rounded-sm text-base font-bold text-stone-900 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm" 
                />
              </div>
              <div>
                <label className="flex items-end flex-wrap gap-2 mb-2.5 leading-none">
                  <span className="text-base font-bold text-stone-800">তারিখ</span>
                  <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-stone-600 mb-0.5">/ Date</span>
                </label>
                <input 
                  type="date" value={examDate} onChange={e => setExamDate(e.target.value)}
                  className="w-full p-2.5 bg-white border border-stone-300 rounded-sm text-base font-bold text-stone-900 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm" 
                />
              </div>
            </div>
          </div>

          {/* Section 2: Subject & Curriculum Setup */}
          <div className="p-6 md:p-8 flex-grow">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h3 className="flex items-center gap-3">
                <span className="bg-[#6b4c9a] text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0">2</span>
                <div className="flex items-end flex-wrap gap-2.5 leading-none mt-0.5">
                  <span className="text-lg font-bold text-stone-800">পাঠ্যক্রম সেটআপ</span>
                  <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-stone-600 mb-0.5">/ Curriculum Setup</span>
                </div>
              </h3>
              <div className="w-full sm:w-72 relative z-0">
                {availableSubjectOptions.length === 0 ? (
                  <div className="w-full p-2.5 bg-stone-100 border border-stone-200 rounded-sm flex items-center justify-center gap-2">
                    <span className="text-sm font-bold text-stone-500">
                      {formClassId ? "সব বিষয় যুক্ত করা হয়েছে" : "প্রথমে শ্রেণি নির্বাচন করুন"}
                    </span>
                    <span className="text-[8px] font-medium uppercase tracking-[0.2em] text-stone-500">
                      / {formClassId ? "All Added" : "Select Class First"}
                    </span>
                  </div>
                ) : (
                  <Dropdown options={availableSubjectOptions} value="" onChange={handleAddSubject} placeholder="+ বিষয় যোগ করুন / Add Subject" hasSearch={true} />
                )}
              </div>
            </div>

            {Object.keys(subjectConfigs).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-stone-300 rounded-sm bg-stone-50">
                <span className="text-base font-bold text-stone-500 leading-none">কোনো বিষয় যুক্ত করা হয়নি</span>
                <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-stone-500 mt-1.5 leading-none">/ No Subjects Attached</span>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.keys(subjectConfigs).map(subjectId => {
                  const subName = subjects.find((s: any) => s.id == subjectId)?.name || 'Unknown'
                  const conf = subjectConfigs[subjectId]
                  const isSubExpanded = expandedSubjectId === subjectId

                  return (
                    <div key={subjectId} className={`bg-white border rounded-sm overflow-hidden shadow-sm transition-colors ${isSubExpanded ? 'border-[#6b4c9a]' : 'border-stone-200'}`}>
                      {/* Accordion Head */}
                      <div className={`px-5 py-4 flex justify-between items-center cursor-pointer hover:bg-stone-50 ${isSubExpanded ? 'bg-[#fbf9fc] border-b border-[#dad3e3]' : ''}`} onClick={() => setExpandedSubjectId(isSubExpanded ? null : subjectId)}>
                        <div className="flex items-center gap-4">
                          <h5 className="font-bold text-stone-900 text-sm uppercase tracking-wide">{subName}</h5>
                          {!isSubExpanded && (
                            <div className="hidden sm:flex gap-2">
                              <span className="bg-stone-100 text-stone-700 border border-stone-200 px-2 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider">Max: {toBengaliNumber(conf.totalMax)}</span>
                              <span className="bg-[#fcf8f8] text-[#b4483e] border border-[#b4483e]/20 px-2 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider">Pass: {toBengaliNumber(conf.totalPass)}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="hidden sm:flex items-baseline gap-1.5">
                            <span className="font-bold text-sm text-[#6b4c9a]">{isSubExpanded ? 'সেটআপ বন্ধ করুন' : 'সেটআপ'}</span>
                            <span className="text-[8px] font-medium uppercase tracking-[0.2em] text-[#6b4c9a]">/ {isSubExpanded ? 'Close Setup' : 'Configure'}</span>
                          </span>
                          <button onClick={(e) => { e.stopPropagation(); handleRemoveSubject(subjectId); }} className="bg-[#b4483e] px-3 py-1.5 rounded-sm shadow-sm hover:bg-red-800 transition-colors flex items-baseline gap-1.5">
                            <span className="text-[13px] font-bold text-white">মুছুন</span>
                            <span className="text-[8px] font-medium uppercase tracking-[0.2em] text-white">/ Remove</span>
                          </button>
                        </div>
                      </div>

                      {/* Expanded Content */}
                      {isSubExpanded && (
                        <div className="p-5 bg-white space-y-6">
                          {/* Breakdowns */}
                          <div>
                            <div className="flex justify-between items-center mb-4">
                              <div className="flex items-end flex-wrap gap-2 leading-none">
                                <span className="text-base font-bold text-stone-800">নম্বর বন্টন (ঐচ্ছিক)</span>
                                <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-stone-600 mb-0.5">/ Grading Components (Optional)</span>
                              </div>
                              <button onClick={() => handleAddBreakdown(subjectId)} className="bg-[#fbf9fc] border border-[#dad3e3] px-4 py-2 rounded-sm hover:bg-[#f3eff8] transition-colors shadow-sm flex items-baseline gap-1.5">
                                <span className="text-sm font-bold text-[#6b4c9a]">+ অংশ যোগ করুন</span>
                                <span className="text-[8px] font-medium uppercase tracking-[0.2em] text-[#6b4c9a]">/ Add Part</span>
                              </button>
                            </div>
                            
                            {conf.breakdowns.length > 0 && (
                              <div className="bg-stone-50 p-4 rounded-sm border border-stone-200 space-y-3">
                                {conf.breakdowns.map((b: any, idx: number) => (
                                  <div key={idx} className="flex flex-wrap sm:flex-nowrap gap-3 items-center">
                                    <input 
                                      type="text" placeholder="অংশের নাম (যেমন: সৃজনশীল)" value={b.name} 
                                      onChange={(e) => { const newB = [...conf.breakdowns]; newB[idx].name = e.target.value; updateSubjectConfig(subjectId, { breakdowns: newB }) }} 
                                      className="flex-grow min-w-[120px] p-2.5 bg-white border border-stone-300 rounded-sm text-base font-bold text-stone-900 focus:outline-none focus:border-[#6b4c9a]" 
                                    />
                                    <input 
                                      type="text" inputMode="numeric" placeholder="পূর্ণমান" value={toBengaliNumber(b.max)} 
                                      onChange={(e) => { 
                                        const val = toEnglishNumber(e.target.value);
                                        if (!/^\d*\.?\d*$/.test(val)) return;
                                        const newB = [...conf.breakdowns]; 
                                        newB[idx].max = val; 
                                        updateSubjectConfig(subjectId, { breakdowns: newB }) 
                                      }} 
                                      className="w-24 p-2.5 bg-white border border-stone-300 rounded-sm text-base font-bold text-stone-900 focus:outline-none focus:border-[#6b4c9a]" 
                                    />
                                    <input 
                                      type="text" inputMode="numeric" placeholder="পাস" value={toBengaliNumber(b.pass)} 
                                      onChange={(e) => { 
                                        const val = toEnglishNumber(e.target.value);
                                        if (!/^\d*\.?\d*$/.test(val)) return;
                                        const newB = [...conf.breakdowns]; 
                                        newB[idx].pass = val; 
                                        updateSubjectConfig(subjectId, { breakdowns: newB }) 
                                      }} 
                                      className="w-24 p-2.5 bg-[#fcf8f8] border border-[#b4483e]/40 rounded-sm text-base text-[#b4483e] font-bold focus:outline-none focus:border-[#b4483e]" 
                                    />
                                    <button onClick={() => { const newB = conf.breakdowns.filter((_: any, i: number) => i !== idx); updateSubjectConfig(subjectId, { breakdowns: newB }); }} className="p-2 text-stone-500 hover:text-[#b4483e] transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                                  </div>
                                ))}
                                <label className="flex items-center gap-3 mt-4 pt-3 border-t border-stone-200 cursor-pointer">
                                  <input type="checkbox" checked={conf.isIndividualPass} onChange={(e) => updateSubjectConfig(subjectId, { isIndividualPass: e.target.checked })} className="w-4 h-4 text-[#6b4c9a] bg-stone-50 border-stone-300 rounded-sm focus:ring-[#6b4c9a] accent-[#6b4c9a] cursor-pointer" />
                                  <div className="flex items-end flex-wrap gap-1.5 leading-none">
                                    <span className="text-[15px] font-bold text-stone-800">প্রতিটি অংশে আলাদা পাস বাধ্যতামূলক</span>
                                    <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-stone-600">/ Strict Passing Required</span>
                                  </div>
                                </label>
                              </div>
                            )}
                          </div>
                          
                          {/* Totals */}
                          <div className="flex flex-wrap gap-8 pt-5 border-t border-stone-100">
                            <div>
                              <label className="flex items-end flex-wrap gap-2 mb-2 leading-none">
                                <span className="text-sm font-bold text-stone-800">মোট নম্বর</span>
                                <span className="text-[8px] font-medium uppercase tracking-[0.2em] text-stone-600">/ Total Max</span>
                              </label>
                              <input 
                                type="text" inputMode="numeric" value={toBengaliNumber(conf.totalMax)} 
                                onChange={e => {
                                  const val = toEnglishNumber(e.target.value);
                                  if (!/^\d*\.?\d*$/.test(val)) return;
                                  updateSubjectConfig(subjectId, { totalMax: val })
                                }} 
                                disabled={conf.breakdowns.length > 0} 
                                className="w-32 p-3 text-lg font-black bg-stone-100 border border-stone-300 rounded-sm text-stone-900 disabled:opacity-60 focus:outline-none focus:border-[#6b4c9a] shadow-inner" 
                              />
                            </div>
                            <div>
                              <label className="flex items-end flex-wrap gap-2 mb-2 leading-none">
                                <span className="text-sm font-bold text-[#b4483e]">পাস নম্বর</span>
                                <span className="text-[8px] font-medium uppercase tracking-[0.2em] text-[#b4483e]">/ Total Pass</span>
                              </label>
                              <input 
                                type="text" inputMode="numeric" value={toBengaliNumber(conf.totalPass)} 
                                onChange={e => {
                                  const val = toEnglishNumber(e.target.value);
                                  if (!/^\d*\.?\d*$/.test(val)) return;
                                  updateSubjectConfig(subjectId, { totalPass: val })
                                }} 
                                disabled={conf.breakdowns.length > 0 && conf.isIndividualPass} 
                                className="w-32 p-3 text-lg font-black bg-[#fcf8f8] border border-[#b4483e]/40 rounded-sm text-[#b4483e] disabled:opacity-60 focus:outline-none focus:border-[#b4483e] shadow-inner" 
                              />
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

          {/* Section 3: Master Save */}
          <div className="p-6 border-t border-stone-200 bg-stone-100 flex justify-end">
            <button onClick={handleSaveExamSetup} disabled={isSubmitting} className="w-full md:w-auto bg-stone-900 text-white px-10 py-4 rounded-sm hover:bg-black transition-colors disabled:opacity-50 shadow-lg">
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="text-base font-bold">সংরক্ষণ হচ্ছে...</span>
                  <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-white mt-1">/ Processing...</span>
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span className="text-base font-bold">সংরক্ষণ করুন</span>
                  <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-white mt-1">/ Save Exam & Setup</span>
                </span>
              )}
            </button>
          </div>

        </div>
      )}
    </div>
  )
}