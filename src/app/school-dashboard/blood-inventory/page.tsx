import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { decrypt } from '@/lib/auth/jwt'
import { createClient } from '@/lib/supabase/server'
import BloodInventoryClient from './BloodInventoryClient'

export const dynamic = 'force-dynamic'

export default async function BloodInventoryPage() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('school_session')?.value

  if (!sessionCookie) redirect('/login')

  const sessionData = await decrypt(sessionCookie)
  if (!sessionData) redirect('/login')

  const supabase = await createClient()

  // Fetch all demographic data concurrently
  const [
    { data: headTeacher },
    { data: teachers },
    { data: students },
    { data: classes }
  ] = await Promise.all([
    supabase.schema('gps').from('school_users').select('id, full_name, blood_group').eq('id', sessionData.userId).single(),
    supabase.schema('gps').from('teachers').select('id, full_name, blood_group').eq('school_id', sessionData.schoolId),
    supabase.schema('gps').from('students').select('id, first_name, last_name, blood_group, class_id').eq('school_id', sessionData.schoolId),
    supabase.schema('gps').from('classes').select('id, name').eq('school_id', sessionData.schoolId)
  ])

  // Normalize the data into a single unified array for the client component
  const unifiedData = []

  // 1. Add Head Teacher
  if (headTeacher) {
    unifiedData.push({
      id: `ht-${headTeacher.id}`,
      name: headTeacher.full_name,
      role: 'Headmaster',
      bloodGroup: headTeacher.blood_group || 'Unrecorded',
      details: 'Administration'
    })
  }

  // 2. Add Teachers
  if (teachers) {
    teachers.forEach(t => {
      unifiedData.push({
        id: `t-${t.id}`,
        name: t.full_name,
        role: 'Faculty',
        bloodGroup: t.blood_group || 'Unrecorded',
        details: 'Staff Member'
      })
    })
  }

  // 3. Add Students
  if (students) {
    students.forEach(s => {
      const studentClass = classes?.find(c => String(c.id) === String(s.class_id))
      unifiedData.push({
        id: `s-${s.id}`,
        name: `${s.first_name} ${s.last_name}`,
        role: 'Student',
        bloodGroup: s.blood_group || 'Unrecorded',
        details: studentClass ? `Class: ${studentClass.name}` : 'Unassigned'
      })
    })
  }

  return (
    <main className="min-h-screen bg-stone-50 p-6 md:p-8 font-sans text-stone-900 print:bg-white print:p-0">
      <div className="max-w-7xl mx-auto">
        <BloodInventoryClient initialData={unifiedData} />
      </div>
    </main>
  )
}