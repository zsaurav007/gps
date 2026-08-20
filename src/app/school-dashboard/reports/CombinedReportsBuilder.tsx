'use client'

import { useState, useMemo } from 'react'

// ==================================================================
// Type Definitions
// ==================================================================
export type ID = string | number

export interface Class {
  id: ID
  name: string
}

export interface Exam {
  id: string
  class_id: ID
  name: string
}

export interface Student {
  id: string
  class_id: ID
  first_name: string
  last_name: string
  enrollment_id: string
}

export interface ExamConfig {
  exam_id: string
  total_max_marks?: number | string
}

export interface Mark {
  exam_id: string
  student_id: string
  total_obtained: number | string
  isAbsent?: boolean
}

export interface CombinedReportsBuilderProps {
  classes: Class[]
  exams: Exam[]
  students: Student[]
  examConfigs: ExamConfig[]
  fetchMarksForExams: (examIds: string[]) => Promise<Mark[]>
}

export type ExamWeight = { examId: string; maxMark: number; weight: number }
export type CustomField = { id: string; name: string; maxMark: number; weight: number }
export type CustomFieldData = Record<string, Record<string, number>>

export interface LedgerBreakdown {
  name: string | undefined
  raw: number | string // 'ABS', 'Missing', or actual number
  maxMark: number
  contribution: string // Result of .toFixed(2)
  weight: number
}

export interface LedgerRow {
  student: Student
  totalScore: number
  breakdown: LedgerBreakdown[]
}

