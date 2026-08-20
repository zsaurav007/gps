'use client'

import { useState, useMemo } from 'react'
import Dropdown from '@/components/ui/dropdown'
import { getMarksSheetData, saveStudentMarks, deleteStudentMark } from '@/app/actions/exam-actions'

export default function MarksEntrySheet({ exams, classes, subjects, examConfigs }: any) {
  // --- 1. Selection State ---
  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const [selectedExamId, setSelectedExamId] = useState<string>('')
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('')

  // --- 2. Data State ---
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [sheetData, setSheetData] = useState<{ students: any[], config: any, marks: any[] } | null>(null)
  
  // --- 3. UI Modes & Filters ---
  const [entryMode, setEntryMode] = useState<'single' | 'bulk'>('single')
  const [searchPending, setSearchPending] = useState('')
  const [searchSaved, setSearchSaved] = useState('')

  // --- 4. Form States ---
  // Single Entry
  const [entryStudentId, setEntryStudentId] = useState<string>('')
  const [entryBreakdowns, setEntryBreakdowns] = useState<Record<string, string>>({})
  const [entryTotal, setEntryTotal] = useState('')
  const [isEditingSingle, setIsEditingSingle] = useState(false)

  // Bulk Entry/Edit
  const [bulkState, setBulkState] = useState<Record<string, { breakdowns: Record<string, string>, total: string }>>({})
  const [isBulkEditing, setIsBulkEditing] = useState(false)

  // --- Dropdown Filtering & Options ---
  const classExams = exams.filter((e: any) => e.class_id === selectedClassId)
  const configuredSubjectIds = examConfigs.filter((c: any) => c.exam_id === selectedExamId).map((c: any) => c.subject_id)
  const availableSubjects = subjects.filter((s: any) => configuredSubjectIds.includes(s.id))

  const classOptions = useMemo(() => classes.map((c: any) => ({ label: c.name, value: c.id })), [classes])
  const examOptions = useMemo(() => classExams.map((e: any) => ({ 
    label: `${e.name} ${e.exam_date ? `(${new Date(e.exam_date).toLocaleDateString('en-GB')})` : ''}`, 
    value: e.id 
  })), [classExams])
  const subjectOptions = useMemo(() => availableSubjects.map((s: any) => ({ label: s.name, value: s.id })), [availableSubjects])

  // --- Load Ledger ---
  const handleLoadSheet = async () => {
    if (!selectedExamId || !selectedClassId || !selectedSubjectId) return
    setIsLoading(true)
    try {
      const data = await getMarksSheetData(selectedExamId, selectedClassId, selectedSubjectId)
      
      // Sort students by Roll Number automatically
      data.students.sort((a: any, b: any) => a.enrollment_id.localeCompare(b.enrollment_id, undefined, { numeric: true }))
      
      setSheetData(data)
      
      const unsaved = data.students.filter((s: any) => !data.marks.some((m: any) => m.student_id === s.id))
      setEntryStudentId(unsaved.length > 0 ? unsaved[0].id : '')
      
      resetStates()
    } catch (error: any) { alert(`Error loading data: ${error.message}`) } 
    finally { setIsLoading(false) }
  }

  const resetStates = () => {
    setEntryBreakdowns({}); setEntryTotal(''); setIsEditingSingle(false);
    setBulkState({}); setIsBulkEditing(false);
    setSearchPending(''); setSearchSaved('');
  }

  // --- Input Handlers (Single) ---
  const handleSingleBreakdown = (bdName: string, value: string, max: number) => {
    if (parseFloat(value) > max) return 
    setEntryBreakdowns(prev => {
      const updated = { ...prev, [bdName]: value }
      let newTotal = 0
      Object.values(updated).forEach(v => newTotal += (parseFloat(v as string) || 0))
      setEntryTotal(newTotal.toString())
      return updated
    })
  }

  // --- Input Handlers (Bulk) ---
  const handleBulkChange = (studentId: string, bdName: string | null, value: string, max: number) => {
    if (parseFloat(value) > max) return
    setBulkState(prev => {
      const current = prev[studentId] || { breakdowns: {}, total: '' }
      if (bdName) {
        const newBreakdowns = { ...current.breakdowns, [bdName]: value }
        let newTotal = 0
        Object.values(newBreakdowns).forEach(v => newTotal += (parseFloat(v as string) || 0))
        return { ...prev, [studentId]: { breakdowns: newBreakdowns, total: newTotal.toString() } }
      } else {
        return { ...prev, [studentId]: { ...current, total: value } } // Flat total
      }
    })
  }

  // --- Save Handlers ---
  const processSave = async (payloadRaw: any[]) => {
    setIsSaving(true)
    try {
      // Validation & Mapping
      const payload = payloadRaw.map(p => {
        const totalVal = parseFloat(p.total) || 0
        if (totalVal > sheetData!.config.total_max_marks) throw new Error(`Total exceeds maximum for a student.`)
        return {
          exam_id: selectedExamId,
          student_id: p.studentId,
          subject_id: selectedSubjectId,
          breakdown_marks: p.breakdowns,
          total_obtained: totalVal
        }
      })

      if (payload.length === 0) return alert("No valid marks entered to save.")

      await saveStudentMarks(payload)

      // Update local UI
      const newMarks = [...sheetData!.marks]
      payload.forEach(p => {
        const idx = newMarks.findIndex(m => m.student_id === p.student_id)
        if (idx > -1) newMarks[idx] = p
        else newMarks.push(p)
      })
      setSheetData({ ...sheetData!, marks: newMarks })
      
      return true // Success
    } catch (e: any) {
      alert(`Validation Error: ${e.message}`)
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveSingle = async () => {
    if (!entryStudentId || !entryTotal) return
    const success = await processSave([{ studentId: entryStudentId, breakdowns: entryBreakdowns, total: entryTotal }])
    if (success) {
      const unsaved = sheetData!.students.filter((s: any) => !sheetData!.marks.some((m: any) => m.student_id === s.id) && s.id !== entryStudentId)
      setEntryStudentId(unsaved.length > 0 ? unsaved[0].id : '')
      setEntryBreakdowns({}); setEntryTotal(''); setIsEditingSingle(false);
    }
  }

  const handleSaveBulk = async (studentIdsToProcess: string[]) => {
    const payloadRaw = studentIdsToProcess
      .filter(id => bulkState[id] && (bulkState[id].total !== '' || Object.keys(bulkState[id].breakdowns).length > 0))
      .map(id => ({ studentId: id, breakdowns: bulkState[id].breakdowns, total: bulkState[id].total }))

    if (payloadRaw.length === 0) return alert("Please enter marks for at least one student before saving.")

    const success = await processSave(payloadRaw)
    if (success) {
      setBulkState(prev => {
        const next = { ...prev }
        payloadRaw.forEach(p => delete next[p.studentId])
        return next
      })
      alert(`Successfully saved ${payloadRaw.length} record(s).`)
    }
  }

  const handleEnableBulkEdit = () => {
    const initialState: Record<string, any> = {}
    sheetData?.marks.forEach(m => {
      initialState[m.student_id] = { breakdowns: m.breakdown_marks || {}, total: m.total_obtained.toString() }
    })
    setBulkState(initialState)
    setIsBulkEditing(true)
  }

  const handleDelete = async (studentId: string) => {
    if (!window.confirm("Are you sure you want to delete this mark?")) return
    try {
      await deleteStudentMark(selectedExamId, selectedSubjectId, studentId)
      setSheetData(prev => prev ? { ...prev, marks: prev.marks.filter(m => m.student_id !== studentId) } : null)
    } catch (e: any) { alert(e.message) }
  }

  // --- View Data Preparation ---
  const breakdowns = sheetData?.config?.breakdowns || []
  const hasBreakdowns = breakdowns.length > 0
  
  const allSaved = sheetData?.students.filter((s: any) => sheetData.marks.some((m: any) => m.student_id === s.id)) || []
  const allPending = sheetData?.students.filter((s: any) => !sheetData.marks.some((m: any) => m.student_id === s.id)) || []

  const filteredPending = allPending.filter((s: any) => `${s.first_name} ${s.last_name} ${s.enrollment_id}`.toLowerCase().includes(searchPending.toLowerCase()))
  const filteredSaved = allSaved.filter((s: any) => `${s.first_name} ${s.last_name} ${s.enrollment_id}`.toLowerCase().includes(searchSaved.toLowerCase()))

  const dropdownStudents = isEditingSingle 
    ? [...allPending, sheetData?.students.find((s: any) => s.id === entryStudentId)].filter(Boolean)
    : allPending

  const studentOptions = useMemo(() => dropdownStudents.map((s: any) => ({
    label: `${s.enrollment_id} - ${s.first_name} ${s.last_name}`,
    value: s.id
  })), [dropdownStudents])

  return (
    <div className="space-y-6 font-sans">
      
      {/* 1. SELECTION CONTROLS */}
      <div className="bg-white rounded-sm shadow-sm border border-stone-200 p-5 md:p-6 lg:flex lg:items-end lg:gap-4 grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-50">
        <div className="lg:flex-1">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-2">1. Class</label>
          <Dropdown 
            options={classOptions}
            value={selectedClassId}
            onChange={(val) => { setSelectedClassId(String(val)); setSelectedExamId(''); setSelectedSubjectId(''); setSheetData(null) }}
            placeholder="-- Choose Class --"
            hasSearch={true}
          />
        </div>
        <div className="lg:flex-1">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-2">2. Exam</label>
          <Dropdown 
            options={examOptions}
            value={selectedExamId}
            onChange={(val) => { setSelectedExamId(String(val)); setSelectedSubjectId(''); setSheetData(null) }}
            disabled={!selectedClassId}
            placeholder="-- Choose Exam --"
          />
        </div>
        <div className="lg:flex-1 sm:col-span-2 lg:col-span-1">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-2">3. Subject</label>
          <Dropdown 
            options={subjectOptions}
            value={selectedSubjectId}
            onChange={(val) => { setSelectedSubjectId(String(val)); setSheetData(null) }}
            disabled={!selectedExamId}
            placeholder="-- Choose Subject --"
            hasSearch={true}
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-1 pt-2 lg:pt-0">
          <button 
            onClick={handleLoadSheet} 
            disabled={!selectedSubjectId || isLoading} 
            className="w-full bg-stone-900 text-white px-6 py-2.5 rounded-sm hover:bg-stone-800 disabled:opacity-50 text-[11px] font-bold uppercase tracking-widest transition-colors shadow-sm h-[42px]"
          >
            {isLoading ? 'Loading...' : 'Load Ledger'}
          </button>
        </div>
      </div>

      {sheetData && (
        <div className="bg-white rounded-sm shadow-sm border border-stone-200 overflow-hidden relative z-10">
          
          {/* Header Info & Mode Switcher */}
          <div className="bg-[#fbf9fc] border-b border-[#dad3e3] p-5 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
            
            <div className="flex flex-wrap gap-3 items-center">
              <span className="inline-flex px-3 py-1.5 bg-white border border-stone-200 rounded-sm text-[10px] uppercase tracking-widest font-bold text-stone-500 shadow-sm">
                Max Score: <span className="text-stone-900 ml-1.5">{sheetData.config.total_max_marks}</span>
              </span>
              <span className="inline-flex px-3 py-1.5 bg-white border border-stone-200 rounded-sm text-[10px] uppercase tracking-widest font-bold text-stone-500 shadow-sm">
                Pass: <span className="text-[#b4483e] ml-1.5">{sheetData.config.total_pass_mark}</span>
              </span>
              {hasBreakdowns && (
                <span className="inline-flex px-3 py-1.5 bg-stone-100 border border-stone-200 rounded-sm text-[10px] uppercase tracking-widest font-bold text-stone-700 shadow-sm">
                  {breakdowns.map((b:any)=>b.name).join(' + ')}
                </span>
              )}
            </div>
            
            <div className="flex bg-stone-100 p-1 rounded-sm border border-stone-200 w-full md:w-auto">
              <button 
                onClick={() => setEntryMode('single')} 
                className={`flex-1 md:flex-none px-5 py-2 text-[10px] font-bold uppercase tracking-widest rounded-sm transition-all ${entryMode === 'single' ? 'bg-white shadow-sm text-[#6b4c9a]' : 'text-stone-500 hover:text-stone-700'}`}
              >
                Single Entry
              </button>
              <button 
                onClick={() => setEntryMode('bulk')} 
                className={`flex-1 md:flex-none px-5 py-2 text-[10px] font-bold uppercase tracking-widest rounded-sm transition-all ${entryMode === 'bulk' ? 'bg-white shadow-sm text-[#6b4c9a]' : 'text-stone-500 hover:text-stone-700'}`}
              >
                Grid / Bulk
              </button>
            </div>
          </div>

          <div className="p-4 md:p-6">
            
            {/* ========================================= */}
            {/* MODE 1: SINGLE ENTRY                      */}
            {/* ========================================= */}
            {entryMode === 'single' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                {/* Single Form */}
                <div className="lg:col-span-1 bg-stone-50 p-5 md:p-6 rounded-sm border border-stone-200 sticky top-4">
                  <h2 className="text-sm font-bold text-stone-900 uppercase tracking-widest mb-5">
                    {isEditingSingle ? 'Edit Student Mark' : 'Enter New Mark'}
                  </h2>
                  
                  {dropdownStudents.length === 0 && !isEditingSingle ? (
                    <div className="text-center p-6 bg-emerald-50 text-emerald-700 font-bold text-xs uppercase tracking-widest rounded-sm border border-emerald-200 shadow-sm">
                      All Students Graded
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="relative z-40">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-2">Student</label>
                        <Dropdown 
                          options={studentOptions}
                          value={entryStudentId}
                          onChange={(val) => { setEntryStudentId(String(val)); setEntryBreakdowns({}); setEntryTotal(''); setIsEditingSingle(false) }}
                          placeholder="-- Search Student --"
                          hasSearch={true}
                        />
                      </div>
                      
                      {entryStudentId && (
                        <div className="space-y-4 pt-5 border-t border-stone-200">
                          {hasBreakdowns ? breakdowns.map((b: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center bg-white p-3 border border-stone-200 rounded-sm shadow-sm">
                              <label className="text-xs font-bold text-stone-800 tracking-wide uppercase">
                                {b.name} <span className="text-[10px] text-stone-400 block mt-0.5">Max: {b.max}</span>
                              </label>
                              <input 
                                type="number" step="0.5" min="0" max={b.max} 
                                value={entryBreakdowns[b.name] || ''} 
                                onChange={e => handleSingleBreakdown(b.name, e.target.value, Number(b.max))} 
                                className="w-20 p-2.5 bg-stone-50 border border-stone-300 rounded-sm text-center font-bold text-stone-900 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all" 
                              />
                            </div>
                          )) : (
                            <div className="flex justify-between items-center bg-white p-3 border border-stone-200 rounded-sm shadow-sm">
                              <label className="text-xs font-bold text-stone-800 tracking-wide uppercase">Total Score</label>
                              <input 
                                type="number" step="0.5" min="0" max={sheetData.config.total_max_marks} 
                                value={entryTotal} 
                                onChange={e => {if(parseFloat(e.target.value) <= sheetData.config.total_max_marks) setEntryTotal(e.target.value)}} 
                                className="w-24 p-2.5 bg-stone-50 border border-stone-300 rounded-sm text-center font-bold text-stone-900 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all" 
                              />
                            </div>
                          )}
                          
                          <button 
                            onClick={handleSaveSingle} 
                            disabled={isSaving} 
                            className="w-full mt-4 bg-emerald-700 text-white py-3.5 rounded-sm font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-800 disabled:opacity-50 transition-colors shadow-sm"
                          >
                            {isSaving ? 'Saving...' : isEditingSingle ? 'Update Mark' : 'Save & Next'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Single Ledger List */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-stone-50 p-4 border border-stone-200 rounded-sm">
                    <h3 className="text-xs font-bold text-stone-900 uppercase tracking-widest">Saved Ledger ({allSaved.length})</h3>
                    <input 
                      type="text" 
                      placeholder="Search saved..." 
                      value={searchSaved} 
                      onChange={e => setSearchSaved(e.target.value)} 
                      className="w-full sm:w-64 p-2.5 bg-white border border-stone-300 rounded-sm text-sm font-medium focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm" 
                    />
                  </div>
                  
                  <div className="border border-stone-200 rounded-sm overflow-x-auto shadow-sm custom-scrollbar bg-white">
                    <table className="w-full text-left text-sm min-w-max">
                      <thead className="bg-[#fbf9fc] border-b border-[#dad3e3] text-stone-600">
                        <tr>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-widest">Roll</th>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-widest">Student</th>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-center">Score</th>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {filteredSaved.map(student => {
                          const mark = sheetData.marks.find((m: any) => m.student_id === student.id)
                          return (
                            <tr key={student.id} className="hover:bg-stone-50 transition-colors">
                              <td className="p-4 font-bold text-stone-900">{student.enrollment_id}</td>
                              <td className="p-4 font-medium text-stone-700">{student.first_name} {student.last_name}</td>
                              <td className="p-4 text-center font-black text-[#6b4c9a]">{mark?.total_obtained}</td>
                              <td className="p-4 text-right space-x-3">
                                <button 
                                  onClick={() => { setEntryStudentId(student.id); setEntryBreakdowns(mark?.breakdown_marks||{}); setEntryTotal(mark?.total_obtained.toString()); setIsEditingSingle(true); window.scrollTo({top:0, behavior:'smooth'}) }} 
                                  className="text-[#6b4c9a] hover:text-[#4c2f74] font-bold text-[10px] uppercase tracking-widest transition-colors"
                                >
                                  Edit
                                </button>
                                <button 
                                  onClick={() => handleDelete(student.id)} 
                                  className="text-[#b4483e] hover:text-[#85322a] font-bold text-[10px] uppercase tracking-widest transition-colors"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                        {filteredSaved.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-xs font-medium text-stone-500 italic">No saved marks found.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================= */}
            {/* MODE 2: BULK ENTRY & EDIT                 */}
            {/* ========================================= */}
            {entryMode === 'bulk' && (
              <div className="space-y-12">
                
                {/* Bulk Entry Pending */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-sm border border-stone-200 shadow-sm border-t-4 border-t-stone-800">
                    <div>
                      <h3 className="font-bold text-stone-900 text-sm uppercase tracking-widest mb-1">Pending Grid ({allPending.length})</h3>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Enter marks directly. Only rows with data are saved.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                      <input 
                        type="text" 
                        placeholder="Search pending..." 
                        value={searchPending} 
                        onChange={e => setSearchPending(e.target.value)} 
                        className="w-full sm:w-64 p-2.5 bg-stone-50 border border-stone-300 rounded-sm text-sm font-medium focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm" 
                      />
                      <button 
                        onClick={() => handleSaveBulk(filteredPending.map((s: any) => s.id))} 
                        disabled={isSaving || filteredPending.length === 0} 
                        className="bg-stone-900 text-white px-6 py-2.5 rounded-sm font-bold text-[10px] uppercase tracking-widest hover:bg-stone-800 disabled:opacity-50 transition-colors shadow-sm whitespace-nowrap"
                      >
                        {isSaving ? 'Saving...' : 'Save Entered Marks'}
                      </button>
                    </div>
                  </div>

                  <div className="border border-stone-200 rounded-sm overflow-x-auto shadow-sm custom-scrollbar bg-white">
                    <table className="w-full text-left border-collapse min-w-max">
                      <thead className="bg-stone-100 border-b border-stone-200">
                        <tr>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-stone-500 w-24 sticky left-0 bg-stone-100 border-r border-stone-200">Roll</th>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-stone-500 sticky left-24 bg-stone-100 border-r border-stone-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Student Name</th>
                          {hasBreakdowns ? breakdowns.map((b:any, i:number) => <th key={i} className="p-4 text-[10px] font-bold uppercase tracking-widest text-stone-500 text-center w-36">{b.name} (Max {b.max})</th>) 
                                         : <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-stone-500 text-center w-40">Total Score (Max {sheetData.config.total_max_marks})</th>}
                          {hasBreakdowns && <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-[#6b4c9a] text-center w-32 bg-[#fbf9fc]">Auto Total</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {filteredPending.map((student: any) => (
                          <tr key={student.id} className="hover:bg-stone-50/50 transition-colors">
                            <td className="p-4 font-bold text-stone-900 sticky left-0 bg-white border-r border-stone-100">{student.enrollment_id}</td>
                            <td className="p-4 font-medium text-stone-700 sticky left-24 bg-white border-r border-stone-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.02)]">{student.first_name} {student.last_name}</td>
                            {hasBreakdowns ? breakdowns.map((b:any, i:number) => (
                              <td key={i} className="p-2 text-center border-r border-stone-100 bg-stone-50/30">
                                <input 
                                  type="number" step="0.5" min="0" max={b.max} 
                                  value={bulkState[student.id]?.breakdowns[b.name] || ''} 
                                  onChange={e => handleBulkChange(student.id, b.name, e.target.value, Number(b.max))} 
                                  className="w-full p-2.5 bg-white border border-stone-300 rounded-sm text-center text-sm font-bold focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm" 
                                />
                              </td>
                            )) : (
                              <td className="p-2 text-center border-r border-stone-100 bg-stone-50">
                                <input 
                                  type="number" step="0.5" min="0" max={sheetData.config.total_max_marks} 
                                  value={bulkState[student.id]?.total || ''} 
                                  onChange={e => handleBulkChange(student.id, null, e.target.value, sheetData.config.total_max_marks)} 
                                  className="w-full p-2.5 bg-white border border-stone-300 rounded-sm text-center text-sm font-bold focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm" 
                                />
                              </td>
                            )}
                            {hasBreakdowns && <td className="p-4 text-center font-black text-[#6b4c9a] border-l border-[#dad3e3] bg-[#fbf9fc]">{bulkState[student.id]?.total || '-'}</td>}
                          </tr>
                        ))}
                        {filteredPending.length === 0 && <tr><td colSpan={10} className="p-10 text-center text-xs font-medium text-stone-500 italic">No pending students match search.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Bulk Edit Saved */}
                <div className="space-y-4 pt-8 border-t-2 border-stone-100">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-sm border border-stone-200 shadow-sm border-t-4 border-t-stone-300">
                    <div>
                      <h3 className="font-bold text-stone-900 text-sm uppercase tracking-widest mb-1">Saved Grid ({allSaved.length})</h3>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Review marks or enable bulk edit mode to modify.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                      <input 
                        type="text" 
                        placeholder="Search saved..." 
                        value={searchSaved} 
                        onChange={e => setSearchSaved(e.target.value)} 
                        className="w-full sm:w-64 p-2.5 bg-stone-50 border border-stone-300 rounded-sm text-sm font-medium focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm" 
                      />
                      {!isBulkEditing ? (
                        <button 
                          onClick={handleEnableBulkEdit} 
                          disabled={filteredSaved.length === 0} 
                          className="bg-white text-stone-800 border border-stone-300 px-6 py-2.5 rounded-sm font-bold text-[10px] uppercase tracking-widest hover:bg-stone-100 disabled:opacity-50 transition-colors shadow-sm whitespace-nowrap"
                        >
                          Enable Bulk Edit
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => { setIsBulkEditing(false); setBulkState({}) }} 
                            className="bg-white text-stone-600 border border-stone-300 px-4 py-2.5 rounded-sm font-bold text-[10px] uppercase tracking-widest hover:bg-stone-50 transition-colors shadow-sm"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={async () => { await handleSaveBulk(filteredSaved.map((s: any) => s.id)); setIsBulkEditing(false); }} 
                            disabled={isSaving} 
                            className="bg-[#6b4c9a] text-white px-6 py-2.5 rounded-sm font-bold text-[10px] uppercase tracking-widest hover:bg-[#5a3f82] disabled:opacity-50 transition-colors shadow-sm whitespace-nowrap"
                          >
                            {isSaving ? 'Updating...' : 'Save All Changes'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border border-stone-200 rounded-sm overflow-x-auto shadow-sm custom-scrollbar bg-white">
                    <table className="w-full text-left border-collapse min-w-max">
                      <thead className="bg-stone-100 border-b border-stone-200">
                        <tr>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-stone-500 w-24 sticky left-0 bg-stone-100 border-r border-stone-200">Roll</th>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-stone-500 sticky left-24 bg-stone-100 border-r border-stone-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Student Name</th>
                          {hasBreakdowns ? breakdowns.map((b:any, i:number) => <th key={i} className="p-4 text-[10px] font-bold uppercase tracking-widest text-stone-500 text-center w-36">{b.name} (Max {b.max})</th>) 
                                         : <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-stone-500 text-center w-40">Total Score</th>}
                          {hasBreakdowns && <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-[#b4483e] text-center w-32 bg-[#fcf8f8]">Final Total</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {filteredSaved.map((student: any) => {
                          const mark = sheetData.marks.find((m: any) => m.student_id === student.id)
                          return (
                            <tr key={student.id} className={`hover:bg-stone-50 transition-colors ${isBulkEditing ? 'bg-[#fbf9fc]/50' : 'bg-white'}`}>
                              <td className="p-4 font-bold text-stone-900 sticky left-0 border-r border-stone-100 bg-inherit">{student.enrollment_id}</td>
                              <td className="p-4 font-medium text-stone-700 sticky left-24 border-r border-stone-100 bg-inherit shadow-[2px_0_5px_-2px_rgba(0,0,0,0.02)]">{student.first_name} {student.last_name}</td>
                              
                              {/* Display Inputs OR Text based on Edit Mode */}
                              {hasBreakdowns ? breakdowns.map((b:any, i:number) => (
                                <td key={i} className="p-2 text-center border-r border-stone-100">
                                  {isBulkEditing ? (
                                    <input 
                                      type="number" step="0.5" min="0" max={b.max} 
                                      value={bulkState[student.id]?.breakdowns[b.name] ?? ''} 
                                      onChange={e => handleBulkChange(student.id, b.name, e.target.value, Number(b.max))} 
                                      className="w-full p-2.5 bg-white border border-[#dad3e3] rounded-sm text-center text-sm font-bold focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm" 
                                    />
                                  ) : (
                                    <span className="font-bold text-stone-800">{mark?.breakdown_marks?.[b.name] || 0}</span>
                                  )}
                                </td>
                              )) : (
                                <td className="p-2 text-center border-r border-stone-100 bg-stone-50/50">
                                  {isBulkEditing ? (
                                    <input 
                                      type="number" step="0.5" min="0" max={sheetData.config.total_max_marks} 
                                      value={bulkState[student.id]?.total ?? ''} 
                                      onChange={e => handleBulkChange(student.id, null, e.target.value, sheetData.config.total_max_marks)} 
                                      className="w-full p-2.5 bg-white border border-[#dad3e3] rounded-sm font-bold text-center text-sm focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm" 
                                    />
                                  ) : (
                                    <span className="font-black text-stone-900">{mark?.total_obtained}</span>
                                  )}
                                </td>
                              )}
                              
                              {hasBreakdowns && (
                                <td className="p-4 text-center font-black text-[#b4483e] border-l border-stone-200 bg-[#fcf8f8]">
                                  {isBulkEditing ? (bulkState[student.id]?.total || '0') : mark?.total_obtained}
                                </td>
                              )}
                            </tr>
                          )
                        })}
                        {filteredSaved.length === 0 && <tr><td colSpan={10} className="p-10 text-center text-xs font-medium text-stone-500 italic">No saved marks match search.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

          </div>
        </div>
      )}
    </div>
  )
}