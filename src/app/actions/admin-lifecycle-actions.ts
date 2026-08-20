'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ==================================================================
// 1. FETCH SPECIFIC SCHOOL BACKUP DATA
// ==================================================================
export async function fetchSchoolBackupData(schoolId: string) {
  const supabase = await createClient()

  const [
    { data: students },
    { data: exams },
    { data: rawExamMarks }
  ] = await Promise.all([
    supabase.schema('gps').from('students').select('*').eq('school_id', schoolId),
    supabase.schema('gps').from('exams').select('*').eq('school_id', schoolId),
    supabase.schema('gps').from('exam_marks').select('*, exams!inner(school_id)').eq('exams.school_id', schoolId)
  ])

  const cleanedExamMarks = rawExamMarks?.map((mark: any) => {
    const { exams, ...rest } = mark
    return rest
  }) || []

  return {
    students: students || [],
    exams: exams || [],
    exam_marks: cleanedExamMarks
  }
}

// ==================================================================
// 2. SECURE ADMIN PASSWORD VERIFICATION
// ==================================================================
export async function verifyMasterAdminPassword(email: string, passwordAttempt: string) {
  const supabase = await createClient()
  
  // Use native Supabase Auth to verify the master admin's credentials
  const { error } = await supabase.auth.signInWithPassword({
    email: email,
    password: passwordAttempt
  })

  if (error) {
    return { success: false, error: "Incorrect Master Password. Authorization denied." }
  }

  return { success: true }
}

// ==================================================================
// 3. ADMIN DATA DELETION WIPE
// ==================================================================
export async function executeAdminYearEndWipe(schoolId: string) {
  const supabase = await createClient()

  try {
    const { error: examsError } = await supabase.schema('gps').from('exams').delete().eq('school_id', schoolId)
    if (examsError) throw examsError
    
    const { error: studentsError } = await supabase.schema('gps').from('students').delete().eq('school_id', schoolId)
    if (studentsError) throw studentsError

    revalidatePath('/platform-dashboard', 'layout')
    return { success: true }
  } catch (err: any) {
    console.error("Admin Year End Wipe Error:", err)
    return { success: false, error: err.message || "Failed to wipe database." }
  }
}

// ==================================================================
// 4. ADMIN SYSTEM RESTORATION
// ==================================================================
export async function executeAdminSystemRestore(schoolId: string, parsedData: any) {
  const supabase = await createClient()

  try {
    if (parsedData.students && parsedData.students.length > 0) {
      const { error } = await supabase.schema('gps').from('students').insert(parsedData.students)
      if (error) throw new Error(`Student Restore Error: ${error.message}`)
    }
    
    if (parsedData.exams && parsedData.exams.length > 0) {
      const { error } = await supabase.schema('gps').from('exams').insert(parsedData.exams)
      if (error) throw new Error(`Exam Restore Error: ${error.message}`)
    }

    if (parsedData.exam_marks && parsedData.exam_marks.length > 0) {
      const { error } = await supabase.schema('gps').from('exam_marks').insert(parsedData.exam_marks)
      if (error) throw new Error(`Exam Marks Restore Error: ${error.message}`)
    }

    revalidatePath('/platform-dashboard', 'layout')
    return { success: true }
  } catch (err: any) {
    console.error("Admin System Restore Error:", err)
    return { success: false, error: err.message }
  }
}