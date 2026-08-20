'use server'

import { createClient } from '@/lib/supabase/server'

export async function getDetailedReportData(examId: string, classId: string) {
  const supabase = await createClient()

  // 1. Fetch Students
  const { data: students } = await supabase.schema('gps').from('students')
    .select('*').eq('class_id', classId)

  // 2. Fetch Configs strictly for THIS EXAM. 
  const { data: configs } = await supabase.schema('gps').from('exam_configurations')
    .select('*, subjects(name)')
    .match({ exam_id: examId, class_id: classId })

  // 3. Fetch Marks
  const { data: marks } = await supabase.schema('gps').from('exam_marks')
    .select('*').eq('exam_id', examId)

  if (!students || !configs || !marks) return []

  configs.sort((a, b) => (a.subjects?.name || '').localeCompare(b.subjects?.name || ''))

  // 4. Build the dynamic aggregated array
  const reportData = students.map(student => {
    let grandTotalObtained = 0
    let grandTotalMax = 0
    let hasFailedAnySubject = false
    const subjectResults: any[] = []

    configs.forEach(config => {
      const mark = marks.find(m => m.student_id === student.id && m.subject_id === config.subject_id)
      
      const maxTotal = config.total_max_marks || 0
      const passMark = config.total_pass_mark || 0
      const obtainedTotal = mark?.total_obtained || 0
      
      let isFail = false

      if (!mark) {
        isFail = true
      } else {
        if (config.is_individual_pass && config.breakdowns) {
          for (const b of config.breakdowns) {
            const bMark = parseFloat(mark.breakdown_marks?.[b.name]) || 0
            if (bMark < (parseFloat(b.pass) || 0)) {
              isFail = true
              break
            }
          }
        }
        if (obtainedTotal < passMark) {
          isFail = true
        }
      }

      if (isFail) hasFailedAnySubject = true
      
      grandTotalObtained += obtainedTotal
      grandTotalMax += maxTotal

      subjectResults.push({
        subjectId: config.subject_id,
        subjectName: config.subjects?.name || 'Unknown',
        maxTotal,
        passMark,
        breakdownsConfig: config.breakdowns || [],
        breakdownMarks: mark?.breakdown_marks || {},
        totalObtained: obtainedTotal,
        isFail,
        isAbsent: !mark
      })
    })

    const percentage = grandTotalMax > 0 ? (grandTotalObtained / grandTotalMax) * 100 : 0

    return {
      student,
      grandTotalObtained,
      grandTotalMax,
      percentage: percentage.toFixed(2),
      hasFailedAnySubject,
      subjectResults,
      rank: 0 // Placeholder, calculated below
    }
  })

  // 5. CRITICAL: Calculate Rank FIRST (by Grand Total Descending)
  reportData.sort((a, b) => b.grandTotalObtained - a.grandTotalObtained)
  reportData.forEach((student, index) => {
    student.rank = index + 1
  })

  // 6. DEFAULT SORT: Re-sort by Roll Number Ascending so it displays Serialwise
  return reportData.sort((a, b) => {
    return a.student.enrollment_id.localeCompare(b.student.enrollment_id, undefined, { numeric: true })
  })
}