'use client'

import React, { useState, useMemo } from 'react'
import Dropdown from '@/components/ui/dropdown'
import { getDetailedReportData } from '@/app/actions/report-actions'

// ============================================================================
// 1. GLOBAL GRADING UTILITIES (OFFICIAL BD PRIMARY STANDARD)
// ============================================================================
const GRADE_SCALE = [
  { grade: 'ক', gpa: 4.00, min: 80, max: 100, remark: 'অতিউত্তম' },
  { grade: 'খ', gpa: 3.00, min: 60, max: 79, remark: 'উত্তম' },
  { grade: 'গ', gpa: 2.00, min: 40, max: 59, remark: 'সন্তোষজনক' },
  { grade: 'ঘ', gpa: 1.00, min: 0, max: 39, remark: 'সহায়তা প্রয়োজন' },
]

const getGradeInfo = (obtained: number, max: number) => {
  if (max === 0) return { grade: '-', gpa: 0.00, remark: '-' }
  const pct = Math.round((obtained / max) * 100)
  const band = GRADE_SCALE.find((g: any) => pct >= g.min)
  return band ?? GRADE_SCALE[GRADE_SCALE.length - 1]
}

const isSubjectFailed = (sub: any, showGrading: boolean) => {
  if (sub.isAbsent) return true
  if (showGrading && sub.maxTotal > 0) {
    const pct = Math.round((sub.totalObtained / sub.maxTotal) * 100)
    return pct < 40 // ঘ means fail
  }
  return sub.isFail
}

const hasStudentFailed = (subjectResults: any[], showGrading: boolean, dbHasFailed: boolean) => {
  if (showGrading) return subjectResults.some((sub: any) => isSubjectFailed(sub, showGrading))
  return dbHasFailed
}

const getOverallGPA = (subjectResults: any[]) => {
  let totalGPA = 0
  let hasFail = false
  let validSubjects = 0

  subjectResults.forEach((sub: any) => {
    if (sub.isAbsent) hasFail = true
    const info = getGradeInfo(sub.totalObtained, sub.maxTotal)
    if (info.grade === 'ঘ') hasFail = true
    totalGPA += info.gpa
    validSubjects++
  })

  if (hasFail || validSubjects === 0) return { gpa: '0.00', grade: 'ঘ', remark: 'সহায়তা প্রয়োজন' }
  const avg = totalGPA / validSubjects
  if (avg >= 3.50) return { gpa: avg.toFixed(2), grade: 'ক', remark: 'অতিউত্তম' }
  if (avg >= 2.50) return { gpa: avg.toFixed(2), grade: 'খ', remark: 'উত্তম' }
  if (avg >= 1.50) return { gpa: avg.toFixed(2), grade: 'গ', remark: 'সন্তোষজনক' }
  return { gpa: avg.toFixed(2), grade: 'ঘ', remark: 'সহায়তা প্রয়োজন' }
}

const toBengaliNumber = (num: number | string) => {
  if (num === null || num === undefined || num === '') return ''
  const englishToBengali: Record<string, string> = {
    '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', 
    '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
  }
  return String(num).replace(/[0-9]/g, (char: any) => englishToBengali[char] || char)
}

const toEnglishNumber = (str: string) => {
  if (!str) return ''
  const bengaliToEnglish: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', 
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
  }
  return String(str).replace(/[০-৯]/g, (char: any) => bengaliToEnglish[char] || char)
}

