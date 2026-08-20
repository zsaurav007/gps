'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. CREATE A NEW CLASS
export async function addClass(formData: FormData) {
  const schoolId = formData.get('schoolId') as string
  const name = formData.get('name') as string
  const periodsPerDay = formData.get('periodsPerDay') 

  const supabase = await createClient()

  const { error } = await supabase
    .schema('gps')
    .from('classes')
    .insert({
      school_id: schoolId,
      name: name,
      // Default to 6 if the user doesn't specify
      periods_per_day: periodsPerDay ? parseInt(periodsPerDay as string) : 6, 
    })

  if (error) throw new Error(`Failed to create class: ${error.message}`)

  revalidatePath('/school-dashboard', 'layout')
  return { success: true }
}

// 2. DELETE A CLASS
export async function deleteClass(formData: FormData) {
  const classId = formData.get('classId') as string
  const supabase = await createClient()

  const { error } = await supabase
    .schema('gps')
    .from('classes')
    .delete()
    .eq('id', classId)

  if (error) throw new Error(`Failed to delete class: ${error.message}`)

  revalidatePath('/school-dashboard', 'layout')
  return { success: true }
}

// 3. ASSIGN A SUBJECT TO A CLASS
export async function assignSubject(formData: FormData) {
  const classId = formData.get('classId') as string
  const subjectId = formData.get('subjectId') as string

  const supabase = await createClient()

  const { error } = await supabase
    .schema('gps')
    .from('class_subjects')
    .insert({
      class_id: classId,
      subject_id: subjectId,
    })

  // Code 23505 is a Postgres error for a duplicate primary key
  if (error?.code === '23505') {
    throw new Error('This subject is already assigned to this class.')
  }
  if (error) throw new Error(`Failed to assign subject: ${error.message}`)

  revalidatePath('/school-dashboard', 'layout')
  return { success: true }
}

// 4. REMOVE A SUBJECT FROM A CLASS
// Since this table uses a composite primary key (class_id + subject_id), we pass both to delete
export async function removeSubject(classId: string, subjectId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .schema('gps')
    .from('class_subjects')
    .delete()
    .match({ class_id: classId, subject_id: subjectId })

  if (error) throw new Error(`Failed to remove subject: ${error.message}`)

  revalidatePath('/school-dashboard', 'layout')
  return { success: true }
}