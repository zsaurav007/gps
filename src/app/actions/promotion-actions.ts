'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function fetchStudentsForPromotion(schoolId: string, classId: string) {
  const supabase = await createClient()
  
  // Sort by current roll number by default, treating it as a numeric value if possible
  const { data, error } = await supabase
    .schema('gps')
    .from('students')
    .select('id, first_name, last_name, enrollment_id, photo_url, gender')
    .eq('school_id', schoolId)
    .eq('class_id', classId)
  
  if (error) throw new Error(`Failed to fetch students: ${error.message}`)

  // Sort numerically in memory to handle text-based roll numbers smartly
  const sortedData = (data || []).sort((a, b) => {
    return a.enrollment_id.localeCompare(b.enrollment_id, undefined, { numeric: true })
  })

  return sortedData
}

export async function promoteStudentsBulk(
  schoolId: string, 
  toClassId: string, 
  promotions: { id: string, newRoll: string }[]
) {
  const supabase = await createClient()

  // 1. Check for Roll Number collisions in the destination class
  const newRolls = promotions.map(p => p.newRoll)
  const { data: existing } = await supabase.schema('gps').from('students')
    .select('first_name, enrollment_id')
    .eq('class_id', toClassId)
    .in('enrollment_id', newRolls)

  if (existing && existing.length > 0) {
    throw new Error(`Collision! Roll No ${existing[0].enrollment_id} is already taken by ${existing[0].first_name} in the target class.`)
  }

  // 2. Perform Bulk Update
  // Supabase JS doesn't have a single bulk update array method yet, 
  // so we fire them concurrently which is perfectly fast for class-sized batches (< 200).
  const updatePromises = promotions.map(student => 
    supabase.schema('gps').from('students')
      .update({ 
        class_id: toClassId, 
        enrollment_id: student.newRoll 
      })
      .eq('id', student.id)
  )

  await Promise.all(updatePromises)

  // 3. Revalidate the caches so the directory updates instantly
  revalidatePath('/school-dashboard/promotion')
  revalidatePath('/school-dashboard/students')
  
  return { success: true }
}