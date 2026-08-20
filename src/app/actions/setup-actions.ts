'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// --- HOLIDAY ACTIONS ---
export async function updateHolidays(formData: FormData) {
  const schoolId = formData.get('schoolId') as string
  const holidays = formData.getAll('holidays') as string[]
  
  const supabase = await createClient()

  const { error } = await supabase
    .schema('gps')
    .from('school_settings')
    .upsert({ 
      school_id: schoolId, 
      weekly_holidays: holidays,
      updated_at: new Date().toISOString()
    }, { onConflict: 'school_id' })

  if (error) throw new Error(`DB Error (Holidays): ${error.message}`)
  revalidatePath('/school-dashboard/setup')
}

// --- CLASS ACTIONS ---
export async function addClassRecord(formData: FormData) {
  const schoolId = formData.get('schoolId') as string
  const name = formData.get('className') as string
  const periods = parseInt(formData.get('periodsPerDay') as string) || 6
  const supabase = await createClient()
  const { error } = await supabase.schema('gps').from('classes').insert({ school_id: schoolId, name, periods_per_day: periods })
  if (error) throw new Error(`DB Error (Class): ${error.message}`)
  revalidatePath('/school-dashboard/setup')
}

export async function updateClassRecord(formData: FormData) {
  const classId = formData.get('classId') as string
  const name = formData.get('className') as string
  const periods = parseInt(formData.get('periodsPerDay') as string) || 6
  const supabase = await createClient()
  const { error } = await supabase.schema('gps').from('classes').update({ name, periods_per_day: periods }).eq('id', classId)
  if (error) throw new Error(`DB Error (Update Class): ${error.message}`)
  revalidatePath('/school-dashboard/setup')
}

export async function deleteClassRecord(formData: FormData) {
  const classId = formData.get('classId') as string
  const supabase = await createClient()
  const { error } = await supabase.schema('gps').from('classes').delete().eq('id', classId)
  if (error) throw new Error(`DB Error (Delete Class): ${error.message}`)
  revalidatePath('/school-dashboard/setup')
}

// --- SUBJECT ACTIONS ---
export async function addSubjectRecord(formData: FormData) {
  const schoolId = formData.get('schoolId') as string
  const name = formData.get('subjectName') as string
  const supabase = await createClient()
  const { error } = await supabase.schema('gps').from('subjects').insert({ school_id: schoolId, name })
  if (error) throw new Error(`DB Error (Subject): ${error.message}`)
  revalidatePath('/school-dashboard/setup')
}

export async function updateSubjectRecord(formData: FormData) {
  const subjectId = formData.get('subjectId') as string
  const newName = formData.get('subjectName') as string
  const oldName = formData.get('oldSubjectName') as string
  const schoolId = formData.get('schoolId') as string
  const supabase = await createClient()

  const { error } = await supabase.schema('gps').from('subjects').update({ name: newName }).eq('id', subjectId)
  if (error) throw new Error(`DB Error (Update Subject): ${error.message}`)

  // Clean up Teacher Strings: If the subject name changed, update the teachers who teach it
  if (oldName && oldName !== newName) {
    const { data: teachers } = await supabase.schema('gps').from('teachers').select('id, subjects_taught').eq('school_id', schoolId)
    if (teachers) {
      for (const t of teachers) {
        if (t.subjects_taught) {
          const subjectsArr = t.subjects_taught.split(',').map((s: string) => s.trim())
          if (subjectsArr.includes(oldName)) {
            const updatedSubjects = subjectsArr.map((s: string) => s === oldName ? newName : s).join(', ')
            await supabase.schema('gps').from('teachers').update({ subjects_taught: updatedSubjects }).eq('id', t.id)
          }
        }
      }
    }
  }

  revalidatePath('/school-dashboard/setup')
  revalidatePath('/school-dashboard/teachers')
}

export async function deleteSubjectRecord(formData: FormData) {
  const subjectId = formData.get('subjectId') as string
  const subjectName = formData.get('subjectName') as string
  const schoolId = formData.get('schoolId') as string
  const supabase = await createClient()

  const { error } = await supabase.schema('gps').from('subjects').delete().eq('id', subjectId)
  if (error) throw new Error(`DB Error (Delete Subject): ${error.message}`)

  // Clean up Teacher Strings: Remove the deleted subject from their profiles
  if (subjectName) {
    const { data: teachers } = await supabase.schema('gps').from('teachers').select('id, subjects_taught').eq('school_id', schoolId)
    if (teachers) {
      for (const t of teachers) {
        if (t.subjects_taught) {
          const subjectsArr = t.subjects_taught.split(',').map((s: string) => s.trim())
          if (subjectsArr.includes(subjectName)) {
            const updatedSubjects = subjectsArr.filter((s: string) => s !== subjectName).join(', ')
            await supabase.schema('gps').from('teachers').update({ subjects_taught: updatedSubjects }).eq('id', t.id)
          }
        }
      }
    }
  }

  revalidatePath('/school-dashboard/setup')
  revalidatePath('/school-dashboard/teachers')
}
// SMART SUBJECT CREATOR & MAPPER
export async function addSubjectToClass(formData: FormData) {
  const schoolId = formData.get('schoolId') as string
  const classId = formData.get('classId') as string
  const subjectName = formData.get('subjectName') as string

  const supabase = await createClient()

  // 1. Check if the subject already exists globally for this school
  let subjectId = null
  const { data: existingSub } = await supabase.schema('gps')
    .from('subjects')
    .select('id')
    .eq('school_id', schoolId)
    .ilike('name', subjectName) // Case-insensitive check
    .maybeSingle()

  if (existingSub) {
    subjectId = existingSub.id
  } else {
    // 2. If it doesn't exist, create it in the global subjects table
    const { data: newSub, error: subErr } = await supabase.schema('gps')
      .from('subjects')
      .insert({ school_id: schoolId, name: subjectName })
      .select('id')
      .single()
      
    if (subErr) throw new Error(`Failed to create global subject: ${subErr.message}`)
    subjectId = newSub.id
  }

  // 3. Map the subject to this specific class
  const { error: mapErr } = await supabase.schema('gps')
    .from('class_subjects')
    .insert({ class_id: classId, subject_id: subjectId })

  // Code 23505 means it's already mapped, which is fine, we just ignore the error
  if (mapErr && mapErr.code !== '23505') {
    throw new Error(`Failed to map subject to class: ${mapErr.message}`)
  }

  revalidatePath('/school-dashboard/setup', 'layout')
  return { success: true }
}

// REMOVE SUBJECT FROM A SPECIFIC CLASS
export async function removeSubjectFromClass(formData: FormData) {
  const classId = formData.get('classId') as string
  const subjectId = formData.get('subjectId') as string

  const supabase = await createClient()

  const { error } = await supabase.schema('gps')
    .from('class_subjects')
    .delete()
    .match({ class_id: classId, subject_id: subjectId })

  if (error) throw new Error(`Failed to remove subject from class: ${error.message}`)

  revalidatePath('/school-dashboard/setup', 'layout')
  return { success: true }
}