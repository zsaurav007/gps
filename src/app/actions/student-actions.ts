'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Helper to fetch photo URL for client-side deletion
export async function getStudentPhotoUrl(studentId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .schema('gps')
    .from('students')
    .select('photo_url')
    .eq('id', studentId)
    .single()
  
  return data?.photo_url
}

export async function addStudent(formData: FormData) {
  const schoolId = formData.get('schoolId') as string
  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string
  const enrollmentId = formData.get('enrollmentId') as string
  const classId = formData.get('classId') as string
  const dateOfBirth = formData.get('dateOfBirth') as string
  const gender = formData.get('gender') as string
  const bloodGroup = formData.get('bloodGroup') as string
  const guardianName = formData.get('guardianName') as string
  const guardianPhone = formData.get('guardianPhone') as string
  const uploadedPhotoUrl = formData.get('uploadedPhotoUrl') as string | null

  const supabase = await createClient()

  try {
    const { error } = await supabase.schema('gps').from('students').insert({
      school_id: schoolId,
      first_name: firstName,
      last_name: lastName,
      enrollment_id: enrollmentId,
      class_id: classId,
      date_of_birth: dateOfBirth || null,
      gender: gender,
      blood_group: bloodGroup || null,
      guardian_name: guardianName,
      guardian_phone: guardianPhone,
      photo_url: uploadedPhotoUrl 
    })

    if (error) throw error
  } catch (err: any) {
    console.error("Database Insert Error:", err)
    if (err.code === '23505') {
      throw new Error(`A student with Enrollment ID ${enrollmentId} already exists in this class.`)
    }
    throw new Error(`Failed to create student: ${err.message}`)
  }

  revalidatePath('/school-dashboard', 'layout')
  return { success: true }
}

export async function updateStudent(formData: FormData) {
  const studentId = formData.get('studentId') as string
  const classId = formData.get('classId') as string
  const enrollmentId = formData.get('enrollmentId') as string
  const uploadedPhotoUrl = formData.get('uploadedPhotoUrl') as string | null
  const removePhoto = formData.get('removePhoto') === 'true'

  const supabase = await createClient()

  // STRICT VALIDATION: Check if the new Roll No is taken by SOMEONE ELSE in the same class
  const { data: existing } = await supabase.schema('gps').from('students')
    .select('id, first_name, last_name')
    .eq('class_id', classId)
    .eq('enrollment_id', enrollmentId)
    .neq('id', studentId) // Exclude the current student from the check!

  if (existing && existing.length > 0) {
    throw new Error(`Roll No ${enrollmentId} is already assigned to ${existing[0].first_name} ${existing[0].last_name} in this class.`)
  }

  const updatePayload: any = {
    first_name: formData.get('firstName'),
    last_name: formData.get('lastName'),
    enrollment_id: enrollmentId,
    class_id: classId,
    date_of_birth: formData.get('dateOfBirth') || null,
    gender: formData.get('gender'),
    blood_group: formData.get('bloodGroup') || null,
    guardian_name: formData.get('guardianName'),
    guardian_phone: formData.get('guardianPhone'),
  }

  if (uploadedPhotoUrl) {
    updatePayload.photo_url = uploadedPhotoUrl
  } else if (removePhoto) {
    updatePayload.photo_url = null 
  }

  const { error } = await supabase
    .schema('gps')
    .from('students')
    .update(updatePayload)
    .eq('id', studentId)

  if (error) {
    if (error.code === '23505') throw new Error(`Enrollment ID already in use for this class.`)
    throw new Error(`Failed to update student: ${error.message}`)
  }

  revalidatePath('/school-dashboard', 'layout')
  return { success: true }
}

export async function deleteStudent(formData: FormData) {
  const studentId = formData.get('studentId') as string
  const supabase = await createClient()

  const { error } = await supabase
    .schema('gps')
    .from('students')
    .delete()
    .eq('id', studentId)

  if (error) throw new Error(`Failed to delete student from database: ${error.message}`)

  revalidatePath('/school-dashboard', 'layout')
}

export async function removeStudentPhotoInstant(studentId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .schema('gps')
    .from('students')
    .update({ photo_url: null })
    .eq('id', studentId)

  if (error) throw new Error(`Failed to wipe DB photo url: ${error.message}`)

  revalidatePath('/school-dashboard', 'layout')
  return { success: true }
}

// BULK ADD STUDENTS
export async function addBulkStudents(schoolId: string, classId: string, students: any[]) {
  const supabase = await createClient()

  const payload = students.map(s => ({
    school_id: schoolId,
    class_id: classId,
    first_name: s.firstName,
    last_name: s.lastName || '',
    enrollment_id: s.enrollmentId,
    date_of_birth: s.dateOfBirth || null,
    gender: s.gender || null,
    blood_group: s.bloodGroup || null,
    guardian_name: s.guardianName || null,
    guardian_phone: s.guardianPhone || null,
  }))

  const { error } = await supabase.schema('gps')
    .from('students')
    .insert(payload)

  if (error) throw new Error(`Failed to insert bulk students: ${error.message}`)

  revalidatePath('/school-dashboard/students', 'layout')
  return { success: true }
}

// VALIDATE ROLL NUMBERS (Checks who already owns the roll)
export async function validateRollNumbers(classId: string, rollNumbers: string[]) {
  const supabase = await createClient()
  const { data } = await supabase.schema('gps').from('students')
    .select('enrollment_id, first_name, last_name')
    .eq('class_id', classId)
    .in('enrollment_id', rollNumbers)
  return data || []
}

// BULK DELETE STUDENTS
export async function deleteStudentsBulk(studentIds: string[]) {
  const supabase = await createClient()
  
  // FIXED: Changed studentId to studentIds
  const { error } = await supabase.schema('gps').from('students')
    .delete()
    .in('id', studentIds)

  if (error) throw new Error(`Failed to delete students: ${error.message}`)
  
  revalidatePath('/school-dashboard', 'layout')
  return { success: true }
}