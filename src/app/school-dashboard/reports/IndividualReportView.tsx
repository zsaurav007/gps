'use client'

import React, { useState, useMemo } from 'react'
import Dropdown from '@/components/ui/dropdown'

// Single source of truth for the grading scale
export const GRADE_SCALE = [
  { grade: 'A+', gpa: 5.00, min: 80, max: 100, remark: 'অনন্য' },
  { grade: 'A', gpa: 4.00, min: 70, max: 79, remark: 'অর্জনমুখী' },
  { grade: 'A-', gpa: 3.50, min: 60, max: 69, remark: 'অগ্রগামী' },
  { grade: 'B', gpa: 3.00, min: 50, max: 59, remark: 'সক্রিয়' },
  { grade: 'C', gpa: 2.00, min: 40, max: 49, remark: 'অনুসন্ধানী' },
  { grade: 'D', gpa: 1.00, min: 33, max: 39, remark: 'বিকাশমান' },
  { grade: 'F', gpa: 0.00, min: 0, max: 32, remark: 'প্রারম্ভিক' },
]

export const getGradeInfo = (obtained: number, max: number) => {
  if (max === 0) return { grade: '-', gpa: 0.00, remark: '-' }
  const pct = Math.round((obtained / max) * 100)
  const band = GRADE_SCALE.find(g => pct >= g.min)
  return band ?? GRADE_SCALE[GRADE_SCALE.length - 1]
}

export const isSubjectFailed = (sub: any, showGrading: boolean) => {
  if (sub.isAbsent) return true
  if (showGrading && sub.maxTotal > 0) {
    const pct = Math.round((sub.totalObtained / sub.maxTotal) * 100)
    return pct < 33
  }
  return sub.isFail
}

export const hasStudentFailed = (subjectResults: any[], showGrading: boolean, dbHasFailed: boolean) => {
  if (showGrading) {
    return subjectResults.some(sub => isSubjectFailed(sub, showGrading))
  }
  return dbHasFailed
}

export const getOverallGPA = (subjectResults: any[]) => {
  let totalGPA = 0
  let hasFail = false
  let validSubjects = 0

  subjectResults.forEach(sub => {
    if (sub.isAbsent) hasFail = true
    const info = getGradeInfo(sub.totalObtained, sub.maxTotal)
    if (info.grade === 'F') hasFail = true
    totalGPA += info.gpa
    validSubjects++
  })

  if (hasFail || validSubjects === 0) return { gpa: '0.00', grade: 'F' }

  const avg = totalGPA / validSubjects
  if (avg >= 5.00) return { gpa: '5.00', grade: 'A+' }
  if (avg >= 4.00) return { gpa: avg.toFixed(2), grade: 'A' }
  if (avg >= 3.50) return { gpa: avg.toFixed(2), grade: 'A-' }
  if (avg >= 3.00) return { gpa: avg.toFixed(2), grade: 'B' }
  if (avg >= 2.00) return { gpa: avg.toFixed(2), grade: 'C' }
  if (avg >= 1.00) return { gpa: avg.toFixed(2), grade: 'D' }
  return { gpa: '0.00', grade: 'F' }
}

const cell = (value: any) => {
  if (value === null || value === undefined || value === '') return '-'
  return value
}

