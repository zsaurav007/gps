'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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

const parseDate = (dateStr: string | null) => (dateStr ? dateStr : null)

export async function addStudent(formData: FormData) {
  const schoolId = formData.get('schoolId') as string
  const classId = formData.get('classId') as string
  const enrollmentId = formData.get('enrollmentId') as string
  const uploadedPhotoUrl = formData.get('uploadedPhotoUrl') as string | null

  const payload = {
    school_id: schoolId,
    class_id: classId,
    enrollment_id: enrollmentId,
    photo_url: uploadedPhotoUrl,

    // 1. Basic Info
    first_name: formData.get('studentNameEn') as string, 
    last_name: '', 
    name_bangla: formData.get('nameBangla') as string || null,
    birth_reg_no: formData.get('birthRegNo') as string || null,
    date_of_birth: parseDate(formData.get('dateOfBirth') as string),
    gender: formData.get('gender') as string || null,
    blood_group: formData.get('bloodGroup') as string || null,
    village: formData.get('village') as string || null,
    post_office: formData.get('postOffice') as string || null,
    post_code: formData.get('postCode') as string || null,
    upazila: formData.get('upazila') as string || null,
    district: formData.get('district') as string || null, // REMOVED BOGURA DEFAULT
    admission_year: formData.get('admissionYear') as string || null,
    previous_roll: formData.get('previousRoll') as string || null,

    // 2. Father's Info
    father_name_bn: formData.get('fatherNameBn') as string || null,
    father_name_en: formData.get('fatherNameEn') as string || null,
    father_edu: formData.get('fatherEdu') as string || null,
    father_father_name: formData.get('fatherFatherName') as string || null,
    father_mother_name: formData.get('fatherMotherName') as string || null,
    father_nid: formData.get('fatherNid') as string || null,
    father_dob: parseDate(formData.get('fatherDob') as string),
    father_mobile: formData.get('fatherMobile') as string || null,
    father_mobile_banking: formData.get('fatherMobileBanking') as string || null,
    father_village: formData.get('fatherVillage') as string || null,
    father_post_office: formData.get('fatherPostOffice') as string || null,
    father_post_code: formData.get('fatherPostCode') as string || null,
    father_upazila: formData.get('fatherUpazila') as string || null,
    father_district: formData.get('fatherDistrict') as string || null,

    // 3. Mother's Info
    mother_name_bn: formData.get('motherNameBn') as string || null,
    mother_name_en: formData.get('motherNameEn') as string || null,
    mother_edu: formData.get('motherEdu') as string || null,
    mother_father_name: formData.get('motherFatherName') as string || null,
    mother_mother_name: formData.get('motherMotherName') as string || null,
    mother_nid: formData.get('motherNid') as string || null,
    mother_dob: parseDate(formData.get('motherDob') as string),
    mother_mobile: formData.get('motherMobile') as string || null,
    mother_mobile_banking: formData.get('motherMobileBanking') as string || null,
    mother_village: formData.get('motherVillage') as string || null,
    mother_post_office: formData.get('motherPostOffice') as string || null,
    mother_post_code: formData.get('motherPostCode') as string || null,
    mother_upazila: formData.get('motherUpazila') as string || null,
    mother_district: formData.get('motherDistrict') as string || null,

    // 4. Guardian's Info
    guardian_name_bn: formData.get('guardianNameBn') as string || null,
    guardian_name_en: formData.get('guardianNameEn') as string || null,
    guardian_relation: formData.get('guardianRelation') as string || null,
    guardian_edu: formData.get('guardianEdu') as string || null,
    guardian_nid: formData.get('guardianNid') as string || null,
    guardian_dob: parseDate(formData.get('guardianDob') as string),
    guardian_mobile: formData.get('guardianMobile') as string || null,
    guardian_mobile_banking: formData.get('guardianMobileBanking') as string || null,
    guardian_village: formData.get('guardianVillage') as string || null,
    guardian_post_office: formData.get('guardianPostOffice') as string || null,
    guardian_post_code: formData.get('guardianPostCode') as string || null,
    guardian_upazila: formData.get('guardianUpazila') as string || null,
    guardian_district: formData.get('guardianDistrict') as string || null,

    // Fallbacks
    guardian_name: formData.get('guardianNameEn') as string || formData.get('guardianNameBn') as string || null,
    guardian_phone: formData.get('guardianMobile') as string || null,
  }

  const supabase = await createClient()

  try {
    const { error } = await supabase.schema('gps').from('students').insert(payload)
    if (error) throw error
  } catch (err: any) {
    if (err.code === '23505') {
      throw new Error(`A student with Roll No ${enrollmentId} already exists in this class.`)
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

  const { data: existing } = await supabase.schema('gps').from('students')
    .select('id, first_name, last_name')
    .eq('class_id', classId)
    .eq('enrollment_id', enrollmentId)
    .neq('id', studentId)

  if (existing && existing.length > 0) {
    throw new Error(`Roll No ${enrollmentId} is already assigned to ${existing[0].first_name} in this class.`)
  }

  const updatePayload: any = {
    class_id: classId,
    enrollment_id: enrollmentId,

    // 1. Basic Info
    first_name: formData.get('studentNameEn') as string,
    last_name: '',
    name_bangla: formData.get('nameBangla') as string || null,
    birth_reg_no: formData.get('birthRegNo') as string || null,
    date_of_birth: parseDate(formData.get('dateOfBirth') as string),
    gender: formData.get('gender') as string || null,
    blood_group: formData.get('bloodGroup') as string || null,
    village: formData.get('village') as string || null,
    post_office: formData.get('postOffice') as string || null,
    post_code: formData.get('postCode') as string || null,
    upazila: formData.get('upazila') as string || null,
    district: formData.get('district') as string || null, // REMOVED BOGURA DEFAULT
    admission_year: formData.get('admissionYear') as string || null,
    previous_roll: formData.get('previousRoll') as string || null,

    // 2. Father's Info
    father_name_bn: formData.get('fatherNameBn') as string || null,
    father_name_en: formData.get('fatherNameEn') as string || null,
    father_edu: formData.get('fatherEdu') as string || null,
    father_father_name: formData.get('fatherFatherName') as string || null,
    father_mother_name: formData.get('fatherMotherName') as string || null,
    father_nid: formData.get('fatherNid') as string || null,
    father_dob: parseDate(formData.get('fatherDob') as string),
    father_mobile: formData.get('fatherMobile') as string || null,
    father_mobile_banking: formData.get('fatherMobileBanking') as string || null,
    father_village: formData.get('fatherVillage') as string || null,
    father_post_office: formData.get('fatherPostOffice') as string || null,
    father_post_code: formData.get('fatherPostCode') as string || null,
    father_upazila: formData.get('fatherUpazila') as string || null,
    father_district: formData.get('fatherDistrict') as string || null,

    // 3. Mother's Info
    mother_name_bn: formData.get('motherNameBn') as string || null,
    mother_name_en: formData.get('motherNameEn') as string || null,
    mother_edu: formData.get('motherEdu') as string || null,
    mother_father_name: formData.get('motherFatherName') as string || null,
    mother_mother_name: formData.get('motherMotherName') as string || null,
    mother_nid: formData.get('motherNid') as string || null,
    mother_dob: parseDate(formData.get('motherDob') as string),
    mother_mobile: formData.get('motherMobile') as string || null,
    mother_mobile_banking: formData.get('motherMobileBanking') as string || null,
    mother_village: formData.get('motherVillage') as string || null,
    mother_post_office: formData.get('motherPostOffice') as string || null,
    mother_post_code: formData.get('motherPostCode') as string || null,
    mother_upazila: formData.get('motherUpazila') as string || null,
    mother_district: formData.get('motherDistrict') as string || null,

    // 4. Guardian's Info
    guardian_name_bn: formData.get('guardianNameBn') as string || null,
    guardian_name_en: formData.get('guardianNameEn') as string || null,
    guardian_relation: formData.get('guardianRelation') as string || null,
    guardian_edu: formData.get('guardianEdu') as string || null,
    guardian_nid: formData.get('guardianNid') as string || null,
    guardian_dob: parseDate(formData.get('guardianDob') as string),
    guardian_mobile: formData.get('guardianMobile') as string || null,
    guardian_mobile_banking: formData.get('guardianMobileBanking') as string || null,
    guardian_village: formData.get('guardianVillage') as string || null,
    guardian_post_office: formData.get('guardianPostOffice') as string || null,
    guardian_post_code: formData.get('guardianPostCode') as string || null,
    guardian_upazila: formData.get('guardianUpazila') as string || null,
    guardian_district: formData.get('guardianDistrict') as string || null,

    // Fallbacks
    guardian_name: formData.get('guardianNameEn') as string || formData.get('guardianNameBn') as string || null,
    guardian_phone: formData.get('guardianMobile') as string || null,
  }

  if (uploadedPhotoUrl) {
    updatePayload.photo_url = uploadedPhotoUrl
  } else if (removePhoto) {
    updatePayload.photo_url = null 
  }

  const { error } = await supabase.schema('gps').from('students').update(updatePayload).eq('id', studentId)

  if (error) {
    if (error.code === '23505') throw new Error(`Roll No already in use for this class.`)
    throw new Error(`Failed to update student: ${error.message}`)
  }

  revalidatePath('/school-dashboard', 'layout')
  return { success: true }
}

export async function deleteStudent(formData: FormData) {
  const studentId = formData.get('studentId') as string
  const supabase = await createClient()

  const { error } = await supabase.schema('gps').from('students').delete().eq('id', studentId)
  if (error) throw new Error(`Failed to delete student from database: ${error.message}`)

  revalidatePath('/school-dashboard', 'layout')
}

export async function removeStudentPhotoInstant(studentId: string) {
  const supabase = await createClient()
  const { error } = await supabase.schema('gps').from('students').update({ photo_url: null }).eq('id', studentId)
  if (error) throw new Error(`Failed to wipe DB photo url: ${error.message}`)

  revalidatePath('/school-dashboard', 'layout')
  return { success: true }
}

export async function addBulkStudents(schoolId: string, classId: string, students: any[]) {
  const supabase = await createClient()

  const payload = students.map(s => ({
    school_id: schoolId,
    class_id: classId,
    first_name: s.studentNameEn || s.firstName,
    last_name: '', 
    enrollment_id: s.enrollmentId,
    date_of_birth: s.dateOfBirth || null,
    gender: s.gender || null,
    blood_group: s.bloodGroup || null,
    guardian_name: s.guardianName || null,
    guardian_phone: s.guardianPhone || null,
  }))

  const { error } = await supabase.schema('gps').from('students').insert(payload)
  if (error) throw new Error(`Failed to insert bulk students: ${error.message}`)

  revalidatePath('/school-dashboard/students', 'layout')
  return { success: true }
}

export async function validateRollNumbers(classId: string, rollNumbers: string[]) {
  const supabase = await createClient()
  const { data } = await supabase.schema('gps').from('students')
    .select('enrollment_id, first_name, last_name')
    .eq('class_id', classId)
    .in('enrollment_id', rollNumbers)
  return data || []
}

export async function deleteStudentsBulk(studentIds: string[]) {
  const supabase = await createClient()
  const { error } = await supabase.schema('gps').from('students').delete().in('id', studentIds)
  if (error) throw new Error(`Failed to delete students: ${error.message}`)
  
  revalidatePath('/school-dashboard', 'layout')
  return { success: true }
}