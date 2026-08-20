'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. SMART CREATE EXAM (Auto-numbers duplicate names)
export async function createExam(formData: FormData) {
  const schoolId = formData.get('schoolId') as string
  const classId = formData.get('classId') as string
  let name = (formData.get('name') as string).trim()
  const examDate = formData.get('examDate') as string

  const supabase = await createClient()

  // Fetch existing exams for this class to check for duplicates
  const { data: existingExams } = await supabase.schema('gps')
    .from('exams')
    .select('name')
    .eq('class_id', classId)

  // Smart Auto-Numbering Logic
  if (existingExams) {
    const exactMatch = existingExams.find(e => e.name.toLowerCase() === name.toLowerCase())
    if (exactMatch) {
      let maxNum = 1
      existingExams.forEach(e => {
        if (e.name.toLowerCase().startsWith(name.toLowerCase() + " ")) {
          const parts = e.name.split(" ")
          const lastPart = parts[parts.length - 1]
          const num = parseInt(lastPart)
          if (!isNaN(num) && num >= maxNum) maxNum = num
        }
      })
      name = `${name} ${maxNum + 1}`
    }
  }

  const { error } = await supabase.schema('gps').from('exams').insert({
    school_id: schoolId,
    class_id: classId,
    name: name,
    exam_date: examDate || null,
  })

  if (error) throw new Error(`Failed to create exam: ${error.message}`)

  revalidatePath('/school-dashboard', 'layout')
  return { success: true }
}

// 2. UPDATE EXAM (Rename / Change Date)
export async function updateExam(formData: FormData) {
  const examId = formData.get('examId') as string
  const name = formData.get('name') as string
  const examDate = formData.get('examDate') as string

  const supabase = await createClient()
  const { error } = await supabase.schema('gps').from('exams')
    .update({ name: name.trim(), exam_date: examDate || null })
    .eq('id', examId)

  if (error) throw new Error(`Failed to update exam: ${error.message}`)
  revalidatePath('/school-dashboard', 'layout')
  return { success: true }
}

// 3. DELETE EXAM (Cascade deletes all configs and marks)
export async function deleteExam(examId: string) {
  const supabase = await createClient()
  const { error } = await supabase.schema('gps').from('exams').delete().eq('id', examId)
  
  if (error) throw new Error(`Failed to delete exam: ${error.message}`)
  revalidatePath('/school-dashboard', 'layout')
  return { success: true }
}

// 4. SAVE DYNAMIC EXAM CONFIGURATION
export async function saveExamConfiguration(payload: {
  examId: string; classId: string; subjectId: string; breakdowns: any[];
  isIndividualPass: boolean; totalMax: number; totalPass: number;
}) {
  const supabase = await createClient()
  const { error } = await supabase.schema('gps').from('exam_configurations')
    .upsert({
      exam_id: payload.examId, class_id: payload.classId, subject_id: payload.subjectId,
      breakdowns: payload.breakdowns, is_individual_pass: payload.isIndividualPass,
      total_max_marks: payload.totalMax, total_pass_mark: payload.totalPass,
    }, { onConflict: 'exam_id, class_id, subject_id' })

  if (error) throw new Error(`Failed to save config: ${error.message}`)
  revalidatePath('/school-dashboard', 'layout')
  return { success: true }
}

// 5. REMOVE SUBJECT FROM EXAM
export async function removeSubjectFromExam(examId: string, subjectId: string) {
  const supabase = await createClient()
  const { error } = await supabase.schema('gps').from('exam_configurations')
    .delete().match({ exam_id: examId, subject_id: subjectId })
  
  if (error) throw new Error(`Failed to remove subject: ${error.message}`)
  revalidatePath('/school-dashboard', 'layout')
}

// 6. BULK SAVE STUDENT MARKS
export async function saveStudentMarks(marksData: Array<any>) {
  const supabase = await createClient()
  const { error } = await supabase.schema('gps').from('exam_marks')
    .upsert(marksData, { onConflict: 'exam_id, student_id, subject_id' })

  if (error) throw new Error(`Failed to save marks: ${error.message}`)
  revalidatePath('/school-dashboard', 'layout')
  return { success: true }
}

// 7. FETCH SPREADSHEET DATA FOR MARKS ENTRY
export async function getMarksSheetData(examId: string, classId: string, subjectId: string) {
  const supabase = await createClient()

  const { data: students } = await supabase.schema('gps').from('students')
    .select('id, first_name, last_name, enrollment_id').eq('class_id', classId).order('enrollment_id', { ascending: true })

  const { data: config } = await supabase.schema('gps').from('exam_configurations')
    .select('*').match({ exam_id: examId, class_id: classId, subject_id: subjectId }).single()

  const { data: marks } = await supabase.schema('gps').from('exam_marks')
    .select('*').match({ exam_id: examId, subject_id: subjectId })

  return { students: students || [], config: config || null, marks: marks || [] }
}
// 8. DELETE A SINGLE STUDENT'S MARK
export async function deleteStudentMark(examId: string, subjectId: string, studentId: string) {
  const supabase = await createClient()
  const { error } = await supabase.schema('gps').from('exam_marks')
    .delete()
    .match({ exam_id: examId, subject_id: subjectId, student_id: studentId })

  if (error) throw new Error(`Failed to delete mark: ${error.message}`)
  revalidatePath('/school-dashboard', 'layout')
  return { success: true }
}