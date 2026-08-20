'use client'

import { useState } from 'react'
import { getDetailedReportData } from '@/app/actions/report-actions'
import Dropdown from '@/components/ui/dropdown' 
import CumulativeSheet from './CumulativeSheet'
import IndividualReportView, { hasStudentFailed } from './IndividualReportView'

export default function ReportsDashboard({ exams, classes, schoolName = "Standard High School" }: { exams: any[], classes: any[], schoolName?: string }) {
  const [selectedClassId, setSelectedClassId] = useState<string | number>('')
  const [selectedExamId, setSelectedExamId] = useState<string | number>('')
  
  const [isLoading, setIsLoading] = useState(false)
  const [reportData, setReportData] = useState<any[] | null>(null)
  
  const [activeTab, setActiveTab] = useState<'analytics' | 'cumulative' | 'individual'>('analytics')
  const [showGrading, setShowGrading] = useState(false)

  // Mapping raw data to the specific { label, value } format required by the Dropdown
  const classOptions = classes.map(cls => ({ label: cls.name, value: cls.id }))
  
  const classExams = exams.filter(e => String(e.class_id) === String(selectedClassId))
  const examOptions = classExams.map(ex => ({
    label: `${ex.name} ${ex.exam_date ? `(${new Date(ex.exam_date).toLocaleDateString('en-GB')})` : ''}`,
    value: ex.id
  }))

  const handleGenerateReport = async () => {
    if (!selectedExamId || !selectedClassId) return
    setIsLoading(true)
    try {
      const data = await getDetailedReportData(String(selectedExamId), String(selectedClassId))
      setReportData(data)
    } catch (error: any) {
      alert(`Error generating report: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const selectedExamName = exams.find(e => String(e.id) === String(selectedExamId))?.name || ''
  const selectedClassName = classes.find(c => String(c.id) === String(selectedClassId))?.name || ''

  const totalStudents = reportData?.length || 0
  const failedStudents = reportData?.filter(d => hasStudentFailed(d.subjectResults, showGrading, d.hasFailedAnySubject)) || []
  const passRate = totalStudents > 0 ? (((totalStudents - failedStudents.length) / totalStudents) * 100).toFixed(1) : 0
  
  const topPerformers = reportData 
    ? [...reportData].sort((a, b) => b.grandTotalObtained - a.grandTotalObtained).slice(0, 5) 
    : []

  const uniqueSubjects = reportData && reportData.length > 0 
    ? reportData[0].subjectResults.map((sr: any) => ({ id: sr.subjectId, name: sr.subjectName, max: sr.maxTotal }))
    : []

  return (
    // REMOVED 'overflow-hidden' to prevent dropdown clipping
    <div className="bg-white rounded-sm shadow-sm border border-stone-200 flex flex-col font-sans relative">
      
      {/* FILTER BAR USING CUSTOM DROPDOWN */}
      <div className="bg-[#fbf9fc] p-6 md:p-8 border-b border-[#dad3e3] rounded-t-sm flex flex-col lg:flex-row gap-6 items-start lg:items-end print:hidden relative z-50">
        
        <div className="w-full lg:w-64 relative z-50">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-2">1. Select Class</label>
          <Dropdown 
            options={classOptions} 
            value={selectedClassId} 
            onChange={(val) => { setSelectedClassId(val); setSelectedExamId(''); setReportData(null) }} 
            placeholder="-- Choose Class --" 
            hasSearch={true} 
          />
        </div>

        <div className="w-full lg:w-64 relative z-40">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-2">2. Select Exam</label>
          <Dropdown 
            options={examOptions} 
            value={selectedExamId} 
            onChange={(val) => { setSelectedExamId(val); setReportData(null) }} 
            disabled={!selectedClassId} 
            placeholder="-- Choose Exam --" 
            hasSearch={true} 
          />
        </div>
        
        <div className="flex-grow flex flex-col sm:flex-row items-start sm:items-center justify-end gap-6 w-full lg:w-auto pt-2 lg:pt-0">
          <label className="flex items-center gap-3 cursor-pointer group shrink-0">
            <input 
              type="checkbox" 
              checked={showGrading} 
              onChange={(e) => setShowGrading(e.target.checked)}
              className="w-4 h-4 text-[#6b4c9a] bg-white border-stone-300 rounded-sm focus:ring-[#6b4c9a] accent-[#6b4c9a] cursor-pointer"
            />
            <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wide group-hover:text-[#6b4c9a] transition-colors">
              Enable Grading (A+, GPA)
            </span>
          </label>

          <button 
            onClick={handleGenerateReport} 
            disabled={!selectedExamId || !selectedClassId || isLoading} 
            className="w-full sm:w-auto bg-[#6b4c9a] text-white px-8 py-3.5 rounded-sm text-xs uppercase tracking-widest font-bold hover:bg-[#5a3f82] disabled:opacity-50 transition-colors shadow-sm shrink-0 flex items-center justify-center"
          >
            {isLoading ? 'Crunching Data...' : 'Generate Engine'}
          </button>
        </div>
      </div>

      {/* REPORT CONTENT */}
      {!reportData ? (
        <div className="p-16 text-center text-stone-500 font-medium text-sm bg-stone-50 rounded-b-sm print:hidden">
          Select a Class and Exam, then click <span className="font-bold">"Generate Engine"</span> to view analytics and results.
        </div>
      ) : reportData.length === 0 ? (
        <div className="p-16 text-center text-[#b4483e] bg-[#fcf8f8] border-t border-[#b4483e]/20 font-medium text-sm rounded-b-sm print:hidden">
          No student data found for this class in this exam.
        </div>
      ) : (
        <div className="rounded-b-sm bg-white relative z-10">
          {/* TABS */}
          <div className="flex border-b border-stone-200 px-6 md:px-8 pt-2 gap-8 print:hidden overflow-x-auto custom-scrollbar">
            {[
              { id: 'analytics', label: 'Class Analytics' },
              { id: 'cumulative', label: 'Cumulative Sheet' },
              { id: 'individual', label: 'Individual Cards' }
            ].map((tab) => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)} 
                className={`pb-3.5 pt-4 text-[11px] font-bold uppercase tracking-widest whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id 
                    ? 'border-[#6b4c9a] text-[#6b4c9a]' 
                    : 'border-transparent text-stone-500 hover:text-stone-800 hover:border-stone-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB CONTENT */}
          {activeTab === 'analytics' && (
            <div className="p-6 md:p-8 bg-stone-50 space-y-8 rounded-b-sm">
              
              {/* KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-white p-6 rounded-sm border border-stone-200 shadow-sm">
                  <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Total Students</p>
                  <p className="text-3xl font-black text-stone-900 mt-2">{totalStudents}</p>
                </div>
                <div className="bg-white p-6 rounded-sm border border-stone-200 shadow-sm">
                  <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Class Pass Rate</p>
                  <p className="text-3xl font-black text-emerald-600 mt-2">{passRate}%</p>
                </div>
                <div className="bg-[#fcf8f8] p-6 rounded-sm border border-[#b4483e]/30 shadow-sm">
                  <p className="text-[10px] font-bold text-[#b4483e] uppercase tracking-widest">Failed Students</p>
                  <p className="text-3xl font-black text-[#b4483e] mt-2">{failedStudents.length}</p>
                </div>
              </div>
              
              {/* Top Performers */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-sm border border-stone-200 shadow-sm overflow-hidden">
                  <div className="bg-[#fbf9fc] px-6 py-4 border-b border-[#dad3e3]">
                    <h3 className="font-bold text-stone-900 text-xs uppercase tracking-wide">Top 5 Performers</h3>
                  </div>
                  <ul className="divide-y divide-stone-100">
                    {topPerformers.map((student) => (
                      <li key={student.student.id} className="p-5 flex justify-between items-center hover:bg-stone-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <span className="w-7 h-7 flex items-center justify-center bg-white border border-[#dad3e3] text-[#6b4c9a] rounded-sm text-xs font-bold shadow-sm" title="Class Rank">
                            {student.rank}
                          </span>
                          <div>
                            <p className="font-bold text-stone-900 text-sm">{student.student.first_name} {student.student.last_name}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mt-0.5">Roll: {student.student.enrollment_id}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-stone-900 text-lg">{student.percentage}%</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

            </div>
          )}

          {activeTab === 'cumulative' && (
            <div className="rounded-b-sm overflow-hidden">
              <CumulativeSheet reportData={reportData} uniqueSubjects={uniqueSubjects} showGrading={showGrading} />
            </div>
          )}

          {activeTab === 'individual' && (
            <div className="rounded-b-sm overflow-hidden">
              <IndividualReportView 
                reportData={reportData} 
                examName={selectedExamName} 
                className={selectedClassName} 
                schoolName={schoolName}
                showGrading={showGrading}
              />
            </div>
          )}

        </div>
      )}
    </div>
  )
}