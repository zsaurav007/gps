'use client'

import React, { useState, useMemo } from 'react'
import Dropdown from '@/components/ui/dropdown'
import { getOverallGPA, isSubjectFailed, hasStudentFailed } from './IndividualReportView'

export default function CumulativeSheet({ reportData, uniqueSubjects, showGrading }: { reportData: any[], uniqueSubjects: any[], showGrading: boolean }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string | number>('All')
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)
  
  // DEFAULT: Serial-wise ascending
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc'|'desc' }>({ key: 'roll', direction: 'asc' })
  
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  const statusOptions = [
    { label: 'All Students', value: 'All' },
    { label: 'Passed Only', value: 'Passed' },
    { label: 'Failed Only', value: 'Failed' }
  ]

  // Detect which subjects have breakdowns (CQ, MCQ, etc.)
  const subjectConfigs = useMemo(() => {
    const configs: Record<string, { breakdowns: any[] }> = {}
    reportData.forEach(r => {
      r.subjectResults.forEach((sr: any) => {
         if (!configs[sr.subjectId] && sr.breakdownsConfig && sr.breakdownsConfig.length > 0) {
           configs[sr.subjectId] = { breakdowns: sr.breakdownsConfig }
         }
      })
    })
    return configs;
  }, [reportData])

  const hasAnyBreakdowns = uniqueSubjects.some((sub: any) => subjectConfigs[sub.id]?.breakdowns?.length > 0)

  const subjectStats = useMemo(() => {
    const stats: Record<string, { high: number, low: number }> = {}
    uniqueSubjects.forEach(sub => {
      const allMarks = reportData.map(r => {
        const sr = r.subjectResults.find((s: any) => s.subjectId === sub.id)
        return (sr && !sr.isAbsent) ? sr.totalObtained : null
      }).filter(m => m !== null) as number[]

      stats[sub.id] = {
        high: allMarks.length > 0 ? Math.max(...allMarks) : 0,
        low: allMarks.length > 0 ? Math.min(...allMarks) : 0
      }
    })
    return stats
  }, [reportData, uniqueSubjects])

  let processedData = reportData.filter(d => {
    const searchString = `${d.student.first_name} ${d.student.last_name} ${d.student.enrollment_id}`.toLowerCase()
    const matchesSearch = searchString.includes(searchTerm.toLowerCase())
    
    const studentFailed = hasStudentFailed(d.subjectResults, showGrading, d.hasFailedAnySubject)
    const matchesStatus = filterStatus === 'All' 
      ? true 
      : filterStatus === 'Passed' ? !studentFailed : studentFailed
      
    return matchesSearch && matchesStatus
  })

  processedData.sort((a, b) => {
    if (sortConfig.key === 'roll') {
      return sortConfig.direction === 'asc' 
        ? a.student.enrollment_id.localeCompare(b.student.enrollment_id, undefined, { numeric: true })
        : b.student.enrollment_id.localeCompare(a.student.enrollment_id, undefined, { numeric: true })
    }

    let valA, valB;
    if (sortConfig.key === 'rank') {
      valA = a.rank; valB = b.rank;
    } else if (sortConfig.key === 'total') {
      valA = a.grandTotalObtained; valB = b.grandTotalObtained;
    } else {
      valA = `${a.student.first_name}`.toLowerCase(); valB = `${b.student.first_name}`.toLowerCase();
    }

    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  })

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'
    setSortConfig({ key, direction })
    setCurrentPage(1)
  }

  const totalPages = Math.ceil(processedData.length / itemsPerPage)
  const paginatedData = processedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  // --- Export Handlers ---
  const handleExportXL = () => {
    let csvContent = "data:text/csv;charset=utf-8,"
    
    // Build Headers dynamically
    let headers = ["Rank", "Roll", "Student Name"]
    uniqueSubjects.forEach((sub: any) => {
      const breaks = subjectConfigs[sub.id]?.breakdowns || []
      if (breaks.length > 0) {
        breaks.forEach((b: any) => headers.push(`${sub.name} ${b.name}`))
      }
      headers.push(`${sub.name} Total (/${sub.max})`)
    })
    headers.push("Grand Total")
    if (showGrading) headers.push("GPA", "Grade")
    headers.push("Percentage", "Status")
    
    csvContent += headers.join(",") + "\n"

    // Build Rows
    processedData.forEach(row => {
      const overallGrade = showGrading ? getOverallGPA(row.subjectResults) : null
      const studentFailed = hasStudentFailed(row.subjectResults, showGrading, row.hasFailedAnySubject)

      let rowData = [
        row.rank,
        row.student.enrollment_id,
        `"${row.student.first_name} ${row.student.last_name}"` // Escape commas in names
      ]

      uniqueSubjects.forEach((sub: any) => {
        const sr = row.subjectResults.find((s: any) => s.subjectId === sub.id)
        const breaks = subjectConfigs[sub.id]?.breakdowns || []
        
        if (!sr || sr.isAbsent) {
          if (breaks.length > 0) breaks.forEach(() => rowData.push('ABS'))
          rowData.push('ABS')
        } else {
          if (breaks.length > 0) {
            breaks.forEach((b: any) => rowData.push(sr.breakdownMarks?.[b.name] ?? 0))
          }
          rowData.push(sr.totalObtained)
        }
      })

      rowData.push(row.grandTotalObtained)
      
      if (showGrading && overallGrade) {
        rowData.push(overallGrade.gpa, overallGrade.grade)
      }
      
      rowData.push(`${row.percentage}%`, studentFailed ? 'FAILED' : 'PASSED')
      csvContent += rowData.join(",") + "\n"
    })

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "Cumulative_Report.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="bg-white space-y-6 font-sans">
      
      {/* Control Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5 print:hidden bg-[#fbf9fc] p-5 md:px-8 border-b border-[#dad3e3]">
        <h3 className="text-sm font-bold text-stone-900 uppercase tracking-widest shrink-0">Cumulative Record</h3>
        
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full md:w-auto">
          <input 
            type="text" 
            placeholder="Search name or roll..." 
            value={searchTerm} 
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
            className="w-full sm:w-64 p-2.5 border border-stone-300 rounded-sm text-sm font-medium text-stone-900 bg-white focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] shadow-sm transition-all" 
          />
          <div className="w-full sm:w-48 relative z-20">
            <Dropdown options={statusOptions} value={filterStatus} onChange={(val) => { setFilterStatus(val); setCurrentPage(1) }} />
          </div>
        </div>

        <div className="flex gap-3 w-full md:w-auto shrink-0 border-t border-[#dad3e3] md:border-t-0 pt-4 md:pt-0 mt-2 md:mt-0">
          <button onClick={handleExportXL} className="flex-1 md:flex-none bg-white text-stone-700 border border-stone-300 px-5 py-2.5 rounded-sm hover:bg-stone-50 text-[10px] font-bold uppercase tracking-widest transition-colors shadow-sm text-center">
            Export XL
          </button>
          <button onClick={() => window.print()} className="flex-1 md:flex-none bg-[#6b4c9a] text-white px-5 py-2.5 rounded-sm hover:bg-[#5a3f82] text-[10px] font-bold uppercase tracking-widest transition-colors shadow-sm flex items-center justify-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
            Print
          </button>
        </div>
      </div>

      <div className="px-6 md:px-8 pb-8">
        
        {/* =========================================================
            MOBILE VIEW: EXPANDABLE CARDS (Hidden on Desktop/Print)
        ========================================================= */}
        <div className="md:hidden print:hidden flex flex-col gap-4">
          {paginatedData.length === 0 ? (
            <div className="p-8 text-center text-stone-500 text-xs italic bg-stone-50 border border-stone-200 rounded-sm">
              No students match your criteria.
            </div>
          ) : (
            paginatedData.map((row) => {
              const overallGrade = showGrading ? getOverallGPA(row.subjectResults) : null
              const studentFailed = hasStudentFailed(row.subjectResults, showGrading, row.hasFailedAnySubject)
              const isExpanded = expandedRowId === row.student.id

              return (
                <div key={row.student.id} className="bg-white border border-stone-200 rounded-sm shadow-sm overflow-hidden">
                  <div 
                    onClick={() => setExpandedRowId(isExpanded ? null : row.student.id)}
                    className={`p-4 flex flex-col gap-3 cursor-pointer transition-colors active:bg-stone-50 ${isExpanded ? 'bg-[#fbf9fc] border-b border-[#dad3e3]' : ''}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Rank {row.rank}</span>
                          <span className="text-stone-300">|</span>
                          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Roll {row.student.enrollment_id}</span>
                        </div>
                        <h4 className="font-bold text-stone-900 text-sm">{row.student.first_name} {row.student.last_name}</h4>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-sm ${studentFailed ? 'bg-[#fcf8f8] text-[#b4483e]' : 'bg-emerald-50 text-emerald-700'}`}>
                          {studentFailed ? 'FAIL' : 'PASS'}
                        </span>
                        <svg className={`w-4 h-4 text-stone-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                  </div>

                  {/* Smooth Expanded Content */}
                  <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                      <div className="p-4 bg-stone-50 space-y-3">
                        
                        {/* Subjects Breakdown */}
                        <div className="space-y-3 border-b border-stone-200 pb-3">
                          <h5 className="text-[9px] font-bold uppercase tracking-widest text-stone-500 mb-2">Subject Breakdown</h5>
                          {uniqueSubjects.map((sub: any) => {
                            const sr = row.subjectResults.find((s: any) => s.subjectId === sub.id)
                            const isAbsent = !sr || sr.isAbsent
                            const isHighest = !isAbsent && sr.totalObtained === subjectStats[sub.id].high && sr.totalObtained > 0
                            const breaks = subjectConfigs[sub.id]?.breakdowns || []
                            
                            return (
                              <div key={sub.id} className="flex flex-col text-xs border-b border-stone-100 pb-2 last:border-0 last:pb-0">
                                <div className="flex justify-between font-semibold items-center">
                                  <span className="text-stone-800">{sub.name}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-stone-400">/{sub.max}</span>
                                    <span className={`font-bold w-8 text-right ${isAbsent ? 'text-[#b4483e]' : 'text-stone-900'}`}>
                                      {isAbsent ? 'ABS' : sr.totalObtained}
                                    </span>
                                    {isHighest && <span className="text-[10px] text-[#6b4c9a]" title="Highest Score">⭐</span>}
                                  </div>
                                </div>
                                {breaks.length > 0 && !isAbsent && (
                                  <div className="flex gap-4 mt-1 text-[10px] text-stone-500 bg-white p-1.5 rounded-sm border border-stone-200">
                                    {breaks.map((b: any) => (
                                      <span key={b.name}><strong className="text-stone-400 uppercase">{b.name}:</strong> {sr.breakdownMarks?.[b.name] ?? 0}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>

                        {/* Totals */}
                        <div className="flex justify-between items-end pt-1">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Percentage</p>
                            <p className="text-sm font-black text-stone-900 mt-0.5">{row.percentage}%</p>
                          </div>
                          {showGrading && overallGrade && (
                            <div className="text-center px-4">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">GPA</p>
                              <p className={`text-sm font-black mt-0.5 ${overallGrade.grade === 'F' ? 'text-[#b4483e]' : 'text-[#6b4c9a]'}`}>{overallGrade.gpa} ({overallGrade.grade})</p>
                            </div>
                          )}
                          <div className="text-right">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Grand Total</p>
                            <p className="text-lg font-black text-[#6b4c9a] mt-0.5">{row.grandTotalObtained}</p>
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* =========================================================
            DESKTOP / PRINT VIEW: FULL TABLE
        ========================================================= */}
        <div className="hidden md:block print:block overflow-x-auto border border-stone-200 rounded-sm shadow-sm bg-white">
          <table className="w-full text-left border-collapse min-w-max text-sm">
            <thead>
              {hasAnyBreakdowns ? (
                <>
                  <tr className="bg-stone-100 border-b border-stone-200">
                    <th rowSpan={2} className="p-3 text-[10px] font-bold uppercase tracking-widest text-stone-600 border-r border-stone-200 sticky left-0 z-20 bg-stone-100 cursor-pointer hover:bg-stone-200 transition-colors align-middle" onClick={() => requestSort('rank')}>
                      Rank {sortConfig.key === 'rank' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th rowSpan={2} className="p-3 text-[10px] font-bold uppercase tracking-widest text-stone-600 border-r border-stone-200 sticky left-16 z-20 bg-stone-100 cursor-pointer hover:bg-stone-200 transition-colors align-middle" onClick={() => requestSort('roll')}>
                      Roll {sortConfig.key === 'roll' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th rowSpan={2} className="p-3 text-[10px] font-bold uppercase tracking-widest text-stone-600 border-r border-stone-300 sticky left-[120px] z-20 bg-stone-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] cursor-pointer hover:bg-stone-200 transition-colors align-middle" onClick={() => requestSort('name')}>
                      Student Name {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    
                    {uniqueSubjects.map((sub: any) => {
                      const breaks = subjectConfigs[sub.id]?.breakdowns || [];
                      const colSpan = breaks.length > 0 ? breaks.length + 1 : 1;
                      return (
                        <th key={sub.id} colSpan={colSpan} rowSpan={breaks.length > 0 ? 1 : 2} className="p-3 text-[10px] font-bold uppercase tracking-widest text-[#6b4c9a] border-r border-stone-200 text-center bg-[#fbf9fc]">
                          {sub.name} <br/> <span className="text-[9px] text-stone-400 font-normal">Out of {sub.max}</span>
                        </th>
                      )
                    })}
                    
                    <th rowSpan={2} className="p-3 text-[10px] font-bold uppercase tracking-widest text-stone-600 border-r border-stone-200 text-center cursor-pointer hover:bg-stone-200 transition-colors align-middle" onClick={() => requestSort('total')}>
                      Total {sortConfig.key === 'total' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    
                    {showGrading && <th rowSpan={2} className="p-3 text-[10px] font-bold uppercase tracking-widest text-[#6b4c9a] border-r border-stone-200 text-center align-middle">GPA</th>}
                    <th rowSpan={2} className="p-3 text-[10px] font-bold uppercase tracking-widest text-stone-600 border-r border-stone-200 text-center align-middle">%</th>
                    <th rowSpan={2} className="p-3 text-[10px] font-bold uppercase tracking-widest text-stone-600 text-center align-middle">Status</th>
                  </tr>
                  <tr className="bg-stone-50 border-b border-stone-300">
                    {uniqueSubjects.map((sub: any) => {
                      const breaks = subjectConfigs[sub.id]?.breakdowns || [];
                      if (breaks.length > 0) {
                        return (
                          <React.Fragment key={`sub-breaks-${sub.id}`}>
                            {breaks.map((b: any) => (
                              <th key={b.name} className="p-2 text-[9px] font-bold uppercase tracking-widest text-stone-500 border-r border-stone-200 text-center">{b.name}</th>
                            ))}
                            <th className="p-2 text-[9px] font-bold uppercase tracking-widest text-stone-800 border-r border-stone-200 text-center bg-stone-100">Total</th>
                          </React.Fragment>
                        )
                      }
                      return null;
                    })}
                  </tr>
                </>
              ) : (
                // Original single-row header if no subjects have breakdowns
                <tr className="bg-stone-100 border-b border-stone-300">
                  <th className="p-3 text-[10px] font-bold uppercase tracking-widest text-stone-600 border-r border-stone-200 sticky left-0 z-20 bg-stone-100 cursor-pointer hover:bg-stone-200 transition-colors" onClick={() => requestSort('rank')}>
                    Rank {sortConfig.key === 'rank' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="p-3 text-[10px] font-bold uppercase tracking-widest text-stone-600 border-r border-stone-200 sticky left-16 z-20 bg-stone-100 cursor-pointer hover:bg-stone-200 transition-colors" onClick={() => requestSort('roll')}>
                    Roll {sortConfig.key === 'roll' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="p-3 text-[10px] font-bold uppercase tracking-widest text-stone-600 border-r border-stone-300 sticky left-[120px] z-20 bg-stone-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] cursor-pointer hover:bg-stone-200 transition-colors" onClick={() => requestSort('name')}>
                    Student Name {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  
                  {uniqueSubjects.map((sub: any) => (
                    <th key={sub.id} className="p-3 text-[10px] font-bold uppercase tracking-widest text-stone-600 border-r border-stone-200 text-center">
                      {sub.name} <br/> <span className="text-[9px] text-stone-400">Out of {sub.max}</span>
                    </th>
                  ))}
                  
                  <th className="p-3 text-[10px] font-bold uppercase tracking-widest text-stone-600 border-r border-stone-200 text-center cursor-pointer hover:bg-stone-200 transition-colors" onClick={() => requestSort('total')}>
                    Total {sortConfig.key === 'total' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  
                  {showGrading && <th className="p-3 text-[10px] font-bold uppercase tracking-widest text-[#6b4c9a] border-r border-stone-200 text-center">GPA</th>}
                  
                  <th className="p-3 text-[10px] font-bold uppercase tracking-widest text-stone-600 border-r border-stone-200 text-center">%</th>
                  <th className="p-3 text-[10px] font-bold uppercase tracking-widest text-stone-600 text-center">Status</th>
                </tr>
              )}
              
              {/* High/Low Stats Row */}
              <tr className="bg-stone-50 border-b-2 border-stone-300">
                <td colSpan={3} className="p-2.5 text-[10px] font-bold text-right text-stone-500 uppercase tracking-widest sticky left-0 z-10 bg-stone-50 border-r border-stone-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  Subject Highest / Lowest:
                </td>
                {uniqueSubjects.map((sub: any) => {
                  const breaks = subjectConfigs[sub.id]?.breakdowns || [];
                  const colSpan = breaks.length > 0 ? breaks.length + 1 : 1;
                  return (
                    <td key={sub.id} colSpan={colSpan} className="p-2.5 text-[10px] text-center border-r border-stone-200 tracking-wider">
                      <span className="text-[#6b4c9a] font-bold">H: {subjectStats[sub.id]?.high}</span>
                      <span className="mx-1.5 text-stone-300">|</span>
                      <span className="text-[#b4483e] font-bold">L: {subjectStats[sub.id]?.low}</span>
                    </td>
                  )
                })}
                <td colSpan={showGrading ? 4 : 3} className="bg-stone-50"></td>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-stone-200">
              {paginatedData.map((row) => {
                const overallGrade = showGrading ? getOverallGPA(row.subjectResults) : null
                const studentFailed = hasStudentFailed(row.subjectResults, showGrading, row.hasFailedAnySubject)

                return (
                  <tr key={row.student.id} className="hover:bg-stone-50 transition-colors bg-white">
                    <td className="p-3 font-bold text-stone-900 border-r border-stone-200 sticky left-0 z-10 text-center bg-inherit">{row.rank}</td>
                    <td className="p-3 font-semibold text-stone-600 border-r border-stone-200 sticky left-16 z-10 text-center bg-inherit">{row.student.enrollment_id}</td>
                    <td className="p-3 font-bold text-stone-900 border-r border-stone-300 sticky left-[120px] z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] bg-inherit">
                      {row.student.first_name} {row.student.last_name}
                    </td>

                    {uniqueSubjects.map((sub: any) => {
                      const sr = row.subjectResults.find((s: any) => s.subjectId === sub.id)
                      const breaks = subjectConfigs[sub.id]?.breakdowns || [];
                      const isHighest = sr && sr.totalObtained === subjectStats[sub.id].high && sr.totalObtained > 0
                      const failStatus = sr ? isSubjectFailed(sr, showGrading) : true

                      if (!sr || sr.isAbsent) {
                         if (breaks.length > 0) {
                           return (
                             <React.Fragment key={sub.id}>
                               {breaks.map((_: any, i: number) => <td key={i} className="p-3 text-center border-r border-stone-100 text-stone-300">-</td>)}
                               <td className="p-3 text-center border-r border-stone-200 font-bold text-[#b4483e] bg-[#fcf8f8]">ABS</td>
                             </React.Fragment>
                           )
                         }
                         return <td key={sub.id} className="p-3 text-center border-r border-stone-200 font-bold text-[#b4483e] bg-[#fcf8f8]">ABS</td>
                      }

                      if (breaks.length > 0) {
                        return (
                          <React.Fragment key={sub.id}>
                            {breaks.map((b: any) => (
                              <td key={b.name} className="p-3 text-center border-r border-stone-100 font-medium text-stone-600">
                                {sr.breakdownMarks?.[b.name] ?? '-'}
                              </td>
                            ))}
                            <td className={`p-3 text-center border-r border-stone-200 font-bold bg-stone-50 ${failStatus ? 'text-[#b4483e]' : 'text-stone-900'} ${isHighest ? 'text-[#6b4c9a] bg-[#fbf9fc]' : ''}`}>
                              {sr.totalObtained}
                              {isHighest && <span className="ml-1 text-[10px] text-[#6b4c9a]" title="Highest Score in Subject">⭐</span>}
                            </td>
                          </React.Fragment>
                        )
                      }

                      return (
                        <td key={sub.id} className={`p-3 text-center border-r border-stone-200 font-bold ${failStatus ? 'text-[#b4483e] bg-[#fcf8f8]' : 'text-stone-900'} ${isHighest ? 'text-[#6b4c9a] bg-[#fbf9fc]' : ''}`}>
                          {sr.totalObtained}
                          {isHighest && <span className="ml-1 text-[10px] text-[#6b4c9a]" title="Highest Score in Subject">⭐</span>}
                        </td>
                      )
                    })}

                    <td className="p-3 font-black text-stone-900 text-center border-r border-stone-200 bg-stone-50">{row.grandTotalObtained}</td>
                    
                    {showGrading && overallGrade && (
                      <td className={`p-3 font-black text-center border-r border-stone-200 ${overallGrade.grade === 'F' ? 'text-[#b4483e] bg-[#fcf8f8]' : 'text-[#6b4c9a] bg-[#fbf9fc]'}`}>
                        {overallGrade.gpa} <span className="text-[10px] block font-bold tracking-widest">{overallGrade.grade}</span>
                      </td>
                    )}
                    
                    <td className="p-3 font-bold text-stone-600 text-center border-r border-stone-200">{row.percentage}%</td>
                    <td className="p-3 text-center font-bold">
                      {studentFailed ? (
                        <span className="text-[#b4483e] bg-[#fcf8f8] border border-[#b4483e]/20 px-2.5 py-1 rounded-sm text-[10px] uppercase tracking-widest">FAIL</span>
                      ) : (
                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-sm text-[10px] uppercase tracking-widest">PASS</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {processedData.length === 0 && (
                <tr><td colSpan={100} className="p-16 text-center text-stone-500 font-medium text-sm bg-stone-50">No students match your search or filter criteria.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row justify-between items-center bg-[#fbf9fc] p-4 mt-6 rounded-sm border border-[#dad3e3] print:hidden gap-4">
            <p className="text-[11px] text-stone-600 font-bold uppercase tracking-widest">
              Showing <span className="text-stone-900">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-stone-900">{Math.min(currentPage * itemsPerPage, processedData.length)}</span> of <span className="text-stone-900">{processedData.length}</span> students
            </p>
            <div className="flex gap-2 w-full sm:w-auto">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                disabled={currentPage === 1}
                className="flex-1 sm:flex-none px-4 py-2 border border-stone-300 rounded-sm bg-white text-stone-700 disabled:opacity-50 hover:bg-stone-50 font-bold text-[10px] uppercase tracking-widest transition-colors shadow-sm"
              >
                Prev
              </button>
              <div className="flex items-center px-4 font-bold text-[11px] uppercase tracking-widest text-stone-600 whitespace-nowrap">
                Page {currentPage} of {totalPages}
              </div>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                disabled={currentPage === totalPages}
                className="flex-1 sm:flex-none px-4 py-2 border border-stone-300 rounded-sm bg-white text-stone-700 disabled:opacity-50 hover:bg-stone-50 font-bold text-[10px] uppercase tracking-widest transition-colors shadow-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}