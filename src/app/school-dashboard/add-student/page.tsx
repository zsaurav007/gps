import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { decrypt } from '@/lib/auth/jwt'
import { createClient } from '@/lib/supabase/server'
import AddStudentForm from './AddStudentForm'

export default async function AddStudentPage() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('school_session')?.value
  if (!sessionCookie) redirect('/login')

  const sessionData = await decrypt(sessionCookie)
  if (!sessionData) redirect('/login')

  const supabase = await createClient()

  // Fetch classes to populate the dropdown
  const { data: classes } = await supabase
    .schema('gps')
    .from('classes')
    .select('id, name')
    .eq('school_id', sessionData.schoolId)
    .order('name', { ascending: true })

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <div className="flex justify-between items-center bg-white p-6 rounded-lg shadow-sm border-t-4 border-blue-900">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Add New Student</h1>
            <p className="text-sm text-gray-500 mt-1">Enroll a student and assign them to a class.</p>
          </div>
          <Link href="/school-dashboard/students" className="text-sm text-blue-600 hover:underline">
            &larr; Student Directory
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <AddStudentForm schoolId={sessionData.schoolId} classes={classes || []} />
        </div>

      </div>
    </main>
  )
}