// ==================================================================
// Component
// ==================================================================
export default function CombinedReportsBuilder({ 
  classes, 
  exams, 
  students, 
  examConfigs, 
  fetchMarksForExams 
}: CombinedReportsBuilderProps) {
  const [step, setStep] = useState<number>(1)
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [isFetchingMarks, setIsFetchingMarks] = useState<boolean>(false)
  const [selectedStudentReport, setSelectedStudentReport] = useState<LedgerRow | null>(null)

  const [selectedClassId, setSelectedClassId] = useState<string | number>('')
  const [selectedWeights, setSelectedWeights] = useState<ExamWeight[]>([])
  
  // Pre-Flight Data & Custom Fields
  const [rawMarksData, setRawMarksData] = useState<Mark[]>([])
  const [missingStats, setMissingStats] = useState<{examName: string; missing: number}[]>([])
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [customMarks, setCustomMarks] = useState<CustomFieldData>({})
  const [customFieldSearch, setCustomFieldSearch] = useState<string>('')
  
  const [compiledLedger, setCompiledLedger] = useState<LedgerRow[]>([])

  const availableExams = useMemo(() => exams.filter(e => e.class_id === selectedClassId), [exams, selectedClassId])
  const classStudents = useMemo(() => students.filter(s => s.class_id === selectedClassId), [students, selectedClassId])

  const filteredStudentsForCustomFields = useMemo(() => {
    if (!customFieldSearch) return classStudents
    return classStudents.filter(s => 
      `${s.first_name} ${s.last_name} ${s.enrollment_id}`.toLowerCase().includes(customFieldSearch.toLowerCase())
    )
  }, [classStudents, customFieldSearch])

  // ==================================================================
  // WIZARD ACTIONS
  // ==================================================================

  const toggleExamSelection = (examId: string) => {
    setSelectedWeights(prev => {
      const exists = prev.find(w => w.examId === examId)
      if (exists) return prev.filter(w => w.examId !== examId)
      
      const safeConfigs = examConfigs || []
      const configsForExam = safeConfigs.filter(c => c.exam_id === examId)
      const totalMax = configsForExam.reduce((sum, c) => sum + Number(c.total_max_marks || 0), 0)

      return [...prev, { examId, maxMark: totalMax > 0 ? totalMax : 100, weight: 25 }] 
    })
  }

  const updateExamConfig = (examId: string, key: 'maxMark' | 'weight', value: number) => {
    setSelectedWeights(prev => prev.map(w => w.examId === examId ? { ...w, [key]: value } : w))
  }

  // Pre-Flight Check: Fetches marks from DB
  const handleProceedToStep3 = async () => {
    setIsFetchingMarks(true)
    try {
      const examIds = selectedWeights.map(w => w.examId)
      const fetchedMarks = await fetchMarksForExams(examIds)
      setRawMarksData(fetchedMarks)

      const stats: {examName: string; missing: number}[] = []
      selectedWeights.forEach(config => {
        const examObj = availableExams.find(e => e.id === config.examId)
        const marksForThisExam = fetchedMarks.filter(m => m.exam_id === config.examId)
        
        const studentsWithMarks = new Set(marksForThisExam.map(m => m.student_id))
        const missingCount = classStudents.length - studentsWithMarks.size
        
        if (missingCount > 0) {
          stats.push({ examName: examObj?.name || 'Unknown Exam', missing: missingCount })
        }
      })

      setMissingStats(stats)
      setStep(3)
    } catch (error) {
      alert("Failed to fetch data for the selected exams. Please try again.")
    } finally {
      setIsFetchingMarks(false)
    }
  }

  const addCustomField = () => {
    const newField = { id: `cf_${Date.now()}`, name: 'Attendance', maxMark: 100, weight: 5 }
    setCustomFields([...customFields, newField])
  }

  // STRICT BOUNDARY CHECK: Prevent negative numbers and exceeding max marks
  const updateCustomMark = (studentId: string, fieldId: string, value: string, maxMark: number) => {
    // If the user clears the input, allow it so they aren't stuck with a 0
    if (value === '') {
      setCustomMarks(prev => {
        const newState = { ...prev }
        if (newState[studentId]) {
          const newStudentMarks = { ...newState[studentId] }
          delete newStudentMarks[fieldId]
          newState[studentId] = newStudentMarks
        }
        return newState
      })
      return
    }

    let numValue = Number(value)
    
    // Auto-cap constraints
    if (numValue < 0) numValue = 0
    if (numValue > maxMark) numValue = maxMark

    setCustomMarks(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [fieldId]: numValue
      }
    }))
  }

  const compileFinalLedger = async () => {
    setIsProcessing(true)
    try {
      const finalLedger = classStudents.map((student) => {
        let totalNormalizedScore = 0
        const breakdown: LedgerBreakdown[] = []

        selectedWeights.forEach(config => {
          const examObj = availableExams.find(e => e.id === config.examId)
          const studentMark = rawMarksData.find(m => m.student_id === student.id && m.exam_id === config.examId)
          
          const rawObtained = studentMark && !studentMark.isAbsent ? Number(studentMark.total_obtained) : 0
          
          const safeMax = config.maxMark > 0 ? config.maxMark : 1
          const normalizedContribution = (rawObtained / safeMax) * config.weight
          
          totalNormalizedScore += normalizedContribution
          breakdown.push({
            name: examObj?.name,
            raw: studentMark ? (studentMark.isAbsent ? 'ABS' : rawObtained) : 'Missing',
            maxMark: config.maxMark,
            contribution: normalizedContribution.toFixed(2),
            weight: config.weight
          })
        })

        customFields.forEach(field => {
          const obtainedCustom = customMarks[student.id]?.[field.id] || 0
          const safeMax = field.maxMark > 0 ? field.maxMark : 1
          const normalizedContribution = (obtainedCustom / safeMax) * field.weight

          totalNormalizedScore += normalizedContribution
          breakdown.push({
            name: field.name,
            raw: obtainedCustom,
            maxMark: field.maxMark,
            contribution: normalizedContribution.toFixed(2),
            weight: field.weight
          })
        })

        return { student, totalScore: Number(totalNormalizedScore.toFixed(2)), breakdown }
      })

      finalLedger.sort((a, b) => b.totalScore - a.totalScore)
      setCompiledLedger(finalLedger)
      setStep(4)
      
    } catch (error) {
      alert("Failed to compile ledger.")
    } finally {
      setIsProcessing(false)
    }
  }

  // ==================================================================
  // INDIVIDUAL REPORT CARD VIEW (PRINTABLE)
  // ==================================================================
  if (selectedStudentReport) {
    const r = selectedStudentReport
    const totalWeightAssigned = r.breakdown.reduce((sum, b) => sum + b.weight, 0)

    return (
      <div className="bg-white min-h-screen font-sans print:p-0">
        <div className="max-w-4xl mx-auto p-8 print:p-0">
          
          {/* Print / Navigation Actions */}
          <div className="flex justify-between items-center mb-8 print:hidden">
            <button onClick={() => setSelectedStudentReport(null)} className="text-xs uppercase tracking-widest font-bold text-stone-500 hover:text-stone-800 bg-stone-100 px-4 py-2 rounded-sm">&larr; Back to Ledger</button>
            <button onClick={() => window.print()} className="text-[10px] uppercase tracking-widest font-bold text-white bg-[#6b4c9a] px-6 py-2 rounded-sm hover:bg-[#5a3f82] shadow-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
              Print Report Card
            </button>
          </div>

          <div className="border-4 border-double border-stone-300 p-8 md:p-12 rounded-sm">
            <div className="text-center mb-10 border-b border-stone-200 pb-8">
              <h1 className="text-3xl font-black text-stone-900 uppercase tracking-widest mb-2">Combined Academic Report</h1>
              <p className="text-sm font-bold text-stone-500 uppercase tracking-widest">Cumulative Result Evaluation</p>
            </div>

            <div className="flex justify-between items-end mb-10">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Student Name</p>
                <h2 className="text-2xl font-bold text-[#6b4c9a]">{r.student.first_name} {r.student.last_name}</h2>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Final Combined Grade</p>
                <div className="text-3xl font-black text-stone-900 bg-stone-100 px-4 py-2 rounded-sm border border-stone-200">
                  {r.totalScore} <span className="text-lg text-stone-500">/ {totalWeightAssigned}%</span>
                </div>
              </div>
            </div>

            <table className="w-full text-left border-collapse border border-stone-200">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="py-4 px-5 text-xs font-bold tracking-widest text-stone-600 uppercase border-r border-stone-200">Evaluation Metric</th>
                  <th className="py-4 px-5 text-xs font-bold tracking-widest text-stone-600 uppercase border-r border-stone-200">Raw Score</th>
                  <th className="py-4 px-5 text-xs font-bold tracking-widest text-stone-600 uppercase border-r border-stone-200">Target Weight</th>
                  <th className="py-4 px-5 text-xs font-black tracking-widest text-[#6b4c9a] uppercase bg-[#fbf9fc]">Converted Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {r.breakdown.map((b, idx) => (
                  <tr key={idx}>
                    <td className="py-4 px-5 font-bold text-stone-800 border-r border-stone-200">{b.name}</td>
                    <td className="py-4 px-5 font-medium text-stone-600 border-r border-stone-200">
                      <span className={b.raw === 'Missing' ? 'text-[#b4483e] font-bold' : ''}>{b.raw}</span> 
                      <span className="text-[10px] text-stone-400"> out of {b.maxMark}</span>
                    </td>
                    <td className="py-4 px-5 font-bold text-stone-500 border-r border-stone-200">{b.weight}%</td>
                    <td className="py-4 px-5 font-black text-[#6b4c9a] bg-[#fbf9fc] text-lg">
                      {b.contribution} <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Points</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div className="mt-16 pt-8 border-t border-stone-200 flex justify-between">
              <div className="w-48 border-t border-stone-400 pt-2 text-center text-xs font-bold text-stone-500 uppercase tracking-widest">Class Teacher</div>
              <div className="w-48 border-t border-stone-400 pt-2 text-center text-xs font-bold text-stone-500 uppercase tracking-widest">Headmaster</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ==================================================================
  // RENDER UI (MAIN BUILDER)
  // ==================================================================
  return (
    <div className="bg-white rounded-sm border border-stone-200 shadow-sm flex flex-col font-sans">
      
      {/* Dynamic Header */}
      <div className="bg-stone-50 border-b border-stone-200 p-6 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-[#6b4c9a] uppercase tracking-wide">Combined Reports</h2>
          <p className="text-xs text-stone-500 font-medium tracking-wide mt-1">Combine multiple exams and custom metrics into a unified ledger.</p>
        </div>
        <div className="flex gap-2 text-[10px] font-bold tracking-widest text-stone-400 hidden sm:flex">
          <span className={step >= 1 ? 'text-[#6b4c9a]' : ''}>1. TARGET</span> &rarr;
          <span className={step >= 2 ? 'text-[#6b4c9a]' : ''}>2. WEIGHTS</span> &rarr;
          <span className={step >= 3 ? 'text-[#6b4c9a]' : ''}>3. CUSTOM</span> &rarr;
          <span className={step >= 4 ? 'text-emerald-600' : ''}>4. LEDGER</span>
        </div>
      </div>

      <div className="p-6 md:p-8">
        
        {/* STEP 1: TARGET CLASS */}
        {step === 1 && (
          <div className="max-w-xl mx-auto space-y-6 animate-in fade-in">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">Select Target Class</label>
              <select 
                value={selectedClassId} 
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full p-3.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] shadow-sm"
              >
                <option value="">-- Choose Class --</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button 
              disabled={!selectedClassId}
              onClick={() => setStep(2)} 
              className="w-full bg-[#6b4c9a] text-white px-6 py-3.5 rounded-sm text-xs uppercase tracking-widest font-bold hover:bg-[#5a3f82] transition-colors disabled:opacity-50"
            >
              Continue to Exam Selection &rarr;
            </button>
          </div>
        )}

        {/* STEP 2: WEIGHTS & EXAMS */}
        {step === 2 && (
          <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="bg-[#fbf9fc] border border-[#dad3e3] p-5 rounded-sm mb-6">
              <h3 className="text-sm font-bold text-stone-900 mb-1">Select Exams & Define Proportions</h3>
              <p className="text-xs text-stone-600">The total Maximum Marks for each exam is auto-fetched. Just define the Target Weight % you want it to contribute to the final cumulative total.</p>
            </div>

            <div className="space-y-3">
              {availableExams.length === 0 && <p className="text-sm text-stone-500 italic">No exams found for this class.</p>}
              {availableExams.map((exam) => {
                const config = selectedWeights.find(w => w.examId === exam.id)
                const isSelected = !!config

                return (
                  <div key={exam.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 rounded-sm border transition-all ${isSelected ? 'border-[#6b4c9a] bg-white shadow-sm' : 'border-stone-200 bg-stone-50'}`}>
                    <label className="flex items-center gap-4 cursor-pointer flex-1">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleExamSelection(exam.id)} className="w-4 h-4 text-[#6b4c9a] focus:ring-[#6b4c9a]" />
                      <span className={`text-sm font-bold ${isSelected ? 'text-stone-900' : 'text-stone-500'}`}>{exam.name}</span>
                    </label>
                    
                    {isSelected && (
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2 bg-stone-50 p-2 rounded-sm border border-stone-200">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-stone-500">Exam Out Of (Auto)</span>
                          <input 
                            type="number" 
                            value={config.maxMark}
                            disabled
                            title="Auto-fetched from the database"
                            className="w-16 p-1.5 text-center text-xs font-bold border border-stone-200 bg-stone-100 text-stone-500 rounded-sm cursor-not-allowed"
                          />
                        </div>
                        <div className="flex items-center gap-2 bg-[#fbf9fc] p-2 rounded-sm border border-[#dad3e3]">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-[#6b4c9a]">Target Weight %</span>
                          <input 
                            type="number" 
                            value={config.weight}
                            onChange={(e) => updateExamConfig(exam.id, 'weight', Number(e.target.value))}
                            className="w-16 p-1.5 text-center text-xs font-bold border border-[#6b4c9a]/50 rounded-sm focus:border-[#6b4c9a] focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex justify-between pt-6 border-t border-stone-200">
              <button onClick={() => setStep(1)} className="text-xs uppercase tracking-widest font-bold text-stone-500 hover:text-stone-800">&larr; Back</button>
              <button 
                disabled={selectedWeights.length === 0 || isFetchingMarks}
                onClick={handleProceedToStep3} 
                className="bg-[#6b4c9a] text-white px-8 py-3 rounded-sm text-xs uppercase tracking-widest font-bold hover:bg-[#5a3f82] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isFetchingMarks ? 'Fetching Marks from Database...' : 'Next: Custom Fields'} &rarr;
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: CUSTOM FIELDS & DATA ENTRY */}
        {step === 3 && (
          <div className="animate-in fade-in slide-in-from-right-4 space-y-6">
            
            {/* Success / Pre-Flight Banners */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-sm p-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <div>
                <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-widest mb-1">Academic Marks Successfully Loaded</h4>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  The system has safely fetched the students' raw exam marks from the database. The table below is <span className="font-bold underline">only</span> for adding non-academic metrics. If you don't need any, simply skip this and hit Compile.
                </p>
              </div>
            </div>

            {missingStats.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-sm p-4 flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                <div>
                  <h4 className="text-xs font-bold text-amber-900 uppercase tracking-widest mb-1">Incomplete Data Warning</h4>
                  <p className="text-xs text-amber-700 leading-relaxed mb-3">
                    The following exams do not have complete marks entered for all students in this class. Missing entries will be treated as zero (0).
                  </p>
                  <ul className="space-y-1">
                    {missingStats.map((stat, idx) => (
                      <li key={idx} className="text-[11px] font-medium text-amber-800 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                        <span className="font-bold">{stat.examName}:</span> {stat.missing} student(s) missing marks.
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h3 className="text-sm font-bold text-stone-900 mb-1">Non-Academic Variables (Optional)</h3>
                <p className="text-xs text-stone-600">Add custom manual fields to inject into the final total.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <input 
                  type="text" 
                  placeholder="Search student or roll..." 
                  value={customFieldSearch}
                  onChange={(e) => setCustomFieldSearch(e.target.value)}
                  className="w-full md:w-48 p-2 border border-stone-300 rounded-sm text-xs font-medium text-stone-900 focus:outline-none focus:border-[#6b4c9a]"
                />
                <button onClick={addCustomField} className="w-full md:w-auto text-[10px] uppercase tracking-widest font-bold text-[#6b4c9a] bg-[#fbf9fc] border border-[#dad3e3] px-4 py-2.5 rounded-sm hover:bg-[#f3eff8] transition-colors shadow-sm">
                  + Add Metric
                </button>
              </div>
            </div>

            {customFields.length > 0 && (
              <div className="overflow-x-auto border border-stone-200 rounded-sm">
                <table className="w-full text-left border-collapse min-w-max">
                  <thead className="bg-stone-50 border-b border-stone-200">
                    <tr>
                      <th className="py-3 px-4 text-[10px] font-bold tracking-widest text-stone-500 uppercase border-r border-stone-200">Student Name</th>
                      {customFields.map((cf, idx) => (
                        <th key={cf.id} className="py-3 px-4 border-r border-stone-200 bg-[#fbf9fc]">
                          <input type="text" value={cf.name} onChange={(e) => {
                            const newFields = [...customFields]; newFields[idx].name = e.target.value; setCustomFields(newFields)
                          }} className="w-full bg-transparent border-b border-[#dad3e3] focus:border-[#6b4c9a] text-[11px] font-bold text-[#6b4c9a] uppercase tracking-widest focus:outline-none mb-2 pb-1" />
                          
                          <div className="flex gap-3">
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-stone-500 font-bold uppercase tracking-wider">Max:</span>
                              <input type="number" value={cf.maxMark} onChange={(e) => {
                                const newFields = [...customFields]; newFields[idx].maxMark = Number(e.target.value); setCustomFields(newFields)
                              }} className="w-12 bg-white border border-stone-200 p-1 rounded-sm text-[9px] font-bold text-stone-600 focus:outline-none" />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-[#6b4c9a] font-bold uppercase tracking-wider">Wt %:</span>
                              <input type="number" value={cf.weight} onChange={(e) => {
                                const newFields = [...customFields]; newFields[idx].weight = Number(e.target.value); setCustomFields(newFields)
                              }} className="w-12 bg-white border border-[#dad3e3] p-1 rounded-sm text-[9px] font-bold text-[#6b4c9a] focus:outline-none" />
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredStudentsForCustomFields.length === 0 ? (
                      <tr>
                        <td colSpan={customFields.length + 1} className="py-8 text-center text-xs text-stone-400 italic">No students match your search.</td>
                      </tr>
                    ) : (
                      filteredStudentsForCustomFields.map((student) => (
                        <tr key={student.id} className="hover:bg-stone-50/50">
                          <td className="py-3 px-4 text-xs font-bold text-stone-900 border-r border-stone-100">
                            {student.enrollment_id} - {student.first_name} {student.last_name}
                          </td>
                          {customFields.map(cf => (
                            <td key={cf.id} className="py-2 px-4 border-r border-stone-100">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Score:</span>
                                <input 
                                  type="number"
                                  min="0"
                                  max={cf.maxMark}
                                  value={customMarks[student.id]?.[cf.id] ?? ''}
                                  onChange={(e) => updateCustomMark(student.id, cf.id, e.target.value, cf.maxMark)}
                                  className="w-16 p-1.5 text-xs font-bold border border-stone-300 rounded-sm focus:border-[#6b4c9a] focus:outline-none focus:ring-1 focus:ring-[#6b4c9a]"
                                />
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-between pt-6 border-t border-stone-200">
              <button onClick={() => setStep(2)} className="text-xs uppercase tracking-widest font-bold text-stone-500 hover:text-stone-800">&larr; Back</button>
              <button 
                onClick={compileFinalLedger} 
                disabled={isProcessing}
                className="bg-[#6b4c9a] text-white px-8 py-3 rounded-sm text-xs uppercase tracking-widest font-bold hover:bg-[#5a3f82] transition-colors shadow-sm disabled:opacity-50"
              >
                {isProcessing ? 'Compiling Matrices...' : 'Compile Ledger &rarr;'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: FINAL LEDGER GENERATED */}
        {step === 4 && (
          <div className="animate-in fade-in zoom-in-95 duration-500">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-stone-900 uppercase tracking-wide">Final Combined Ledger</h3>
                <p className="text-xs text-stone-500 font-medium tracking-wide">Master matrix of proportionally weighted scores.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="text-[10px] uppercase tracking-widest font-bold text-stone-500 bg-white border border-stone-200 px-4 py-2 rounded-sm hover:bg-stone-50">Start Over</button>
                <button onClick={() => window.print()} className="text-[10px] uppercase tracking-widest font-bold text-white bg-stone-900 px-6 py-2 rounded-sm hover:bg-black shadow-sm flex items-center gap-2">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                  Print Ledger
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-stone-200 rounded-sm shadow-sm print:shadow-none print:border-none">
              <table className="w-full text-left border-collapse min-w-max text-sm">
                <thead className="bg-stone-900 text-white">
                  <tr>
                    <th className="py-4 px-4 font-bold tracking-widest text-[10px] uppercase border-r border-stone-700">Rank</th>
                    <th className="py-4 px-4 font-bold tracking-widest text-[10px] uppercase border-r border-stone-700">Student</th>
                    {compiledLedger[0]?.breakdown.map((b, i) => (
                      <th key={i} className="py-4 px-4 border-r border-stone-700">
                        <div className="font-bold tracking-widest text-[10px] uppercase">{b.name}</div>
                        <div className="text-stone-400 text-[8px] mt-1 tracking-wider">Weight: {b.weight}%</div>
                      </th>
                    ))}
                    <th className="py-4 px-4 font-black tracking-widest text-[11px] uppercase border-r border-stone-700 bg-black text-emerald-400">Total %</th>
                    <th className="py-4 px-4 font-bold tracking-widest text-[10px] uppercase print:hidden">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 bg-white">
                  {compiledLedger.map((row, index) => (
                    <tr key={row.student.id} className="hover:bg-stone-50">
                      <td className="py-3 px-4 font-bold text-stone-500 border-r border-stone-100">#{index + 1}</td>
                      <td className="py-3 px-4 font-bold text-stone-900 border-r border-stone-100">{row.student.first_name} {row.student.last_name}</td>
                      
                      {row.breakdown.map((b, i) => (
                        <td key={i} className="py-3 px-4 border-r border-stone-100">
                          <div className="font-bold text-[#6b4c9a]">
                            Converted: {b.contribution} <span className="text-[10px] text-stone-400 font-normal">/ {b.weight}%</span>
                          </div>
                          <div className="text-[9px] text-stone-400 mt-0.5 font-bold uppercase tracking-widest">
                            Raw Score: <span className={b.raw === 'Missing' ? 'text-[#b4483e]' : ''}>{b.raw}</span> <span className="font-normal">/ {b.maxMark}</span>
                          </div>
                        </td>
                      ))}
                      
                      <td className="py-3 px-4 font-black text-lg text-stone-900 border-r border-stone-200 bg-stone-50/50">
                        {row.totalScore}
                      </td>
                      
                      <td className="py-3 px-4 print:hidden">
                        <button 
                          onClick={() => setSelectedStudentReport(row)}
                          className="text-[9px] font-bold uppercase tracking-widest text-stone-600 border border-stone-300 px-3 py-1.5 rounded-sm hover:bg-stone-100 hover:text-stone-900 transition-colors"
                        >
                          View Card
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}