'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ==========================================
// 1. UNIFIED EXAM & CONFIGURATION SAVER
// ==========================================
export async function saveFullExamSetup(payload: {
  examId?: string | null;
  schoolId: string;
  classId: string;
  name: string;
  examDate: string;
  configs: Record<string, any>;
}) {
  const supabase = await createClient()
  let currentExamId = payload.examId

  // A. Create or Update Exam
  if (currentExamId) {
    const { error } = await supabase.schema('gps').from('exams')
      .update({ name: payload.name.trim(), exam_date: payload.examDate || null })
      .eq('id', currentExamId)
    if (error) throw new Error(`Failed to update exam: ${error.message}`)
  } else {
    // Smart Auto-Numbering Logic
    let finalName = payload.name.trim()
    const { data: existingExams } = await supabase.schema('gps').from('exams')
      .select('name').eq('class_id', payload.classId)

    if (existingExams) {
      const exactMatch = existingExams.find(e => e.name.toLowerCase() === finalName.toLowerCase())
      if (exactMatch) {
        let maxNum = 1
        existingExams.forEach(e => {
          if (e.name.toLowerCase().startsWith(finalName.toLowerCase() + " ")) {
            const parts = e.name.split(" ")
            const lastPart = parts[parts.length - 1]
            const num = parseInt(lastPart)
            if (!isNaN(num) && num >= maxNum) maxNum = num
          }
        })
        finalName = `${finalName} ${maxNum + 1}`
      }
    }

    const { data: newExam, error: createError } = await supabase.schema('gps').from('exams')
      .insert({
        school_id: payload.schoolId,
        class_id: payload.classId,
        name: finalName,
        exam_date: payload.examDate || null,
      }).select('id').single()

    if (createError) throw new Error(`Failed to create exam: ${createError.message}`)
    currentExamId = newExam.id
  }

  // B. Save Subject Configs
  // Clear old configs for this exam to ensure clean replacement
  await supabase.schema('gps').from('exam_configurations').delete().eq('exam_id', currentExamId)

  const configInserts = Object.keys(payload.configs).map(subjectId => {
    const conf = payload.configs[subjectId]
    return {
      exam_id: currentExamId,
      class_id: payload.classId,
      subject_id: subjectId,
      breakdowns: conf.breakdowns || [],
      is_individual_pass: conf.isIndividualPass || false,
      total_max_marks: Number(conf.totalMax) || 100,
      total_pass_mark: Number(conf.totalPass) || 33
    }
  })

  if (configInserts.length > 0) {
    const { error: configError } = await supabase.schema('gps').from('exam_configurations')
      .insert(configInserts)
    if (configError) throw new Error(`Failed to save configurations: ${configError.message}`)
  }

  revalidatePath('/school-dashboard', 'layout')
  return { success: true }
}

// ==========================================
// 2. EXAM DELETION
// ==========================================
export async function deleteExam(examId: string) {
  const supabase = await createClient()
  const { error } = await supabase.schema('gps').from('exams').delete().eq('id', examId)
  if (error) throw new Error(`Failed to delete exam: ${error.message}`)
  revalidatePath('/school-dashboard', 'layout')
  return { success: true }
}

// ==========================================
// 3. MARKS MANAGEMENT 
// ==========================================
export async function saveStudentMarks(marksData: Array<any>) {
  const supabase = await createClient()
  const { error } = await supabase.schema('gps').from('exam_marks')
    .upsert(marksData, { onConflict: 'exam_id, student_id, subject_id' })
  if (error) throw new Error(`Failed to save marks: ${error.message}`)
  revalidatePath('/school-dashboard', 'layout')
  return { success: true }
}

export async function deleteStudentMark(examId: string, subjectId: string, studentId: string) {
  const supabase = await createClient()
  const { error } = await supabase.schema('gps').from('exam_marks')
    .delete()
    .match({ exam_id: examId, subject_id: subjectId, student_id: studentId })
  if (error) throw new Error(`Failed to delete mark: ${error.message}`)
  revalidatePath('/school-dashboard', 'layout')
  return { success: true }
}

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