export default function IndividualReportView({ reportData, examName, className, schoolName, showGrading }: { reportData: any[], examName: string, className: string, schoolName: string, showGrading: boolean }) {
  const [selectedStudentId, setSelectedStudentId] = useState<string | number>('')
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null) 

  const studentOptions = reportData.map(d => ({
    label: `${d.student.enrollment_id} - ${d.student.first_name} ${d.student.last_name}`,
    value: d.student.id
  }))

  const studentData = reportData.find(d => d.student.id === selectedStudentId)
  const rank = studentData?.rank || '-'
  const overallGrade = studentData ? getOverallGPA(studentData.subjectResults) : { gpa: '0.00', grade: 'F' }

  const subjectHighest = useMemo(() => {
    const highestMap: Record<string, number> = {}
    if (!reportData || reportData.length === 0) return highestMap
    const uniqueSubjects = reportData[0].subjectResults.map((sr: any) => sr.subjectId)
    uniqueSubjects.forEach((subId: string) => {
      const allMarks = reportData.map(r => {
        const sr = r.subjectResults.find((s: any) => s.subjectId === subId)
        return (sr && !sr.isAbsent) ? sr.totalObtained : null
      }).filter(m => m !== null) as number[]
      highestMap[subId] = allMarks.length > 0 ? Math.max(...allMarks) : 0
    })
    return highestMap
  }, [reportData])

  // Extract all unique breakdown names (CQ, MCQ, Practical) across ALL subjects
  const allBreakdownNames = useMemo(() => {
    const names = new Set<string>();
    if (studentData) {
      studentData.subjectResults.forEach((sr: any) => {
        if (sr.breakdownsConfig) {
          sr.breakdownsConfig.forEach((b: any) => names.add(b.name));
        }
      });
    }
    return Array.from(names);
  }, [studentData]);

  const totals = useMemo(() => {
    if (!studentData) return { maxTotal: 0 }
    return {
      maxTotal: studentData.subjectResults.reduce((s: number, sub: any) => s + (sub.maxTotal || 0), 0),
    }
  }, [studentData])

  // --- Export Handlers ---
  const handleExportXL = () => {
    if (!studentData) return
    let csvContent = "data:text/csv;charset=utf-8,"
    csvContent += `Student,${studentData.student.first_name} ${studentData.student.last_name}\n`
    csvContent += `ID,${studentData.student.enrollment_id}\n`
    csvContent += `Class,${className}\n\n`
    
    // Headers
    let headers = ["Subject", "Full Marks", ...allBreakdownNames, "Total Obt"]
    if (showGrading) headers.push("Highest", "GP", "LG")
    else headers.push("Status")
    csvContent += headers.join(",") + "\n"

    // Rows
    studentData.subjectResults.forEach((sub: any) => {
      const g = getGradeInfo(sub.totalObtained, sub.maxTotal)
      const isFail = isSubjectFailed(sub, showGrading)
      
      let row = [
        sub.subjectName,
        sub.maxTotal,
        ...allBreakdownNames.map(name => {
          const hasComp = sub.breakdownsConfig?.some((b: any) => b.name === name)
          if (!hasComp) return '-'
          return sub.isAbsent ? '-' : (sub.breakdownMarks?.[name] || 0)
        }),
        sub.isAbsent ? 'ABS' : sub.totalObtained
      ]
      
      if (showGrading) row.push(subjectHighest[sub.subjectId].toString(), g.gpa.toString(), g.grade)
      else row.push(isFail ? 'FAIL' : 'PASS')
      
      csvContent += row.join(",") + "\n"
    })

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `${studentData.student.first_name}_Report.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="bg-white flex flex-col items-center font-sans">
      
      {/* Top Action Bar */}
      <div className="w-full bg-[#fbf9fc] p-4 md:p-6 border-b border-[#dad3e3] flex flex-col md:flex-row gap-5 items-start md:items-center justify-between print:hidden">
        <div className="w-full md:w-96 relative z-50">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">Select Student</label>
          <Dropdown options={studentOptions} value={selectedStudentId} onChange={setSelectedStudentId} placeholder="-- Search Student --" hasSearch={true} />
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <button onClick={handleExportXL} disabled={!selectedStudentId} className="flex-1 md:flex-none bg-stone-100 text-stone-700 border border-stone-300 px-5 py-2.5 rounded-sm hover:bg-stone-200 disabled:opacity-50 text-[11px] font-bold uppercase tracking-widest transition-colors shadow-sm text-center">
            Export XL
          </button>
          <button onClick={() => window.print()} disabled={!selectedStudentId} className="flex-1 md:flex-none bg-[#6b4c9a] text-white px-5 py-2.5 rounded-sm hover:bg-[#5a3f82] disabled:opacity-50 text-[11px] font-bold uppercase tracking-widest transition-colors shadow-sm flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
            Print PDF
          </button>
        </div>
      </div>

      {/* Report Card Document */}
      <div className="w-full p-4 md:p-8">
        {studentData ? (
          <div className="max-w-4xl mx-auto bg-white border border-stone-200 shadow-sm p-1 print:border-none print:shadow-none print:p-0">
            {/* Inner frame */}
            <div className="border-4 border-double border-stone-800 p-6 md:p-10 print:border-2">
              
              {/* Header */}
              <div className="text-center mb-8">
                <div className="flex items-center justify-center gap-5">
                  <div className="w-16 h-16 shrink-0 border border-stone-300 rounded-full flex items-center justify-center text-[10px] text-stone-400 font-bold uppercase tracking-widest print:hidden">
                    Logo
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-3xl font-black text-stone-900 uppercase tracking-wide leading-tight">{schoolName}</h1>
                  </div>
                </div>
                <span className="inline-block bg-[#6b4c9a] text-white font-bold text-[11px] px-6 py-1.5 rounded-sm mt-4 tracking-widest uppercase shadow-sm">Academic Transcript</span>
              </div>

              {/* Info Block & Grading Scale */}
              <div className="flex flex-col lg:flex-row gap-6 mb-8">
                <table className="flex-1 w-full border-collapse border border-stone-800 text-sm">
                  <tbody>
                    <tr>
                      <td className="p-2.5 border border-stone-800 font-bold text-stone-600 bg-stone-50 text-xs uppercase tracking-wider w-24">ID</td>
                      <td className="p-2.5 border border-stone-800 font-bold text-stone-900">{cell(studentData.student.enrollment_id)}</td>
                      <td className="p-2.5 border border-stone-800 font-bold text-stone-600 bg-stone-50 text-xs uppercase tracking-wider w-24">Shift</td>
                      <td className="p-2.5 border border-stone-800 font-bold text-stone-900">{cell(studentData.student.shift)}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 border border-stone-800 font-bold text-stone-600 bg-stone-50 text-xs uppercase tracking-wider">Name</td>
                      <td className="p-2.5 border border-stone-800 font-black text-stone-900 text-base">{studentData.student.first_name} {studentData.student.last_name}</td>
                      <td className="p-2.5 border border-stone-800 font-bold text-stone-600 bg-stone-50 text-xs uppercase tracking-wider">Class</td>
                      <td className="p-2.5 border border-stone-800 font-bold text-stone-900">{cell(className)}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 border border-stone-800 font-bold text-stone-600 bg-stone-50 text-xs uppercase tracking-wider">Session</td>
                      <td className="p-2.5 border border-stone-800 font-bold text-stone-900">{cell(studentData.student.session)}</td>
                      <td className="p-2.5 border border-stone-800 font-bold text-stone-600 bg-stone-50 text-xs uppercase tracking-wider">Section</td>
                      <td className="p-2.5 border border-stone-800 font-bold text-stone-900">{cell(studentData.student.section)}</td>
                    </tr>
                  </tbody>
                </table>

                {showGrading && (
                  <table className="border-collapse border border-stone-800 text-[10px] lg:text-xs self-start shrink-0 hidden sm:table">
                    <thead>
                      <tr className="bg-stone-100">
                        <th className="p-2 border border-stone-800 font-bold uppercase tracking-wider text-stone-900">Grade</th>
                        <th className="p-2 border border-stone-800 font-bold uppercase tracking-wider text-stone-900">Point</th>
                        <th className="p-2 border border-stone-800 font-bold uppercase tracking-wider text-stone-900">Range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {GRADE_SCALE.map(g => (
                        <tr key={g.grade}>
                          <td className="p-1.5 px-3 border border-stone-800 font-black text-center text-stone-900">{g.grade}</td>
                          <td className="p-1.5 px-3 border border-stone-800 font-medium text-center text-stone-700">{g.gpa.toFixed(2)}</td>
                          <td className="p-1.5 px-3 border border-stone-800 font-medium text-center text-stone-700">{g.min}-{g.max}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* ==================================================
                  MOBILE VIEW (Hidden on Desktop/Print)
              ================================================== */}
              <div className="flex flex-col gap-3 mb-6 md:hidden print:hidden">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Subject Results</h3>
                {studentData.subjectResults.map((sub: any) => {
                  const gradeInfo = getGradeInfo(sub.totalObtained, sub.maxTotal)
                  const failStatus = isSubjectFailed(sub, showGrading)
                  const isExpanded = expandedSubject === sub.subjectId

                  return (
                    <div key={sub.subjectId} className="bg-stone-50 border border-stone-200 rounded-sm overflow-hidden shadow-sm">
                      <div 
                        className="p-3.5 flex items-center justify-between cursor-pointer active:bg-stone-100 transition-colors"
                        onClick={() => setExpandedSubject(isExpanded ? null : sub.subjectId)}
                      >
                        <div className="pr-4">
                          <h4 className="font-bold text-stone-900 text-sm leading-tight">{sub.subjectName}</h4>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mt-0.5">Total: {sub.isAbsent ? 'ABS' : sub.totalObtained} / {sub.maxTotal}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {showGrading ? (
                            <span className={`text-lg font-black ${gradeInfo.grade === 'F' ? 'text-[#b4483e]' : 'text-[#6b4c9a]'}`}>{gradeInfo.grade}</span>
                          ) : (
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-sm ${failStatus ? 'bg-[#fcf8f8] text-[#b4483e]' : 'bg-emerald-50 text-emerald-700'}`}>{failStatus ? 'FAIL' : 'PASS'}</span>
                          )}
                          <svg className={`w-4 h-4 text-stone-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>

                      {/* Smooth Expansion Area */}
                      <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                        <div className="overflow-hidden">
                          <div className="p-3.5 border-t border-stone-200 bg-white space-y-2 text-xs">
                            {allBreakdownNames.map(name => {
                              const hasComp = sub.breakdownsConfig?.some((b: any) => b.name === name);
                              if (!hasComp) return null;
                              return (
                                <div key={name} className="flex justify-between border-b border-stone-100 pb-1.5">
                                  <span className="font-bold text-stone-600">{name}</span>
                                  <span className="font-bold text-stone-900">{sub.isAbsent ? '-' : cell(sub.breakdownMarks?.[name])}</span>
                                </div>
                              )
                            })}
                            <div className="flex justify-between border-b border-stone-100 pb-1.5 pt-1">
                              <span className="font-bold text-stone-600">{examName} Obt.</span>
                              <span className="font-bold text-stone-900">{sub.isAbsent ? 'ABS' : sub.totalObtained}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Mobile Footer Totals */}
                <div className="mt-2 bg-[#fbf9fc] border border-[#dad3e3] p-4 rounded-sm flex justify-between items-center shadow-sm">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Grand Total</p>
                    <p className="text-xl font-black text-stone-900">{studentData.grandTotalObtained} <span className="text-xs text-stone-400 font-bold">/ {totals.maxTotal}</span></p>
                  </div>
                  <div className="text-right">
                    {showGrading ? (
                      <>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Final GPA</p>
                        <p className="text-xl font-black text-[#6b4c9a]">{overallGrade.gpa} ({overallGrade.grade})</p>
                      </>
                    ) : (
                      <>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Percentage</p>
                        <p className="text-xl font-black text-[#6b4c9a]">{studentData.percentage}%</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* ==================================================
                  DESKTOP / PRINT VIEW: STANDARD TABLE 
              ================================================== */}
              <div className="hidden md:block print:block mb-8">
                <table className="w-full border-collapse border border-stone-800 text-sm">
                  <thead>
                    <tr className="bg-stone-100">
                      <th rowSpan={2} className="p-2.5 border border-stone-800 font-black text-stone-900 uppercase text-left align-bottom">Subject</th>
                      <th rowSpan={2} className="p-2.5 border border-stone-800 font-bold text-stone-600 uppercase text-center align-bottom w-16 text-xs tracking-wider">Full Marks</th>
                      
                      {/* Dynamic Breakdown Headers */}
                      {allBreakdownNames.map(name => (
                        <th key={name} rowSpan={2} className="p-2 border border-stone-800 font-bold text-stone-600 uppercase text-center align-bottom w-16 text-[10px] tracking-wider">{name}</th>
                      ))}
                      
                      <th rowSpan={2} className="p-2 border border-stone-800 font-black text-stone-900 uppercase text-center align-bottom w-16 text-xs tracking-wider">Total</th>
                      {showGrading && <th rowSpan={2} className="p-2 border border-stone-800 font-bold text-stone-600 uppercase text-center align-bottom w-16 text-[10px] tracking-wider">Highest</th>}
                      {showGrading && <th rowSpan={2} className="p-2 border border-stone-800 font-bold text-stone-600 uppercase text-center align-bottom w-14 text-[10px] tracking-wider">GP</th>}
                      {showGrading && <th rowSpan={2} className="p-2 border border-stone-800 font-bold text-stone-600 uppercase text-center align-bottom w-14 text-[10px] tracking-wider">LG</th>}
                      {!showGrading && <th rowSpan={2} className="p-2 border border-stone-800 font-bold text-stone-600 uppercase text-center align-bottom w-20 text-[10px] tracking-wider">Status</th>}
                    </tr>
                    <tr className="bg-stone-50"></tr>
                  </thead>
                  <tbody>
                    {studentData.subjectResults.map((sub: any) => {
                      const gradeInfo = getGradeInfo(sub.totalObtained, sub.maxTotal)
                      const failStatus = isSubjectFailed(sub, showGrading)
                      const isHighest = sub.totalObtained === subjectHighest[sub.subjectId] && sub.totalObtained > 0

                      return (
                        <tr key={sub.subjectId}>
                          <td className="p-2.5 border border-stone-800 font-bold text-stone-900">{sub.subjectName}</td>
                          <td className="p-2.5 border border-stone-800 text-center font-bold text-stone-500">{sub.maxTotal}</td>

                          {/* Dynamic Breakdown Cells */}
                          {allBreakdownNames.map(name => {
                            const hasComp = sub.breakdownsConfig?.some((b: any) => b.name === name);
                            if (!hasComp) return <td key={name} className="p-2.5 border border-stone-800 text-center font-medium text-stone-400">-</td>
                            return (
                              <td key={name} className="p-2.5 border border-stone-800 text-center font-medium text-stone-700">
                                {sub.isAbsent ? '-' : cell(sub.breakdownMarks?.[name])}
                              </td>
                            )
                          })}

                          {/* Total Obt */}
                          <td className={`p-2.5 border border-stone-800 text-center font-black ${failStatus && !sub.isAbsent ? 'text-[#b4483e] print:text-black' : 'text-stone-900'} ${isHighest ? 'text-[#6b4c9a] print:text-black' : ''}`}>
                            {sub.isAbsent ? 'ABS' : sub.totalObtained}
                          </td>

                          {showGrading && (
                            <td className="p-2.5 border border-stone-800 text-center font-bold text-stone-500">{subjectHighest[sub.subjectId]}</td>
                          )}
                          {showGrading && (
                            <td className="p-2.5 border border-stone-800 text-center font-black text-stone-700">{sub.isAbsent ? '-' : gradeInfo.gpa.toFixed(2)}</td>
                          )}
                          {showGrading && (
                            <td className={`p-2.5 border border-stone-800 text-center font-black text-lg ${gradeInfo.grade === 'F' ? 'text-[#b4483e] print:text-black' : 'text-[#6b4c9a] print:text-black'}`}>{sub.isAbsent ? '-' : gradeInfo.grade}</td>
                          )}
                          {!showGrading && (
                            <td className={`p-2.5 border border-stone-800 text-center font-black text-[10px] tracking-widest uppercase ${failStatus ? 'text-[#b4483e] print:text-black' : 'text-emerald-600 print:text-black'}`}>
                              {failStatus ? 'FAIL' : 'PASS'}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-stone-100">
                      <td className="p-3 border border-stone-800 font-black text-right uppercase tracking-wider text-stone-900 text-xs">Total / GPA</td>
                      <td className="p-3 border border-stone-800 font-black text-center text-stone-900">{totals.maxTotal}</td>
                      {allBreakdownNames.map(name => <td key={name} className="p-3 border border-stone-800"></td>)}
                      <td className="p-3 border border-stone-800 font-black text-center text-xl text-stone-900">{studentData.grandTotalObtained}</td>
                      {showGrading && <td className="p-3 border border-stone-800"></td>}
                      {showGrading && <td className="p-3 border border-stone-800 font-black text-center text-stone-900">{overallGrade.gpa}</td>}
                      {showGrading && <td className="p-3 border border-stone-800 font-black text-center text-xl text-[#6b4c9a] print:text-black">{overallGrade.grade}</td>}
                      {!showGrading && <td className="p-3 border border-stone-800 font-black text-center text-[#6b4c9a] print:text-black">{studentData.percentage}%</td>}
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Bottom Info & Signatures */}
              <div className="flex flex-col md:flex-row gap-6 mb-10">
                <table className="border-collapse border border-stone-800 text-sm w-full md:w-64 shrink-0">
                  <tbody>
                    <tr>
                      <td className="p-2 border border-stone-800 font-bold text-stone-600 bg-stone-50 text-[10px] uppercase tracking-wider">Section Pos</td>
                      <td className="p-2 border border-stone-800 font-bold text-stone-900 text-center">{cell(studentData.sectionRank)}</td>
                    </tr>
                    <tr>
                      <td className="p-2 border border-stone-800 font-bold text-stone-600 bg-stone-50 text-[10px] uppercase tracking-wider">Class Pos</td>
                      <td className="p-2 border border-stone-800 font-bold text-stone-900 text-center">{cell(rank)}</td>
                    </tr>
                    <tr>
                      <td className="p-2 border border-stone-800 font-bold text-stone-600 bg-stone-50 text-[10px] uppercase tracking-wider">Classes Held</td>
                      <td className="p-2 border border-stone-800 font-medium text-stone-900 text-center">{cell(studentData.attendance?.held)}</td>
                    </tr>
                    <tr>
                      <td className="p-2 border border-stone-800 font-bold text-stone-600 bg-stone-50 text-[10px] uppercase tracking-wider">Present</td>
                      <td className="p-2 border border-stone-800 font-medium text-stone-900 text-center">{cell(studentData.attendance?.present)}</td>
                    </tr>
                    <tr>
                      <td className="p-2 border border-stone-800 font-bold text-stone-600 bg-stone-50 text-[10px] uppercase tracking-wider">Absent</td>
                      <td className="p-2 border border-stone-800 font-medium text-stone-900 text-center">{cell(studentData.attendance?.absent)}</td>
                    </tr>
                  </tbody>
                </table>

                <table className="flex-1 border-collapse border border-stone-800 text-sm">
                  <tbody>
                    <tr>
                      <td className="p-3 border border-stone-800 font-bold text-stone-600 bg-stone-50 align-top w-32 text-[10px] uppercase tracking-wider">Teacher's Comments</td>
                      <td className="p-3 border border-stone-800 text-stone-900 h-24">{cell(studentData.teacherComment)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Signatures */}
              <div className="flex flex-col sm:flex-row justify-between gap-10 mt-16 px-4">
                <div className="text-center flex-1">
                  <div className="w-full border-b border-stone-800 mb-3 h-8"></div>
                  <p className="font-bold text-stone-500 uppercase text-[9px] tracking-widest">Class Teacher's Signature</p>
                </div>
                <div className="text-center flex-1">
                  <div className="w-full border-b border-stone-800 mb-3 h-8"></div>
                  <p className="font-bold text-stone-500 uppercase text-[9px] tracking-widest">Guardian's Signature</p>
                </div>
                <div className="text-center flex-1">
                  <div className="w-full border-b border-stone-800 mb-3 h-8"></div>
                  <p className="font-bold text-stone-500 uppercase text-[9px] tracking-widest">Headmaster's Signature</p>
                </div>
              </div>

            </div>
          </div>
        ) : (
          <div className="py-20 text-center">
            <div className="inline-block p-4 rounded-full bg-stone-100 mb-4 print:hidden">
              <svg className="w-8 h-8 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            </div>
            <p className="text-sm font-medium text-stone-500">Please select a student from the dropdown above to view and export their report card.</p>
          </div>
        )}
      </div>
    </div>
  )
}