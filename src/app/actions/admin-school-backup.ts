'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// ==================================================================
// FULL BACKUP FETCH (For generating the .zip)
// ==================================================================
export async function fetchFullSchoolBackup(schoolId: string) {
  const supabase = await createClient()

  // STEP 1: Fetch all entities that have a direct school_id
  const [
    schoolRes,
    classesRes,
    subjectsRes,
    schoolUsersRes, 
    teachersRes,    
    studentsRes,
    examsRes,
  ] = await Promise.all([
    supabase.schema('gps').from('schools').select('*').eq('id', schoolId).single(),
    supabase.schema('gps').from('classes').select('*').eq('school_id', schoolId),
    supabase.schema('gps').from('subjects').select('*').eq('school_id', schoolId),
    supabase.schema('gps').from('school_users').select('*').eq('school_id', schoolId),
    supabase.schema('gps').from('teachers').select('*').eq('school_id', schoolId), 
    supabase.schema('gps').from('students').select('*').eq('school_id', schoolId),
    supabase.schema('gps').from('exams').select('*').eq('school_id', schoolId)
  ])

  const classes = classesRes.data || []
  const exams = examsRes.data || []
  
  // Extract IDs for relation tables that lack a direct school_id
  const classIds = classes.map(c => c.id)
  const examIds = exams.map(e => e.id)

  // STEP 2: Safely fetch bridging tables using the extracted IDs
  let classSubjectsData: any[] = []
  if (classIds.length > 0) {
    const csRes = await supabase.schema('gps').from('class_subjects').select('*').in('class_id', classIds)
    if (!csRes.error && csRes.data) classSubjectsData = csRes.data
  }

  let examConfigsData: any[] = []
  let examMarksData: any[] = []
  if (examIds.length > 0) {
    const [configsRes, marksRes] = await Promise.all([
      supabase.schema('gps').from('exam_configurations').select('*').in('exam_id', examIds),
      supabase.schema('gps').from('exam_marks').select('*').in('exam_id', examIds)
    ])
    if (!configsRes.error && configsRes.data) examConfigsData = configsRes.data
    if (!marksRes.error && marksRes.data) examMarksData = marksRes.data
  }

  return {
    school: schoolRes.data,
    classes: classes,
    subjects: subjectsRes.data || [],
    classSubjects: classSubjectsData,
    schoolUsers: schoolUsersRes.data || [],
    teachers: teachersRes.data || [], 
    students: studentsRes.data || [],
    exams: exams,
    examConfigurations: examConfigsData,
    examMarks: examMarksData
  }
}

// ==================================================================
// GLOBAL SYSTEM RESTORE (Resurrect a Deleted School)
// ==================================================================
export async function restoreFullSchoolEnvironment(parsedData: any) {
  const supabase = await createClient()

  try {
    // 1. Restore School (Primary dependency)
    if (parsedData.school) {
      const { error } = await supabase.schema('gps').from('schools').insert(parsedData.school)
      if (error) throw new Error(`School Restore Error: ${error.message}`)
    }

    // 2. Restore Users (Independent of classes)
    if (parsedData.schoolUsers && parsedData.schoolUsers.length > 0) {
      const { error } = await supabase.schema('gps').from('school_users').insert(parsedData.schoolUsers)
      if (error) throw new Error(`Headmaster Restore Error: ${error.message}`)
    }

    if (parsedData.teachers && parsedData.teachers.length > 0) {
      const { error } = await supabase.schema('gps').from('teachers').insert(parsedData.teachers)
      if (error) throw new Error(`Teachers Restore Error: ${error.message}`)
    }
    
    // 3. Restore Base Academic Structure (Classes & Subjects)
    if (parsedData.classes && parsedData.classes.length > 0) {
      const { error } = await supabase.schema('gps').from('classes').insert(parsedData.classes)
      if (error) throw new Error(`Classes Restore Error: ${error.message}`)
    }

    if (parsedData.subjects && parsedData.subjects.length > 0) {
      const { error } = await supabase.schema('gps').from('subjects').insert(parsedData.subjects)
      if (error) throw new Error(`Subjects Restore Error: ${error.message}`)
    }

    // 4. Restore Class-Subject Mappings
    if (parsedData.classSubjects && parsedData.classSubjects.length > 0) {
      const { error } = await supabase.schema('gps').from('class_subjects').insert(parsedData.classSubjects)
      if (error) throw new Error(`Class-Subjects Restore Error: ${error.message}`)
    }

    // 5. Restore Students (Depends on Classes)
    if (parsedData.students && parsedData.students.length > 0) {
      const { error } = await supabase.schema('gps').from('students').insert(parsedData.students)
      if (error) throw new Error(`Students Restore Error: ${error.message}`)
    }

    // 6. Restore Exams (Depends on Classes)
    if (parsedData.exams && parsedData.exams.length > 0) {
      const { error } = await supabase.schema('gps').from('exams').insert(parsedData.exams)
      if (error) throw new Error(`Exams Restore Error: ${error.message}`)
    }

    // 7. Restore Exam Configurations (Depends on Exams, Classes, Subjects)
    if (parsedData.examConfigurations && parsedData.examConfigurations.length > 0) {
      const { error } = await supabase.schema('gps').from('exam_configurations').insert(parsedData.examConfigurations)
      if (error) throw new Error(`Exam Configs Restore Error: ${error.message}`)
    }

    // 8. Restore Exam Marks (Depends on Exams, Students, Subjects)
    if (parsedData.examMarks && parsedData.examMarks.length > 0) {
      const { error } = await supabase.schema('gps').from('exam_marks').insert(parsedData.examMarks)
      if (error) throw new Error(`Exam Marks Restore Error: ${error.message}`)
    }

    revalidatePath('/platform-dashboard')
    return { success: true }
    
  } catch (err: any) {
    console.error("Full Restore Error:", err)
    return { success: false, error: err.message }
  }
}