'use server'

import bcrypt from 'bcryptjs'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ==================================================================
// 1. SECURE PASSWORD VERIFICATION
// ==================================================================
export async function verifyHeadmasterPassword(userId: string, passwordAttempt: string) {
  const supabase = await createClient()
  
  const { data: user, error } = await supabase
    .schema('gps')
    .from('school_users')
    .select('password_hash')
    .eq('id', userId)
    .single()

  if (error || !user) {
    return { success: false, error: "Authentication failed. User not found." }
  }

  const isValid = await bcrypt.compare(passwordAttempt, user.password_hash)

  if (!isValid) {
    return { success: false, error: "Incorrect password. Authorization denied." }
  }

  return { success: true }
}

// ==================================================================
// 2. DATA DELETION WIPE (Academic Year Rollover)
// ==================================================================
export async function executeYearEndWipe(schoolId: string) {
  const supabase = await createClient()

  try {
    // Note: Because your `exam_marks` table has ON DELETE CASCADE linked to exams and students, 
    // we do not need to manually delete from exam_marks. The database handles it automatically!

    // 1. Delete Exams (Cascades to exam_marks)
    const { error: examsError } = await supabase.schema('gps').from('exams').delete().eq('school_id', schoolId)
    if (examsError) throw examsError
    
    // 2. Delete Students (Cascades to exam_marks)
    const { error: studentsError } = await supabase.schema('gps').from('students').delete().eq('school_id', schoolId)
    if (studentsError) throw studentsError

    revalidatePath('/school-dashboard', 'layout')
    return { success: true }
  } catch (err: any) {
    console.error("Year End Wipe Error:", err)
    return { success: false, error: err.message || "Failed to wipe database." }
  }
}

// ==================================================================
// 3. SYSTEM RESTORATION (From .ZIP archive)
// ==================================================================
export async function executeSystemRestore(schoolId: string, parsedData: any) {
  const supabase = await createClient()

  try {
    // 1. Restore Students
    if (parsedData.students && parsedData.students.length > 0) {
      const { error } = await supabase.schema('gps').from('students').insert(parsedData.students)
      if (error) throw new Error(`Student Restore Error: ${error.message}`)
    }
    
    // 2. Restore Exams
    if (parsedData.exams && parsedData.exams.length > 0) {
      const { error } = await supabase.schema('gps').from('exams').insert(parsedData.exams)
      if (error) throw new Error(`Exam Restore Error: ${error.message}`)
    }

    // 3. Restore Exam Marks
    if (parsedData.exam_marks && parsedData.exam_marks.length > 0) {
      const { error } = await supabase.schema('gps').from('exam_marks').insert(parsedData.exam_marks)
      if (error) throw new Error(`Exam Marks Restore Error: ${error.message}`)
    }

    revalidatePath('/school-dashboard', 'layout')
    return { success: true }
  } catch (err: any) {
    console.error("System Restore Error:", err)
    return { success: false, error: err.message }
  }
}