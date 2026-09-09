'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getRoutineInitialData(schoolId: string) {
  const supabase = await createClient()

  // Fetch all necessary tables in parallel, including head_teachers
  const [
    { data: classes },
    { data: subjects },
    { data: teachers },
    { data: headTeachers },
    { data: classSubjects }
  ] = await Promise.all([
    supabase.schema('gps').from('classes').select('id, name, periods_per_day').eq('school_id', schoolId).order('name', { ascending: true }),
    supabase.schema('gps').from('subjects').select('id, name').eq('school_id', schoolId).order('name', { ascending: true }),
    supabase.schema('gps').from('teachers').select('id, full_name').eq('school_id', schoolId),
    supabase.schema('gps').from('head_teachers').select('id, full_name').eq('school_id', schoolId),
    supabase.schema('gps').from('class_subjects').select('class_id, subject_id')
  ])

  // Combine head teachers and regular teachers into one array
  const allTeachers = [
    ...(headTeachers || []),
    ...(teachers || [])
  ].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))

  return {
    dbClasses: classes || [],
    dbSubjects: subjects || [],
    dbTeachers: allTeachers, // We pass the combined list here
    dbClassSubjects: classSubjects || [],
    dbRequirements: [],
    dbQualifications: [],
    dbPreferredAssignments: []
  }
}

// Function to safely delete records directly from the database
export async function deleteDatabaseRecord(table: 'classes' | 'subjects' | 'teachers', id: string) {
  const supabase = await createClient()
  
  const { error } = await supabase.schema('gps').from(table).delete().eq('id', id)
  
  if (error) {
    // 23503 is the Postgres code for Foreign Key Violation
    if (error.code === '23503') {
       return { success: false, error: `Cannot delete this item. It is locked because it is currently being used in active student records, exams, or marks. Please remove those connections first.` }
    }
    return { success: false, error: error.message }
  }
  
  revalidatePath('/school-dashboard/routine')
  return { success: true }
}