// ============================================================================
// 2. REUSABLE UI: INDIVIDUAL OFFICIAL REPORT CARD
// ============================================================================
export function IndividualReportView({ reportData, className, schoolData, showGrading, mode = 'single', activeSubjects = [] }: any) {
  const [selectedStudentId, setSelectedStudentId] = useState<string | number>('')
  const [showDetailedMatrix, setShowDetailedMatrix] = useState<boolean>(true)

  const studentOptions = reportData.map((d: any) => ({
    label: `${toBengaliNumber(d.student.enrollment_id)} - ${d.student.name_bangla || d.student.first_name}`,
    value: d.student.id
  }))

  const studentData = reportData.find((d: any) => d.student.id === selectedStudentId)
  const rank = studentData?.rank || '-'
  const overallGrade = studentData ? getOverallGPA(studentData.subjectResults || []) : { gpa: '0.00', grade: 'ঘ', remark: 'সহায়তা প্রয়োজন' }

  const sName = schoolData?.name || 'Primary School'
  const address = schoolData?.address || 'ঠিকানা পাওয়া যায়নি'
  const emisNo = schoolData?.emis_no || 'N/A'
  const ipemisNo = schoolData?.ipemis_no || 'N/A'

  let estText = ''
  if (schoolData?.established_date) {
    const year = new Date(schoolData.established_date).getFullYear()
    estText = ` ⋆ স্থাপিতঃ ${toBengaliNumber(year)} খ্রি.`
  }

  const RenderReportHeader = ({ isPrint = false }) => (
    <div className={`flex justify-between items-center border-b-[2px] border-black ${isPrint ? 'pb-3 mb-3' : 'pb-4 mb-4'} relative z-10`}>
      <div className={`bg-white rounded-none flex items-center justify-center shrink-0 overflow-hidden ${isPrint ? 'w-[70px] h-[70px]' : 'w-20 h-20'}`}>
        <img src="/icons/dpe.png" alt="DPE" className="w-full h-full object-contain p-1" />
      </div>
      <div className="text-center flex-1 px-4">
        <p className={`${isPrint ? 'text-[13px]' : 'text-[14px]'} font-bold text-black mb-1`}>গণপ্রজাতন্ত্রী বাংলাদেশ সরকার</p>
        <h1 className={`${isPrint ? 'text-[22px]' : 'text-2xl md:text-3xl'} font-black text-[#b4483e] print:text-black tracking-wide mb-1 leading-tight`}>{sName}</h1>
        <p className={`${isPrint ? 'text-[12px]' : 'text-[12px]'} font-bold text-stone-800`}>{address}{estText}</p>
        <p className={`${isPrint ? 'text-[11px]' : 'text-[11px]'} font-bold text-stone-800 mt-0.5`}>EMIS No. {emisNo} ⋆ IPEMIS Code {ipemisNo}</p>
      </div>
      <div className={`bg-white rounded-full flex items-center justify-center shrink-0 overflow-hidden ${isPrint ? 'w-[70px] h-[70px]' : 'w-20 h-20'}`}>
         <img src="/icons/gov.webp" alt="Govt" className="w-full h-full object-contain p-1" />
      </div>
    </div>
  )

  const RenderReportInfo = ({ isPrint = false }) => (
    <div className="relative z-10">
      <div className={`text-center ${isPrint ? 'mb-4' : 'mb-6'}`}>
        <h2 className={`${isPrint ? 'text-[18px]' : 'text-2xl'} font-black text-[#2e5c8a] print:text-black mb-1.5 tracking-wide`}>
          {mode === 'combined' ? 'বার্ষিক সমন্বিত মূল্যায়ন প্রতিবেদন' : 'শিখন অগ্রগতির প্রতিবেদন'}
        </h2>
        <p className={`${isPrint ? 'text-[14px]' : 'text-[16px]'} font-bold text-black`}>শ্রেণি: {className}; শিক্ষাবর্ষ ২০২৬ খ্রি:</p>
      </div>

      <div className={`flex border-[2px] border-black bg-white ${isPrint ? 'text-[14px] mb-4' : 'text-[16px] mb-6'} font-bold divide-x-[2px] divide-black`}>
        <div className="flex-grow p-2.5 flex items-center gap-2">
          <span>শিক্ষার্থীর নাম:</span>
          <span className="text-[#6b4c9a] print:text-black font-black">{studentData.student.name_bangla || `${studentData.student.first_name} ${studentData.student.last_name}`}</span>
        </div>
        <div className={`${isPrint ? 'w-28' : 'w-32'} shrink-0 p-2.5 flex items-center gap-2 justify-center bg-white`}>
          <span>রোল:</span>
          <span className="text-[#b4483e] print:text-black font-black text-lg">{toBengaliNumber(studentData.student.enrollment_id)}</span>
        </div>
      </div>
    </div>
  )

  const RenderReportTable = ({ isPrint = false }) => (
    <div className="relative z-10">
      {mode === 'combined' && activeSubjects.length > 0 && showDetailedMatrix ? (
        <>
          <div className="text-center mb-3"><h3 className={`${isPrint ? 'text-[16px]' : 'text-2xl'} font-black tracking-wide text-black mb-2`}>বিষয়ভিত্তিক বিস্তারিত তথ্য</h3></div>
          <table className={`w-full border-collapse border-[2px] border-black text-center bg-white ${isPrint ? 'mb-5 text-[11px]' : 'mb-8 text-[13px]'}`}>
            <thead className="bg-stone-100 print:bg-transparent font-bold text-black">
              <tr>
                <th rowSpan={2} className={`border-[2px] border-black p-1.5 w-1/4 ${isPrint ? 'text-[13px]' : 'text-[15px]'}`}>বিষয়</th>
                {studentData.breakdowns.map((b: any) => (
                  <th key={b.id} colSpan={2} className="border-[2px] border-black p-1.5">{b.name}</th>
                ))}
                <th rowSpan={2} className={`border-[2px] border-black p-1.5 ${isPrint ? 'text-[13px]' : 'text-[15px]'}`}>মোট অর্জিত নম্বর</th>
              </tr>
              <tr>
                {studentData.breakdowns.map((b: any) => (
                  <React.Fragment key={b.id + '-sub'}>
                    <th className="border-[2px] border-black p-1">{b.isExam ? 'প্রাপ্ত নম্বর' : 'মান'}</th>
                    <th className="border-[2px] border-black p-1">প্রাপ্ত নম্বরের %</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody className="font-bold text-stone-900 print:text-black">
              {activeSubjects.map((sub: any, idx: number) => (
                <tr key={sub.id}>
                  <td className={`border-[2px] border-black p-1.5 text-left pl-3 ${isPrint ? 'text-[13px]' : 'text-[14px]'}`}>{sub.name}</td>
                  {studentData.breakdowns.map((b: any) => {
                    if (b.isExam) {
                      const raw = studentData.subjectMarks?.[b.id]?.[sub.id]
                      return (
                        <React.Fragment key={b.id}>
                          <td className={`border-[2px] border-black p-1.5 ${isPrint ? 'text-[12px]' : 'text-[14px]'}`}>{raw === 'ABS' ? '-' : toBengaliNumber(raw)}</td>
                          {idx === 0 && (
                            <td rowSpan={activeSubjects.length + 1} className={`border-[2px] border-black p-1.5 align-middle ${isPrint ? 'text-[15px]' : 'text-lg'}`}>
                              {toBengaliNumber(b.points)}
                            </td>
                          )}
                        </React.Fragment>
                      )
                    } else {
                      return (
                        <React.Fragment key={b.id}>
                          {idx === 0 ? (
                            <td rowSpan={activeSubjects.length + 1} className={`border-[2px] border-black p-1.5 align-middle ${isPrint ? 'text-[12px]' : 'text-[14px]'}`}>
                              {toBengaliNumber(b.raw)}
                            </td>
                          ) : null}
                          {idx === 0 && (
                            <td rowSpan={activeSubjects.length + 1} className={`border-[2px] border-black p-1.5 align-middle ${isPrint ? 'text-[15px]' : 'text-lg'}`}>
                              {toBengaliNumber(b.points)}
                            </td>
                          )}
                        </React.Fragment>
                      )
                    }
                  })}
                  {idx === 0 && (
                    <td rowSpan={activeSubjects.length + 1} className={`border-[2px] border-black p-1.5 align-middle font-black text-[#6b4c9a] print:text-black ${isPrint ? 'text-[17px]' : 'text-xl'}`}>
                      {toBengaliNumber(studentData.grandTotalObtained)}
                    </td>
                  )}
                </tr>
              ))}
              {/* THE NEW 'MOT' ROW THAT SUMS RAW POINTS VERTICALLY */}
              <tr className="bg-stone-50 print:bg-transparent">
                <td className={`border-[2px] border-black p-1.5 text-right pr-3 font-black ${isPrint ? 'text-[13px]' : 'text-[14px]'}`}>মোট</td>
                {studentData.breakdowns.map((b: any) => {
                  if (b.isExam) {
                    let sumRaw = 0;
                    activeSubjects.forEach((sub: any) => {
                      const raw = studentData.subjectMarks?.[b.id]?.[sub.id];
                      if (raw !== 'ABS') sumRaw += Number(raw) || 0;
                    });
                    return (
                      <td key={'tot-' + b.id} className={`border-[2px] border-black p-1.5 font-black ${isPrint ? 'text-[13px]' : 'text-[14px]'}`}>
                        {toBengaliNumber(sumRaw)}
                      </td>
                    )
                  }
                  return null; // Custom fields use rowSpan so they are skipped in this bottom row rendering
                })}
              </tr>
            </tbody>
          </table>
        </>
      ) : (
        <>
          <div className="text-center mb-3"><h3 className={`${isPrint ? 'text-[16px]' : 'text-2xl'} font-black tracking-wide text-black mb-2`}>মূল্যায়ন খাতসমূহ</h3></div>
          <table className={`w-full border-collapse border-[2px] border-black text-center bg-white ${isPrint ? 'mb-5' : 'mb-8'}`}>
            <thead className={`bg-stone-100 print:bg-transparent font-bold text-black ${isPrint ? 'text-[12px]' : 'text-[14px]'}`}>
              {mode === 'combined' ? (
                <tr>
                  <th className="border-[2px] border-black p-2.5 text-left pl-3 w-1/3">মূল্যায়ন খাত (Metric)</th>
                  <th className="border-[2px] border-black p-2.5">পূর্ণমান (Max)</th>
                  <th className="border-[2px] border-black p-2.5">প্রাপ্ত নম্বর (Raw)</th>
                  <th className="border-[2px] border-black p-2.5">ওয়েট (Wt. %)</th>
                  <th className="border-[2px] border-black p-2.5">প্রাপ্ত পয়েন্ট (Points)</th>
                </tr>
              ) : (
                <tr>
                  <th className="border-[2px] border-black p-2.5 text-left pl-3 w-1/3">বিষয়</th>
                  <th className="border-[2px] border-black p-2.5">পূর্ণমান</th>
                  <th className="border-[2px] border-black p-2.5">প্রাপ্ত নম্বর</th>
                  <th className="border-[2px] border-black p-2.5">অর্জিত গ্রেড</th>
                  <th className="border-[2px] border-black p-2.5">অবস্থান</th>
                </tr>
              )}
            </thead>
            <tbody className={`font-bold text-stone-900 print:text-black bg-white ${isPrint ? 'text-[13px]' : 'text-[15px]'}`}>
              {(mode === 'combined' ? studentData.breakdowns : studentData.subjectResults).map((sub: any, i: number) => {
                const grade = mode === 'single' ? getGradeInfo(sub.totalObtained, sub.maxTotal) : null
                return (
                  <tr key={i}>
                    <td className="border-[2px] border-black p-2.5 text-left pl-3 font-black">{sub.name || sub.subjectName}</td>
                    <td className="border-[2px] border-black p-2.5">{toBengaliNumber(sub.max || sub.maxTotal)}</td>
                    <td className={`border-[2px] border-black p-2.5 ${isPrint ? 'text-[14px]' : 'text-lg'}`}>{sub.raw === 'ABS' || sub.isAbsent ? 'অনুপস্থিত' : toBengaliNumber(sub.raw || sub.totalObtained)}</td>
                    {mode === 'combined' ? (
                      <>
                        <td className="border-[2px] border-black p-2.5">{toBengaliNumber(sub.weight)}%</td>
                        <td className={`border-[2px] border-black p-2.5 text-[#6b4c9a] print:text-black font-black ${isPrint ? 'text-[15px]' : 'text-lg'}`}>{toBengaliNumber(sub.points)}</td>
                      </>
                    ) : (
                      <>
                        <td className={`border-[2px] border-black p-2.5 font-black ${isPrint ? 'text-[15px]' : 'text-lg'}`}>{sub.isAbsent ? '-' : grade?.grade}</td>
                        <td className="border-[2px] border-black p-2.5">{sub.isAbsent ? '-' : grade?.remark}</td>
                      </>
                    )}
                  </tr>
                )
              })}
              <tr className="bg-stone-50 print:bg-white">
                <td colSpan={mode === 'combined' ? 3 : 1} className="border-[2px] border-black p-2.5 text-right pr-3 font-black text-[15px]">সর্বমোট (Total)</td>
                <td className="border-[2px] border-black p-2.5 font-black text-[15px]">{mode === 'combined' ? '১০০%' : toBengaliNumber(studentData.subjectResults.reduce((s:number, sub:any) => s + (sub.maxTotal || 0), 0))}</td>
                <td className={`border-[2px] border-black p-2.5 font-black text-[#6b4c9a] print:text-black ${isPrint ? 'text-[17px]' : 'text-xl'}`}>{toBengaliNumber(studentData.grandTotalObtained)}</td>
                {mode === 'single' && <td colSpan={2} className="border-[2px] border-black p-2.5"></td>}
              </tr>
            </tbody>
          </table>
        </>
      )}
    </div>
  )

  const RenderReportFooter = ({ isPrint = false }) => (
    <div className="relative z-10 bg-white/90">
      <div className={`flex justify-between gap-4 ${isPrint ? 'mb-4' : 'mb-24 flex-col md:flex-row md:gap-6'}`}>
        <div className={`w-full ${isPrint ? 'w-[48%]' : 'md:w-[48%]'}`}>
          <table className={`w-full border-collapse border-[2px] border-black text-center bg-white font-bold ${isPrint ? 'text-[11px]' : 'text-[13px]'}`}>
            <tbody>
              {GRADE_SCALE.map((g, idx) => (
                <tr key={idx}>
                  <td className="border-[2px] border-black p-1.5">{toBengaliNumber(g.min)} - {toBengaliNumber(g.max)}</td>
                  <td className="border-[2px] border-black p-1.5 font-black text-[13px]">{g.grade}</td>
                  <td className="border-[2px] border-black p-1.5">{g.remark}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={`w-full ${isPrint ? 'w-[48%]' : 'md:w-[48%]'}`}>
          <table className={`w-full border-collapse border-[2px] border-black bg-white text-center font-bold h-full ${isPrint ? 'text-[11px]' : 'text-[13px]'}`}>
            <thead>
              <tr><th colSpan={3} className={`border-[2px] border-black p-1.5 bg-stone-100 print:bg-transparent ${isPrint ? 'text-[13px]' : 'text-[14px]'}`}>শিক্ষাবর্ষ শেষে সার্বিক অর্জন</th></tr>
              <tr>
                <th className="border-[2px] border-black p-1.5">{mode === 'combined' ? 'প্রাপ্ত জিপিএ (GPA)' : 'শতকরা'}</th>
                <th className="border-[2px] border-black p-1.5">অবস্থান</th>
                <th className="border-[2px] border-black p-1.5">মেধাক্রম</th>
              </tr>
            </thead>
            <tbody className={`${isPrint ? 'text-[13px]' : 'text-[15px]'}`}>
              <tr>
                <td className={`border-[2px] border-black p-2 font-black ${isPrint ? 'text-[15px]' : 'text-lg'}`}>{mode === 'combined' ? toBengaliNumber(studentData.gpa || overallGrade.gpa) : `${toBengaliNumber(studentData.percentage)}%`}</td>
                <td className="border-[2px] border-black p-2 font-black text-[#2e5c8a] print:text-black">{studentData.remark || overallGrade.remark}</td>
                <td className="border-[2px] border-black p-2 font-black text-[#b4483e] print:text-black">{toBengaliNumber(rank)} তম</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  return (
    <div className="bg-stone-100 flex flex-col items-center font-sans min-h-[600px] print:bg-white print:min-h-0 relative">
      <div className="print:hidden w-full flex flex-col items-center p-6 pb-20">
        <div className="w-full max-w-4xl bg-white p-6 border border-stone-200 shadow-sm flex flex-col md:flex-row gap-5 items-start md:items-end justify-between rounded-sm mb-6 relative z-10">
          <div className="w-full md:w-96">
            <label className="flex items-end flex-wrap gap-1.5 leading-none mb-2.5">
              <span className="text-[16px] font-bold text-stone-800">শিক্ষার্থী নির্বাচন করুন</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-600 mb-0.5">/ Select Student</span>
            </label>
            <Dropdown options={studentOptions} value={selectedStudentId} onChange={setSelectedStudentId} placeholder="খুঁজুন / Search Student" hasSearch={true} />
          </div>
          <div className="flex gap-4 items-center w-full md:w-auto">
            {mode === 'combined' && (
              <label className="flex items-center gap-2 cursor-pointer bg-stone-50 px-4 py-3 rounded-sm border border-stone-200">
                <input type="checkbox" checked={showDetailedMatrix} onChange={(e) => setShowDetailedMatrix(e.target.checked)} className="w-4 h-4 text-[#6b4c9a] accent-[#6b4c9a]" />
                <span className="text-[13px] font-bold text-stone-800">বিস্তারিত ম্যাট্রিক্স</span>
              </label>
            )}
            <button onClick={() => window.print()} disabled={!selectedStudentId} className="w-full md:w-auto bg-[#6b4c9a] text-white px-8 py-3.5 rounded-sm hover:bg-[#5a3f82] disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center gap-2">
              <span className="text-[14px] font-bold">প্রিন্ট কপি</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80 mt-0.5">/ Print</span>
            </button>
          </div>
        </div>

        <div className="w-full flex justify-center">
          {studentData ? (
            <div className="w-full max-w-[800px] bg-white shadow-xl p-1.5 border border-stone-200 rounded-sm">
              <div className="border-[3px] border-black p-1 relative overflow-hidden">
                <div className="border border-black p-6 md:p-8 relative z-10">
                  <RenderReportHeader isPrint={false} />
                  <RenderReportInfo isPrint={false} />
                  <RenderReportTable isPrint={false} />
                  <RenderReportFooter isPrint={false} />
                  <div className="flex justify-between items-end px-6 mt-16 font-bold text-[14px]">
                    <div className="text-center"><div className="w-48 border-b-[2px] border-black mb-1.5"></div><p>শ্রেণি শিক্ষকের স্বাক্ষর</p></div>
                    <div className="text-center"><div className="w-48 border-b-[2px] border-black mb-1.5"></div><p>প্রধান শিক্ষকের স্বাক্ষর</p></div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-24 text-center w-full max-w-4xl bg-white border border-stone-200 shadow-sm rounded-sm flex flex-col items-center justify-center gap-2">
              <span className="text-[18px] font-bold text-stone-500">অনুগ্রহ করে একজন শিক্ষার্থী নির্বাচন করুন</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">/ Please select a student</span>
            </div>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4 portrait; margin: 0 !important; }
          html, body { 
            width: 100% !important; 
            height: 100% !important; 
            margin: 0 !important; 
            padding: 0 !important;
            background: white !important; 
            overflow: hidden !important; 
          }
          body * { visibility: hidden; }
          #official-report-container, #official-report-container * { visibility: visible; }
          #official-report-container {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            margin: auto !important;
            width: 210mm !important;
            height: 297mm !important;
            box-sizing: border-box !important;
          }
        }
      `}} />

      {studentData && (
        <div id="official-report-container" className="hidden print:flex flex-col w-[210mm] h-[297mm] p-[10mm] box-border text-black bg-white font-sans leading-tight relative overflow-hidden">
          {/* Z-50 AND MIX-BLEND-MULTIPLY GUARANTEES VISIBILITY OVER TABLES */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50 mix-blend-multiply">
             <img src="/icons/dpe.png" alt="Watermark" className="w-[60%] h-auto opacity-[0.08] grayscale" />
          </div>

          <div className="border-[3px] border-black p-1 flex-grow flex flex-col h-full relative z-10 bg-transparent">
            <div className="border border-black p-5 flex-grow flex flex-col relative h-full bg-transparent">
              <RenderReportHeader isPrint={true} />
              <RenderReportInfo isPrint={true} />
              <RenderReportTable isPrint={true} />
              <RenderReportFooter isPrint={true} />
              
              <div className="mt-auto flex justify-between items-end px-4 pt-4 font-bold text-[13px] relative z-10">
                <div className="text-center"><div className="w-44 border-b-[2px] border-black mb-1.5"></div><p>শ্রেণি শিক্ষকের স্বাক্ষর</p></div>
                <div className="text-center"><div className="w-44 border-b-[2px] border-black mb-1.5"></div><p>প্রধান শিক্ষকের স্বাক্ষর</p></div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ============================================================================
// 3. REUSABLE UI: CUMULATIVE MERIT SHEET
// ============================================================================
export function CumulativeSheet({ reportData, uniqueSubjects, showGrading, mode = 'single' }: any) {
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  const subjectConfigs = useMemo(() => {
    const configs: Record<string, { breakdowns: any[] }> = {}
    reportData.forEach((r: any) => {
      r.subjectResults?.forEach((sr: any) => {
         if (!configs[sr.subjectId] && sr.breakdownsConfig?.length > 0) configs[sr.subjectId] = { breakdowns: sr.breakdownsConfig }
      })
    })
    return configs;
  }, [reportData])

  let processedData = reportData.filter((d: any) => 
    `${d.student.first_name} ${d.student.last_name} ${d.student.enrollment_id}`.toLowerCase().includes(searchTerm.toLowerCase())
  )
  processedData.sort((a:any, b:any) => a.student.enrollment_id.localeCompare(b.student.enrollment_id, undefined, { numeric: true }))

  const totalPages = Math.ceil(processedData.length / itemsPerPage)
  const paginatedData = processedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  return (
    <div className="bg-white font-sans overflow-hidden rounded-b-sm border-t border-stone-200">

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
           #cumulative-sheet-wrapper { display: none !important; }
        }
      `}} />

      <div id="cumulative-sheet-wrapper">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#fbf9fc] p-6 border-b border-[#dad3e3] print:hidden">
          <div className="w-full sm:w-72">
            <label className="flex items-end flex-wrap gap-1.5 leading-none mb-2.5">
              <span className="text-[16px] font-bold text-stone-800">সার্চ করুন</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-600 mb-0.5">/ Search</span>
            </label>
            <input type="text" placeholder="নাম বা রোল..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full p-2.5 bg-white border border-stone-300 rounded-sm text-[13px] font-bold text-stone-900 focus:outline-none focus:border-[#6b4c9a] shadow-sm" />
          </div>
          <button onClick={() => alert("Printing Cumulative Sheet requires horizontal layout. Implement specific landscape print CSS if needed.")} className="w-full sm:w-auto bg-[#6b4c9a] text-white px-8 py-3.5 rounded-sm hover:bg-[#5a3f82] transition-colors shadow-sm flex items-center justify-center gap-2">
            <span className="text-[14px] font-bold">শীট প্রিন্ট করুন</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 mt-0.5">/ Print Sheet</span>
          </button>
        </div>

        <div className="overflow-x-auto min-h-[500px]">
          <table className="w-full text-left border-collapse min-w-max text-[13px]">
            <thead>
              <tr className="bg-stone-100 border-b border-stone-300">
                <th className="p-3.5 text-center border-r border-stone-200">
                  <span className="text-[14px] font-bold text-stone-800 block">মেধাক্রম</span>
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-600 mt-1 block">Rank</span>
                </th>
                <th className="p-3.5 text-center border-r border-stone-200">
                  <span className="text-[14px] font-bold text-stone-800 block">রোল</span>
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-600 mt-1 block">Roll</span>
                </th>
                <th className="p-3.5 border-r border-stone-300">
                  <span className="text-[14px] font-bold text-stone-800 block">শিক্ষার্থীর নাম</span>
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-600 mt-1 block">Student Name</span>
                </th>

                {uniqueSubjects.map((sub: any, index: number) => {
                  const breaks = subjectConfigs[sub.id]?.breakdowns || []
                  return (
                    <th key={index} colSpan={breaks.length > 0 && mode === 'single' ? breaks.length + 1 : 1} className="p-3.5 border-r border-stone-200 text-center bg-[#fbf9fc]">
                      <span className="text-[14px] font-bold text-[#6b4c9a] block">{sub.name}</span>
                      {mode === 'combined' ? (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#6b4c9a]/70 mt-1 block">Weight: {toBengaliNumber(sub.weight)}%</span>
                      ) : (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#6b4c9a]/70 mt-1 block">Max: {toBengaliNumber(sub.max)}</span>
                      )}
                    </th>
                  )
                })}
                <th className="p-3.5 text-center border-r border-stone-200">
                  <span className="text-[14px] font-bold text-stone-800 block">মোট {mode === 'combined' ? '(১০০)' : ''}</span>
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-600 mt-1 block">Total</span>
                </th>
                {showGrading && (
                  <th className="p-3.5 text-center border-r border-stone-200 bg-[#fbf9fc]">
                    <span className="text-[14px] font-bold text-[#6b4c9a] block">জিপিএ</span>
                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b4c9a]/70 mt-1 block">GPA</span>
                  </th>
                )}
                <th className="p-3.5 text-center border-r border-stone-200">
                  <span className="text-[14px] font-bold text-stone-800 block">শতকরা</span>
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-600 mt-1 block">Percentage</span>
                </th>
                <th className="p-3.5 text-center">
                  <span className="text-[14px] font-bold text-stone-800 block">স্ট্যাটাস</span>
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-600 mt-1 block">Status</span>
                </th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-stone-200">
              {paginatedData.map((row: any) => {
                const overallGrade = showGrading && mode === 'single' ? getOverallGPA(row.subjectResults) : { gpa: row.gpa, grade: row.grade }
                const studentFailed = mode === 'single' ? hasStudentFailed(row.subjectResults, showGrading, row.hasFailedAnySubject) : row.grade === 'ঘ'

                return (
                  <tr key={row.student.id} className="hover:bg-stone-50 transition-colors bg-white">
                    <td className="p-3.5 font-black text-[15px] text-stone-900 border-r border-stone-200 text-center bg-stone-50/50">{toBengaliNumber(row.rank)}</td>
                    <td className="p-3.5 font-bold text-[15px] text-[#b4483e] border-r border-stone-200 text-center">{toBengaliNumber(row.student.enrollment_id)}</td>
                    <td className="p-3.5 font-bold text-[14px] text-stone-900 border-r border-stone-300">{row.student.name_bangla || row.student.first_name}</td>

                    {uniqueSubjects.map((sub: any, i: number) => {
                      if (mode === 'combined') {
                        const breakdown = row.breakdowns.find((b: any) => b.id === sub.id)
                        if (!breakdown) return <td key={i} className="p-3.5 text-center border-r border-stone-100">-</td>
                        return (
                          <td key={i} className="p-3.5 text-center border-r border-stone-100">
                            <div className="font-black text-[16px] text-stone-800 leading-none">{toBengaliNumber(breakdown.points)}</div>
                            <div className="text-[9px] text-stone-500 mt-1 font-bold uppercase tracking-wider">Raw: <span className={breakdown.raw === 'ABS' ? 'text-[#b4483e]' : ''}>{breakdown.raw === 'ABS' ? 'ABS' : toBengaliNumber(breakdown.raw)}</span>/{toBengaliNumber(breakdown.max)}</div>
                          </td>
                        )
                      }

                      const sr = row.subjectResults?.find((s: any) => s.subjectId === sub.id)
                      const failStatus = sr ? isSubjectFailed(sr, showGrading) : true
                      if (!sr || sr.isAbsent) return <td key={i} className="p-3.5 text-center border-r border-stone-200 font-bold text-[#b4483e] bg-[#fcf8f8]">ABS</td>
                      return (
                        <td key={i} className={`p-3.5 text-center border-r border-stone-200 font-black text-[15px] ${failStatus ? 'text-[#b4483e] bg-[#fcf8f8]' : 'text-stone-900'}`}>{toBengaliNumber(sr.totalObtained)}</td>
                      )
                    })}

                    <td className="p-3.5 font-black text-[18px] text-[#6b4c9a] text-center border-r border-stone-200 bg-stone-50">{toBengaliNumber(row.grandTotalObtained)}</td>
                    
                    {showGrading && overallGrade && (
                      <td className={`p-3.5 font-black text-[18px] text-center border-r border-stone-200 ${overallGrade.grade === 'ঘ' ? 'text-[#b4483e] bg-[#fcf8f8]' : 'text-[#6b4c9a] bg-[#fbf9fc]'}`}>
                        {toBengaliNumber(overallGrade.gpa)} <span className="text-[11px] block font-bold tracking-widest">{overallGrade.grade}</span>
                      </td>
                    )}
                    
                    <td className="p-3.5 font-bold text-[14px] text-stone-700 text-center border-r border-stone-200 bg-stone-50/50">{toBengaliNumber(row.percentage)}%</td>
                    <td className="p-3.5 text-center font-bold">
                      {studentFailed ? (
                        <span className="text-[#b4483e] bg-[#fcf8f8] border border-[#b4483e]/20 px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-widest block">FAIL</span>
                      ) : (
                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-widest block">PASS</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            
            <tfoot className="bg-stone-200/50 font-black text-stone-900 border-t-2 border-stone-300 print:bg-stone-100">
              <tr>
                <td colSpan={3} className="p-3.5 text-right border-r border-stone-300 text-[14px]">সর্বমোট (Total):</td>
                {uniqueSubjects.map((sub: any, index: number) => {
                  let sum = 0;
                  let rawSum = 0;
                  processedData.forEach((row: any) => {
                    if (mode === 'combined') {
                      const breakdown = row.breakdowns.find((b: any) => b.id === sub.id);
                      if (breakdown) {
                        sum += Number(breakdown.points) || 0;
                        if (breakdown.raw !== 'ABS') rawSum += Number(breakdown.raw) || 0;
                      }
                    } else {
                      const sr = row.subjectResults?.find((s: any) => s.subjectId === sub.id);
                      if (sr && !sr.isAbsent) {
                        sum += Number(sr.totalObtained) || 0;
                      }
                    }
                  });

                  return (
                    <td key={index} className="p-3.5 text-center border-r border-stone-300">
                      <div className="font-black text-[16px] text-stone-900">{toBengaliNumber(sum.toFixed(2).replace(/\.00$/, ''))}</div>
                      {mode === 'combined' && (
                        <div className="text-[10px] text-stone-600 mt-1 uppercase tracking-wider">
                          Raw: {toBengaliNumber(rawSum.toFixed(2).replace(/\.00$/, ''))}
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="p-3.5 text-center border-r border-stone-300 text-[18px] text-[#6b4c9a]">
                  {toBengaliNumber(processedData.reduce((s: number, row: any) => s + (Number(row.grandTotalObtained) || 0), 0).toFixed(2).replace(/\.00$/, ''))}
                </td>
                {showGrading && <td className="p-3.5 border-r border-stone-300"></td>}
                <td className="p-3.5 text-center border-r border-stone-300 text-[14px]">
                  {toBengaliNumber((processedData.reduce((s: number, row: any) => s + (Number(row.percentage) || 0), 0) / (processedData.length || 1)).toFixed(2))}%
                </td>
                <td className="p-3.5"></td>
              </tr>
            </tfoot>
          </table>
        </div>
        
        {totalPages > 1 && (
          <div className="flex justify-between items-center bg-[#fbf9fc] p-5 border-t border-[#dad3e3] print:hidden">
            <p className="text-[11px] text-[#6b4c9a] font-bold uppercase tracking-widest">Page {currentPage} of {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-5 py-2.5 border border-stone-300 bg-white text-stone-800 disabled:opacity-50 text-[10px] font-bold uppercase hover:bg-stone-50 shadow-sm transition-colors rounded-sm">Prev</button>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-5 py-2.5 border border-stone-300 bg-white text-stone-800 disabled:opacity-50 text-[10px] font-bold uppercase hover:bg-stone-50 shadow-sm transition-colors rounded-sm">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// 4. ENGINE 1: SINGLE EXAM REPORT
// ============================================================================
function SingleExamEngine({ exams, classes, schoolData }: any) {
  const [selectedClassId, setSelectedClassId] = useState<string | number>('')
  const [selectedExamId, setSelectedExamId] = useState<string | number>('')
  const [isLoading, setIsLoading] = useState(false)
  const [reportData, setReportData] = useState<any[] | null>(null)
  const [activeTab, setActiveTab] = useState<'analytics' | 'cumulative' | 'individual'>('analytics')
  const [showGrading, setShowGrading] = useState(true)

  const classOptions = classes.map((cls: any) => ({ label: cls.name, value: cls.id }))
  const classExams = exams.filter((e: any) => String(e.class_id) === String(selectedClassId))
  const examOptions = classExams.map((ex: any) => ({ label: ex.name, value: ex.id }))

  const handleGenerateReport = async () => {
    if (!selectedExamId || !selectedClassId) return
    setIsLoading(true)
    try {
      const data = await getDetailedReportData(String(selectedExamId), String(selectedClassId))
      setReportData(data)
    } catch (error: any) { alert(`Error generating report: ${error.message}`) } 
    finally { setIsLoading(false) }
  }

  const selectedClassName = classes.find((c: any) => String(c.id) === String(selectedClassId))?.name || ''
  const totalStudents = reportData?.length || 0
  const failedStudents = reportData?.filter((d: any) => hasStudentFailed(d.subjectResults, showGrading, d.hasFailedAnySubject)) || []
  const passRate = totalStudents > 0 ? (((totalStudents - failedStudents.length) / totalStudents) * 100).toFixed(1) : 0

  const uniqueSubjects = reportData && reportData.length > 0 ? reportData[0].subjectResults.map((sr: any) => ({ id: sr.subjectId, name: sr.subjectName, max: sr.maxTotal })) : []

  return (
    <div className="bg-white rounded-sm shadow-sm border border-stone-200 flex flex-col font-sans min-h-[600px]">
      <div className="bg-[#fbf9fc] p-6 md:p-8 border-b border-[#dad3e3] rounded-t-sm flex flex-col lg:flex-row gap-6 items-start lg:items-end print:hidden relative z-50">
        
        <div className="w-full lg:w-72 relative z-50">
          <label className="flex items-end flex-wrap gap-1.5 leading-none mb-2.5">
            <span className="text-[16px] font-bold text-stone-800">১. শ্রেণি নির্বাচন করুন</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-600 mb-0.5">/ 1. Select Class</span>
          </label>
          <Dropdown options={classOptions} value={selectedClassId} onChange={(val) => { setSelectedClassId(val); setSelectedExamId(''); setReportData(null) }} placeholder="-- শ্রেণি --" hasSearch={true} />
        </div>
        
        <div className="w-full lg:w-72 relative z-40">
          <label className="flex items-end flex-wrap gap-1.5 leading-none mb-2.5">
            <span className="text-[16px] font-bold text-stone-800">২. পরীক্ষা নির্বাচন করুন</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-600 mb-0.5">/ 2. Select Exam</span>
          </label>
          <Dropdown options={examOptions} value={selectedExamId} onChange={(val) => { setSelectedExamId(val); setReportData(null) }} disabled={!selectedClassId} placeholder="-- পরীক্ষা --" hasSearch={true} />
        </div>
        
        <div className="flex-grow flex flex-col sm:flex-row items-start sm:items-center justify-end gap-6 w-full lg:w-auto pt-2 lg:pt-0">
          <button onClick={handleGenerateReport} disabled={!selectedExamId || !selectedClassId || isLoading} className="w-full sm:w-auto bg-[#6b4c9a] text-white px-10 py-3.5 rounded-sm shadow-lg hover:bg-[#5a3f82] disabled:opacity-50 transition-colors shrink-0 flex items-center justify-center gap-2">
            {isLoading ? (
              <>
                <span className="text-[15px] font-bold">প্রসেস হচ্ছে...</span>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 mt-0.5">/ Crunching...</span>
              </>
            ) : (
              <>
                <span className="text-[15px] font-bold">রিপোর্ট তৈরি করুন</span>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 mt-0.5">/ Generate Engine</span>
              </>
            )}
          </button>
        </div>
      </div>

      {!reportData ? (
        <div className="flex flex-col items-center justify-center py-32 bg-stone-50 rounded-b-sm print:hidden">
          <span className="text-[18px] font-bold text-stone-500 leading-none">শ্রেণি ও পরীক্ষা নির্বাচন করে রিপোর্ট তৈরি করুন</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 mt-2.5 leading-none">/ Select class and exam to generate</span>
        </div>
      ) : reportData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 bg-[#fcf8f8] rounded-b-sm print:hidden">
          <span className="text-[18px] font-bold text-[#b4483e] leading-none">এই পরীক্ষার কোনো ডেটা নেই</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#b4483e]/70 mt-2.5 leading-none">/ No Data Found</span>
        </div>
      ) : (
        <div className="rounded-b-sm bg-white relative z-10 flex flex-col flex-grow">
          <div className="flex border-b border-stone-200 px-6 md:px-8 pt-2 gap-8 print:hidden overflow-x-auto custom-scrollbar bg-white">
            {[
              { id: 'analytics', bn: 'ক্লাস অ্যানালিটিক্স', en: 'Class Analytics' },
              { id: 'cumulative', bn: 'সম্মিলিত ফলাফল', en: 'Cumulative Sheet' },
              { id: 'individual', bn: 'রিপোর্ট কার্ড', en: 'Report Cards' }
            ].map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`pb-3.5 pt-4 border-b-[3px] transition-colors flex items-baseline gap-1.5 whitespace-nowrap ${activeTab === tab.id ? 'border-[#6b4c9a] text-[#6b4c9a]' : 'border-transparent text-stone-500 hover:text-stone-800'}`}>
                <span className={`text-[14px] font-bold ${activeTab === tab.id ? 'text-[#6b4c9a]' : 'text-stone-700'}`}>{tab.bn}</span>
                <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${activeTab === tab.id ? 'text-[#6b4c9a]/80' : 'text-stone-400'}`}>/ {tab.en}</span>
              </button>
            ))}
          </div>

          <div className="flex-grow flex flex-col">
            {activeTab === 'analytics' && (
              <div className="p-6 md:p-8 bg-stone-50 rounded-b-sm flex-grow">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-8 rounded-sm border border-stone-200 shadow-sm flex flex-col justify-center hover:border-[#6b4c9a]/50 transition-colors">
                    <div className="flex items-end flex-wrap gap-2 mb-3 leading-none">
                      <span className="text-[18px] font-bold text-stone-800">মোট শিক্ষার্থী</span>
                      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-stone-600 mb-0.5">/ Total Students</span>
                    </div>
                    <p className="text-6xl font-black text-stone-900 mt-2">{toBengaliNumber(totalStudents)}</p>
                  </div>
                  <div className="bg-white p-8 rounded-sm border border-stone-200 shadow-sm flex flex-col justify-center hover:border-emerald-600/50 transition-colors">
                    <div className="flex items-end flex-wrap gap-2 mb-3 leading-none">
                      <span className="text-[18px] font-bold text-stone-800">পাসের হার</span>
                      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-stone-600 mb-0.5">/ Pass Rate</span>
                    </div>
                    <p className="text-6xl font-black text-emerald-600 mt-2">{toBengaliNumber(passRate)}%</p>
                  </div>
                  <div className="bg-[#fcf8f8] p-8 rounded-sm border border-[#b4483e]/30 shadow-sm flex flex-col justify-center">
                    <div className="flex items-end flex-wrap gap-2 mb-3 leading-none">
                      <span className="text-[18px] font-bold text-[#b4483e]">অকৃতকার্য শিক্ষার্থী</span>
                      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#b4483e]/80 mb-0.5">/ Failed</span>
                    </div>
                    <p className="text-6xl font-black text-[#b4483e] mt-2">{toBengaliNumber(failedStudents.length)}</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'cumulative' && <CumulativeSheet reportData={reportData} uniqueSubjects={uniqueSubjects} showGrading={showGrading} mode="single" />}
            {activeTab === 'individual' && <IndividualReportView reportData={reportData} className={selectedClassName} schoolData={schoolData} showGrading={showGrading} mode="single" />}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// 5. ENGINE 2: COMBINED ANNUAL LEDGER
// ============================================================================
function CombinedReportsEngine({ classes, exams, students, schoolData, subjects, examConfigs, fetchMarksForExams }: any) {
  const [step, setStep] = useState<number>(1)
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [isFetchingMarks, setIsFetchingMarks] = useState<boolean>(false)
  
  const [selectedClassId, setSelectedClassId] = useState<string | number>('')
  const [selectedExams, setSelectedExams] = useState<{ examId: string; maxMark: string; weight: string }[]>([])
  
  const [rawMarksData, setRawMarksData] = useState<any[]>([])
  const [missingStats, setMissingStats] = useState<{examName: string; missing: number}[]>([])
  
  const [customFields, setCustomFields] = useState<{ id: string; name: string; maxMark: string; weight: string }[]>([])
  const [customMarks, setCustomMarks] = useState<Record<string, Record<string, number>>>({})
  const [customFieldSearch, setCustomFieldSearch] = useState<string>('')
  
  const [reportData, setReportData] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'analytics' | 'cumulative' | 'individual'>('analytics')

  const classOptions = useMemo(() => classes.map((c:any) => ({ label: c.name, value: c.id })), [classes])
  const availableExams = useMemo(() => exams.filter((e:any) => e.class_id === selectedClassId), [exams, selectedClassId])
  const classStudents = useMemo(() => students.filter((s:any) => s.class_id === selectedClassId), [students, selectedClassId])

  const filteredStudentsForCustomFields = useMemo(() => {
    if (!customFieldSearch) return classStudents
    return classStudents.filter((s:any) => `${s.first_name} ${s.last_name} ${s.enrollment_id}`.toLowerCase().includes(customFieldSearch.toLowerCase()))
  }, [classStudents, customFieldSearch])

  const totalWeight = useMemo(() => {
    const eW = selectedExams.reduce((sum: number, e: any) => sum + (Number(e.weight) || 0), 0)
    const cW = customFields.reduce((sum: number, c: any) => sum + (Number(c.weight) || 0), 0)
    return eW + cW
  }, [selectedExams, customFields])

  const toggleExamSelection = (examId: string) => {
    setSelectedExams(prev => {
      if (prev.find((w: any) => w.examId === examId)) return prev.filter((w: any) => w.examId !== examId)
      
      const configsForExam = (examConfigs || []).filter((c: any) => c.exam_id === examId)
      const totalMax = configsForExam.reduce((sum: number, c: any) => sum + (Number(c.total_max_marks) || 0), 0)
      
      return [...prev, { examId, maxMark: totalMax > 0 ? totalMax.toString() : '100', weight: '' }] 
    })
  }

  const updateExamConfig = (examId: string, key: 'maxMark' | 'weight', val: string) => {
    let engVal = toEnglishNumber(val)
    let num = Number(engVal)
    if (num < 0) engVal = '0'
    if (key === 'weight' && num > 100) engVal = '100'
    setSelectedExams(prev => prev.map((w: any) => w.examId === examId ? { ...w, [key]: engVal } : w))
  }

  const addCustomField = () => setCustomFields([...customFields, { id: `cf_${Date.now()}`, name: '', maxMark: '', weight: '' }])

  const removeCustomField = (id: string) => {
    if (!window.confirm("এই ফিল্ডটি মুছে ফেলতে চান? / Remove this field?")) return
    setCustomFields(prev => prev.filter((c: any) => c.id !== id))
    setCustomMarks(prev => {
      const newState = { ...prev }
      Object.keys(newState).forEach(studentId => { if (newState[studentId][id]) delete newState[studentId][id] })
      return newState
    })
  }

  const updateCustomField = (id: string, key: 'maxMark' | 'weight' | 'name', val: string) => {
    setCustomFields(prev => prev.map((c: any) => {
      if (c.id !== id) return c;
      if (key === 'name') return { ...c, name: val };
      
      let engVal = toEnglishNumber(val)
      let num = Number(engVal);
      if (num < 0) engVal = '0';
      if (key === 'weight' && num > 100) engVal = '100';
      return { ...c, [key]: engVal };
    }))
  }

  const handleProceedToStep3 = async () => {
    if (totalWeight !== 100) return alert(`মোট ওয়েট ১০০% হতে হবে। বর্তমান ওয়েট ${toBengaliNumber(totalWeight)}%। / Total weight must be exactly 100%.`)
    for (const cf of customFields) {
      if (!cf.name.trim() || !cf.maxMark || !cf.weight) return alert("কাস্টম ফিল্ডের সকল তথ্য পূরণ করুন। / Please complete all custom field details.")
    }

    setIsFetchingMarks(true)
    try {
      const fetchedMarks = await fetchMarksForExams(selectedExams.map((w: any) => w.examId))
      setRawMarksData(fetchedMarks)
      
      const stats: any[] = []
      selectedExams.forEach((config: any) => {
        const examObj = availableExams.find((e: any) => e.id === config.examId)
        const marksForThisExam = fetchedMarks.filter((m: any) => m.exam_id === config.examId)
        const missingCount = classStudents.length - new Set(marksForThisExam.map((m: any) => m.student_id)).size
        if (missingCount > 0) stats.push({ examName: examObj?.name || 'Unknown', missing: missingCount })
      })

      setMissingStats(stats)
      setStep(customFields.length > 0 ? 3 : 4)
      if (customFields.length === 0) await compileLedger(fetchedMarks) 
    } catch (error) { alert("নম্বর লোড করতে সমস্যা হয়েছে। / Failed to fetch marks.") } 
    finally { setIsFetchingMarks(false) }
  }

  const updateCustomMark = (studentId: string, fieldId: string, val: string, maxMark: number) => {
    if (val === '') {
      setCustomMarks(prev => {
        const newState = { ...prev }; if (newState[studentId]) { delete newState[studentId][fieldId] } return newState
      })
      return
    }
    const engVal = toEnglishNumber(val)
    let num = Number(engVal)
    if (num < 0) num = 0
    if (num > maxMark) num = maxMark
    setCustomMarks(prev => ({ ...prev, [studentId]: { ...(prev[studentId] || {}), [fieldId]: num } }))
  }

  // --- CORE COMPILER FOR COMBINED ---
  const compileLedger = async (fetchedMarks = rawMarksData) => {
    setIsProcessing(true)
    
    setTimeout(() => {
      const combinedExamConfigs = (examConfigs || []).filter((c:any) => selectedExams.some((e: any) => e.examId === c.exam_id))
      const activeSubjectIds = Array.from(new Set(combinedExamConfigs.map((c:any) => c.subject_id)))
      const activeSubjectsList = (subjects || []).filter((s:any) => activeSubjectIds.includes(s.id))

      const processed = classStudents.map((student: any) => {
        let totalNormalizedScore = 0
        let totalRawObtained = 0 
        const breakdowns: any[] = []
        const subjectMarks: Record<string, Record<string, any>> = {}

        selectedExams.forEach((config: any) => {
          const examObj = availableExams.find((e: any) => e.id === config.examId)
          const examMarks = fetchedMarks.filter((m: any) => m.student_id === student.id && m.exam_id === config.examId)
          
          let examRawObtained = 0
          subjectMarks[config.examId] = {}

          activeSubjectsList.forEach((sub: any) => {
             const mark = examMarks.find((m: any) => m.subject_id === sub.id)
             if (mark && !mark.isAbsent) {
                subjectMarks[config.examId][sub.id] = Number(mark.total_obtained)
                examRawObtained += Number(mark.total_obtained)
             } else {
                subjectMarks[config.examId][sub.id] = 'ABS'
             }
          })

          const safeMax = Number(config.maxMark) > 0 ? Number(config.maxMark) : 100
          const weight = Number(config.weight)
          const points = (examRawObtained / safeMax) * weight
          
          totalNormalizedScore += points
          totalRawObtained += examRawObtained
          breakdowns.push({ id: config.examId, name: examObj?.name || 'Exam', raw: examRawObtained, max: safeMax, weight: weight, points: points.toFixed(2), isExam: true })
        })

        customFields.forEach((cf: any) => {
          const obtainedCustom = customMarks[student.id]?.[cf.id] || 0
          const safeMax = Number(cf.maxMark) > 0 ? Number(cf.maxMark) : 100
          const weight = Number(cf.weight)
          const points = (obtainedCustom / safeMax) * weight

          totalNormalizedScore += points
          totalRawObtained += obtainedCustom
          breakdowns.push({ id: cf.id, name: cf.name, raw: obtainedCustom, max: safeMax, weight: weight, points: points.toFixed(2), isExam: false })
        })

        const totalScore = Number(totalNormalizedScore.toFixed(2))
        const percentage = Math.round((totalScore / 100) * 100)
        const gradeInfo = getGradeInfo(percentage, 100)

        return { student, totalScore, totalRawObtained, breakdowns, percentage, gpa: gradeInfo.gpa.toFixed(2), grade: gradeInfo.grade, remark: gradeInfo.remark, subjectMarks }
      })

      processed.sort((a: any, b: any) => b.totalScore - a.totalScore)
      
      const mappedReportData = processed.map((p: any, i: number) => ({
        student: p.student,
        rank: i + 1,
        percentage: p.percentage,
        grandTotalObtained: p.totalScore,
        grandTotalRaw: p.totalRawObtained,
        gpa: p.gpa,
        grade: p.grade,
        remark: p.remark,
        breakdowns: p.breakdowns,
        subjectMarks: p.subjectMarks
      }))

      setReportData(mappedReportData)
      setStep(4)
      setIsProcessing(false)
    }, 100) 
  }

  const selectedClassName = classes.find((c:any) => c.id === selectedClassId)?.name || ''
  
  const combinedSubjectsMap = [...selectedExams.map((e: any) => {
    const obj = availableExams.find((x: any) => x.id === e.examId)
    return { id: e.examId, name: obj?.name, max: e.maxMark, weight: e.weight }
  }), ...customFields.map((c: any) => ({ id: c.id, name: c.name, max: c.maxMark, weight: c.weight }))]

  const activeSubjectsList = useMemo(() => {
    if (!examConfigs || !selectedExams.length || !subjects) return []
    const combinedExamConfigs = examConfigs.filter((c:any) => selectedExams.some((e: any) => e.examId === c.exam_id))
    const activeSubjectIds = Array.from(new Set(combinedExamConfigs.map((c:any) => c.subject_id)))
    return subjects.filter((s:any) => activeSubjectIds.includes(s.id))
  }, [examConfigs, selectedExams, subjects])

  return (
    <div className="bg-white rounded-sm border border-stone-200 shadow-sm flex flex-col font-sans min-h-[600px]">
      <div className="bg-stone-50 border-b border-stone-200 p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-5 print:hidden">
        <div>
          <div className="flex items-end flex-wrap gap-2.5 leading-none mb-2.5">
            <h2 className="text-[20px] font-black text-[#b4483e]">সমন্বিত বার্ষিক ফলাফল</h2>
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-stone-600 mb-0.5">/ Final Annual Ledger</span>
          </div>
          <p className="text-[13px] text-stone-600 font-bold tracking-wide">
            একাধিক পরীক্ষার ফলাফল ও কাস্টম মেট্রিক একত্রিত করে চূড়ান্ত মেধাতালিকা তৈরি করুন।
          </p>
        </div>
        <div className="hidden sm:flex gap-3 text-[11px] font-bold tracking-widest uppercase">
          <span className={step >= 1 ? 'text-[#b4483e]' : 'text-stone-400'}>১. শ্রেণি</span> &rarr;
          <span className={step >= 2 ? 'text-[#b4483e]' : 'text-stone-400'}>২. ওয়েট</span> &rarr;
          <span className={step >= 3 ? 'text-[#b4483e]' : 'text-stone-400'}>৩. নম্বর</span> &rarr;
          <span className={step >= 4 ? 'text-emerald-600' : 'text-stone-400'}>৪. রিপোর্ট</span>
        </div>
      </div>

      <div className="p-6 md:p-8 flex-grow flex flex-col bg-white">
        
        {step === 1 && (
          <div className="w-full max-w-lg mx-auto my-auto space-y-6 animate-in fade-in py-16">
            <div>
              <label className="flex items-end flex-wrap gap-2 mb-3 leading-none">
                <span className="text-[16px] font-bold text-stone-800">শ্রেণি নির্বাচন করুন</span>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-600 mb-0.5">/ Select Class</span>
              </label>
              <Dropdown options={classOptions} value={selectedClassId} onChange={setSelectedClassId} placeholder="-- শ্রেণি --" hasSearch={true} />
            </div>
            <button disabled={!selectedClassId} onClick={() => setStep(2)} className="w-full bg-[#b4483e] text-white px-6 py-4 rounded-sm hover:bg-[#85322a] disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center gap-2">
              <span className="text-[14px] font-bold">পরবর্তী ধাপ</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80 mt-0.5">/ Next Step &rarr;</span>
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="w-full max-w-5xl mx-auto space-y-8 animate-in fade-in pb-10">
            <div className={`sticky top-0 z-50 p-5 border rounded-sm flex items-center justify-between shadow-sm backdrop-blur-md transition-colors ${totalWeight === 100 ? 'bg-emerald-50/90 border-emerald-200' : 'bg-amber-50/90 border-amber-200'}`}>
              <div>
                <div className="flex items-end flex-wrap gap-2 leading-none mb-2">
                  <h4 className={`text-[16px] font-black ${totalWeight === 100 ? 'text-emerald-800' : 'text-amber-800'}`}>সর্বমোট ওয়েট (Total Weight)</h4>
                </div>
                <p className={`text-[13px] font-bold ${totalWeight === 100 ? 'text-emerald-700' : 'text-amber-700'}`}>সামনে এগোতে মোট ওয়েট ঠিক ১০০% হতে হবে। / Must exactly equal 100%.</p>
              </div>
              <div className={`text-5xl font-black ${totalWeight === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>{toBengaliNumber(totalWeight)}%</div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
              
              <div className="border border-stone-200 rounded-sm bg-stone-50 p-6 flex flex-col h-full">
                <div className="flex items-end flex-wrap gap-2 mb-6 leading-none">
                  <h3 className="text-[16px] font-black text-stone-900">১. পরীক্ষা নির্বাচন</h3>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-600 mb-0.5">/ Select Exams</span>
                </div>
                
                <div className="space-y-4 flex-grow">
                  {availableExams.length === 0 && <p className="text-[14px] font-bold italic text-stone-500">এই শ্রেণির কোনো পরীক্ষা পাওয়া যায়নি।</p>}
                  {availableExams.map((exam: any) => {
                    const conf = selectedExams.find((e: any) => e.examId === exam.id)
                    const isSelected = !!conf
                    return (
                      <div key={exam.id} className={`flex flex-col p-4 rounded-sm border transition-all ${isSelected ? 'border-[#b4483e] bg-white shadow-sm' : 'border-stone-200 bg-white/50'}`}>
                        <label className="flex items-center gap-3 cursor-pointer mb-2">
                          <input type="checkbox" checked={isSelected} onChange={() => toggleExamSelection(exam.id)} className="w-5 h-5 text-[#b4483e] focus:ring-[#b4483e] accent-[#b4483e] rounded-sm" />
                          <span className={`text-[16px] font-black ${isSelected ? 'text-stone-900' : 'text-stone-600'}`}>{exam.name}</span>
                        </label>
                        
                        {isSelected && (
                          <div className="flex items-center gap-4 mt-2 pt-3 border-t border-stone-100">
                            <div className="flex-1">
                              <label className="flex items-end flex-wrap gap-1.5 leading-none mb-2">
                                <span className="text-[14px] font-bold text-stone-700">পূর্ণমান (অটো)</span>
                                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-500">/ Max</span>
                              </label>
                              <input type="text" value={toBengaliNumber(conf.maxMark)} disabled className="w-full p-2.5 border border-stone-200 text-[15px] font-bold text-stone-500 rounded-sm bg-stone-100 cursor-not-allowed shadow-inner" />
                            </div>
                            <div className="flex-1">
                              <label className="flex items-end flex-wrap gap-1.5 leading-none mb-2">
                                <span className="text-[14px] font-bold text-[#b4483e]">ওয়েট %</span>
                                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#b4483e]/80">/ Weight</span>
                              </label>
                              <input type="text" inputMode="numeric" value={toBengaliNumber(conf.weight)} onChange={(e) => updateExamConfig(exam.id, 'weight', e.target.value)} placeholder="যেমন: ৩০" className="w-full p-2.5 border border-[#b4483e]/40 bg-[#fcf8f8] text-[#b4483e] text-[15px] font-black rounded-sm focus:border-[#b4483e] focus:outline-none shadow-inner" />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="border border-stone-200 rounded-sm bg-stone-50 p-6 flex flex-col h-full">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-end flex-wrap gap-2 leading-none">
                    <h3 className="text-[16px] font-black text-stone-900">২. কাস্টম মেট্রিক</h3>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-600 mb-0.5">/ Custom Fields</span>
                  </div>
                  <button onClick={addCustomField} className="bg-white border border-[#dad3e3] text-[#6b4c9a] px-4 py-2 rounded-sm hover:bg-[#f3eff8] transition-colors shadow-sm flex items-center gap-1.5">
                    <span className="text-[13px] font-bold">+ যোগ</span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b4c9a]/70">/ Add</span>
                  </button>
                </div>
                
                <div className="space-y-4 flex-grow">
                  {customFields.length === 0 && <p className="text-[14px] font-bold italic text-stone-500">উপস্থিতি বা আচরণের মতো কাস্টম মেট্রিক যোগ করুন।</p>}
                  {customFields.map((cf: any) => (
                    <div key={cf.id} className="flex flex-col p-4 rounded-sm border border-[#dad3e3] bg-white shadow-sm relative">
                      <button onClick={() => removeCustomField(cf.id)} className="absolute top-2 right-2 text-stone-400 hover:text-[#b4483e] transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                      </button>
                      
                      <div className="mb-3">
                        <label className="flex items-end flex-wrap gap-1.5 leading-none mb-2">
                          <span className="text-[14px] font-bold text-stone-700">নাম</span>
                          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-500">/ Name</span>
                        </label>
                        <input type="text" value={cf.name} onChange={e => updateCustomField(cf.id, 'name', e.target.value)} placeholder="যেমন: উপস্থিতি" className="w-full p-2.5 border border-stone-300 text-[15px] font-bold text-stone-900 rounded-sm focus:border-[#6b4c9a] focus:outline-none" />
                      </div>
                      
                      <div className="flex items-center gap-4 pt-1 border-t border-stone-100">
                        <div className="flex-1">
                          <label className="flex items-end flex-wrap gap-1.5 leading-none mb-2 mt-2">
                            <span className="text-[14px] font-bold text-stone-700">পূর্ণমান</span>
                            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-500">/ Max</span>
                          </label>
                          <input type="text" inputMode="numeric" value={toBengaliNumber(cf.maxMark)} onChange={e => updateCustomField(cf.id, 'maxMark', e.target.value)} className="w-full p-2.5 border border-stone-300 text-[15px] font-bold text-stone-900 rounded-sm focus:border-[#6b4c9a] focus:outline-none shadow-inner" />
                        </div>
                        <div className="flex-1">
                          <label className="flex items-end flex-wrap gap-1.5 leading-none mb-2 mt-2">
                            <span className="text-[14px] font-bold text-[#b4483e]">ওয়েট %</span>
                            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#b4483e]/80">/ Weight</span>
                          </label>
                          <input type="text" inputMode="numeric" value={toBengaliNumber(cf.weight)} onChange={e => updateCustomField(cf.id, 'weight', e.target.value)} className="w-full p-2.5 border border-[#dad3e3] bg-[#fbf9fc] text-[#6b4c9a] text-[15px] font-black rounded-sm focus:border-[#6b4c9a] focus:outline-none shadow-inner" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-8 border-t border-stone-200">
              <button onClick={() => setStep(1)} className="text-[13px] font-bold text-stone-600 hover:text-stone-900 flex items-center gap-1.5">
                &larr; <span className="uppercase tracking-widest">ফিরে যান / Back</span>
              </button>
              <button disabled={totalWeight !== 100 || isFetchingMarks} onClick={handleProceedToStep3} className="w-full sm:w-auto bg-[#b4483e] text-white px-10 py-4 rounded-sm hover:bg-[#85322a] disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center gap-2">
                {isFetchingMarks ? (
                  <>
                    <span className="text-[15px] font-bold">লোড হচ্ছে...</span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80 mt-0.5">/ Loading...</span>
                  </>
                ) : (
                  <>
                    <span className="text-[15px] font-bold">পরবর্তী ধাপ</span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80 mt-0.5">/ Next Step &rarr;</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* --- STEP 3: CUSTOM ENTRY --- */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in pb-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div className="flex items-end flex-wrap gap-2.5 leading-none">
                <h3 className="text-[20px] font-black text-stone-900">কাস্টম মেট্রিক ইনপুট</h3>
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-stone-600 mb-0.5">/ Custom Entry</span>
              </div>
              <div className="w-full sm:w-64">
                <input type="text" placeholder="শিক্ষার্থী খুঁজুন / Search..." value={customFieldSearch} onChange={(e) => setCustomFieldSearch(e.target.value)} className="w-full p-2.5 border border-stone-300 rounded-sm text-[14px] font-bold focus:border-[#b4483e] focus:outline-none shadow-sm" />
              </div>
            </div>
            
            {customFields.length > 0 && (
              <div className="overflow-x-auto border border-stone-200 rounded-sm shadow-sm min-h-[400px]">
                <table className="w-full text-left border-collapse min-w-max bg-white">
                  <thead className="bg-stone-100 border-b border-stone-200">
                    <tr>
                      <th className="py-3 px-4 border-r border-stone-200">
                        <span className="text-[14px] font-bold text-stone-800 block">শিক্ষার্থীর নাম</span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-600 mt-1 block">Student Name</span>
                      </th>
                      {customFields.map((cf: any) => (
                        <th key={cf.id} className="py-3 px-4 border-r border-stone-200 bg-[#fcf8f8]">
                          <div className="text-[15px] font-black text-[#b4483e] mb-1.5">{cf.name}</div>
                          <div className="flex gap-3 text-[11px] font-bold text-[#b4483e]/80 uppercase tracking-widest">
                            <span>Max: {toBengaliNumber(cf.maxMark)}</span> | <span>Wt: {toBengaliNumber(cf.weight)}%</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredStudentsForCustomFields.map((student: any) => (
                      <tr key={student.id} className="hover:bg-stone-50 transition-colors">
                        <td className="py-3 px-4 border-r border-stone-100">
                          <span className="text-[15px] font-bold text-stone-900 block">{student.name_bangla || student.first_name}</span>
                          <span className="text-[11px] font-bold text-[#b4483e] mt-1 block">রোল: {toBengaliNumber(student.enrollment_id)}</span>
                        </td>
                        {customFields.map((cf: any) => (
                          <td key={cf.id} className="py-2 px-4 border-r border-stone-100 bg-stone-50/50">
                            <input 
                              type="text" inputMode="numeric"
                              value={toBengaliNumber(customMarks[student.id]?.[cf.id] ?? '')} 
                              onChange={(e) => updateCustomMark(student.id, cf.id, toEnglishNumber(e.target.value), Number(cf.maxMark))} 
                              className="w-24 p-2.5 text-[16px] font-black border border-stone-300 rounded-sm focus:border-[#b4483e] focus:outline-none focus:ring-1 focus:ring-[#b4483e] shadow-inner text-center" 
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 border-t border-stone-200">
              <button onClick={() => setStep(2)} className="text-[13px] font-bold text-stone-600 hover:text-stone-900 flex items-center gap-1.5">
                &larr; <span className="uppercase tracking-widest">ফিরে যান / Back</span>
              </button>
              <button onClick={() => compileLedger()} disabled={isProcessing} className="w-full sm:w-auto bg-[#b4483e] text-white px-10 py-4 rounded-sm hover:bg-[#85322a] disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center gap-2">
                <span className="text-[15px] font-bold">ফলাফল কম্পাইল করুন</span>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80 mt-0.5">/ Compile Ledger &rarr;</span>
              </button>
            </div>
          </div>
        )}

        {/* --- STEP 4: RESULTS DASHBOARD --- */}
        {step === 4 && (
          <div className="animate-in fade-in space-y-6 relative z-10 print:mt-[-50px]">
            <div className="flex border-b border-stone-200 px-2 pt-2 gap-8 print:hidden overflow-x-auto custom-scrollbar">
              {[
                { id: 'analytics', bn: 'ক্লাস অ্যানালিটিক্স', en: 'Class Analytics' },
                { id: 'cumulative', bn: 'সম্মিলিত ফলাফল', en: 'Cumulative Sheet' },
                { id: 'individual', bn: 'রিপোর্ট কার্ড', en: 'Report Cards' }
              ].map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`pb-3.5 pt-4 border-b-[3px] transition-colors flex items-baseline gap-1.5 whitespace-nowrap ${activeTab === tab.id ? 'border-[#b4483e] text-[#b4483e]' : 'border-transparent text-stone-500 hover:text-stone-800'}`}>
                  <span className={`text-[15px] font-bold ${activeTab === tab.id ? 'text-[#b4483e]' : 'text-stone-700'}`}>{tab.bn}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${activeTab === tab.id ? 'text-[#b4483e]/80' : 'text-stone-400'}`}>/ {tab.en}</span>
                </button>
              ))}
            </div>

            {activeTab === 'analytics' && (
              <div className="bg-stone-50 p-6 md:p-8 rounded-sm space-y-8 print:hidden">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-8 rounded-sm border border-stone-200 shadow-sm flex flex-col justify-center">
                    <div className="flex items-end flex-wrap gap-2 mb-3 leading-none">
                      <span className="text-[18px] font-bold text-stone-800">মোট শিক্ষার্থী</span>
                      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-stone-600 mb-0.5">/ Total Students</span>
                    </div>
                    <p className="text-6xl font-black text-stone-900 mt-2">{toBengaliNumber(reportData.length)}</p>
                  </div>
                  <div className="bg-white p-8 rounded-sm border border-stone-200 shadow-sm flex flex-col justify-center">
                    <div className="flex items-end flex-wrap gap-2 mb-3 leading-none">
                      <span className="text-[18px] font-bold text-stone-800">পাসের হার</span>
                      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-stone-600 mb-0.5">/ Pass Rate</span>
                    </div>
                    <p className="text-6xl font-black text-emerald-600 mt-2">{toBengaliNumber((((reportData.length - reportData.filter((r:any) => r.grade === 'ঘ').length) / reportData.length) * 100).toFixed(1))}%</p>
                  </div>
                  <div className="bg-[#fcf8f8] p-8 rounded-sm border border-[#b4483e]/30 shadow-sm flex flex-col justify-center">
                    <div className="flex items-end flex-wrap gap-2 mb-3 leading-none">
                      <span className="text-[18px] font-bold text-[#b4483e]">অকৃতকার্য শিক্ষার্থী</span>
                      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#b4483e]/80 mb-0.5">/ Failed</span>
                    </div>
                    <p className="text-6xl font-black text-[#b4483e] mt-2">{toBengaliNumber(reportData.filter((r:any) => r.grade === 'ঘ').length)}</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'cumulative' && (
              <CumulativeSheet reportData={reportData} uniqueSubjects={combinedSubjectsMap} showGrading={true} mode="combined" />
            )}

            {activeTab === 'individual' && (
              <IndividualReportView 
                reportData={reportData} 
                className={selectedClassName} 
                schoolData={schoolData} 
                showGrading={true} 
                mode="combined" 
                activeSubjects={activeSubjectsList} 
              />
            )}
          </div>
        )}

      </div>
    </div>
  )
}

// ============================================================================
// 6. MAIN ENGINE WRAPPER
// ============================================================================
export default function ReportsEngine({ exams, classes, students, schoolData, subjects, examConfigs, fetchMarksForExams }: any) {
  const [activeEngine, setActiveEngine] = useState<'selection' | 'single' | 'combined'>('selection')

  if (activeEngine === 'selection') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
        <button 
          onClick={() => setActiveEngine('single')}
          className="group bg-white p-8 md:p-12 rounded-sm border border-stone-200 shadow-sm hover:border-[#6b4c9a] hover:shadow-lg transition-all text-left flex flex-col items-start"
        >
          <div className="w-16 h-16 bg-[#fbf9fc] text-[#6b4c9a] rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          </div>
          <h2 className="text-2xl font-black text-stone-900 uppercase tracking-widest mb-3">একক পরীক্ষার ফলাফল (Single Exam Eval.)</h2>
          <p className="text-sm font-medium text-stone-500 leading-relaxed">
            Generate analytics, cumulative merit sheets, and official government-standard report cards for a specific examination.
          </p>
        </button>

        <button 
          onClick={() => setActiveEngine('combined')}
          className="group bg-white p-8 md:p-12 rounded-sm border border-stone-200 shadow-sm hover:border-[#b4483e] hover:shadow-lg transition-all text-left flex flex-col items-start"
        >
          <div className="w-16 h-16 bg-[#fcf8f8] text-[#b4483e] rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
          </div>
          <h2 className="text-2xl font-black text-stone-900 uppercase tracking-widest mb-3">সমন্বিত বার্ষিক ফলাফল (Annual Ledger)</h2>
          <p className="text-sm font-medium text-stone-500 leading-relaxed">
            Combine multiple exam results using custom weight percentages to compile the final year-end promotional merit sheet.
          </p>
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end print:hidden">
        <button 
          onClick={() => setActiveEngine('selection')}
          className="bg-stone-200 text-stone-700 px-5 py-2.5 rounded-sm text-[10px] uppercase tracking-widest font-bold hover:bg-stone-300 transition-colors"
        >
          &larr; Switch Engine Mode
        </button>
      </div>
      
      {activeEngine === 'single' && (
        <SingleExamEngine exams={exams} classes={classes} schoolData={schoolData} />
      )}
      
      {activeEngine === 'combined' && (
        <CombinedReportsEngine 
          classes={classes} 
          exams={exams} 
          students={students} 
          schoolData={schoolData}
          subjects={subjects}
          examConfigs={examConfigs}
          fetchMarksForExams={fetchMarksForExams} 
        />
      )}
    </div>
  )
}