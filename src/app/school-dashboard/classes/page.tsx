import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { decrypt } from '@/lib/auth/jwt'
import { createClient } from '@/lib/supabase/server'
import AddClassForm from './AddClassForm'

// @ts-expect-error - TS2306: Bypassing "is not a module" until ClassSubjectManager.tsx is fixed
import ClassSubjectManager from './ClassSubjectManager'

// ---------------------------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------------------------

export interface SessionData {
  schoolId: string | number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface Subject {
  id: string | number;
  name: string;
}

export interface ClassData {
  id: string | number;
  // Accommodates the select('*') while ensuring 'id' is known to TypeScript
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; 
}

export interface ClassSubjectMapping {
  class_id: string | number;
  subject_id: string | number;
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default async function ClassesMappingPage() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('school_session')?.value
  if (!sessionCookie) redirect('/login')

  // Cast the decrypted payload so TypeScript knows schoolId exists
  const sessionData = (await decrypt(sessionCookie)) as SessionData | null
  if (!sessionData || !sessionData.schoolId) redirect('/login')

  const supabase = await createClient()

  // 1. Fetch all subjects for this school
  const { data: allSubjects } = (await supabase
    .schema('gps')
    .from('subjects')
    .select('id, name')
    .eq('school_id', sessionData.schoolId)) as { data: Subject[] | null }

  // 2. Fetch all classes for this school
  const { data: classes } = (await supabase
    .schema('gps')
    .from('classes')
    .select('*')
    .eq('school_id', sessionData.schoolId)
    .order('created_at', { ascending: true })) as { data: ClassData[] | null }

  // 3. Fetch the mapping table
  const { data: mappings } = (await supabase
    .schema('gps')
    .from('class_subjects')
    .select('class_id, subject_id')) as { data: ClassSubjectMapping[] | null }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-6 rounded-lg shadow-sm border-t-4 border-blue-900">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Class & Syllabus Mapping</h1>
            <p className="text-sm text-gray-500 mt-1">Create classes and assign subjects to their curriculum.</p>
          </div>
          <Link href="/school-dashboard" className="text-sm text-blue-600 hover:underline">
            &larr; Back to Dashboard
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Left Column: Add New Class Form */}
          <div className="lg:col-span-1">
            {/* Convert schoolId to string if your AddClassForm expects a string strictly */}
            <AddClassForm schoolId={String(sessionData.schoolId)} />
          </div>

          {/* Right Column: Class Mapping Grid */}
          <div className="lg:col-span-2">
            {classes && classes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {classes.map((cls) => {
                  // Figure out which subjects are mapped to this specific class
                  const assignedIds = mappings
                    ?.filter(m => String(m.class_id) === String(cls.id))
                    .map(m => m.subject_id) || []

                  return (
                    <ClassSubjectManager 
                      key={cls.id}
                      classData={cls}
                      allSubjects={allSubjects || []}
                      assignedSubjectIds={assignedIds}
                    />
                  )
                })}
              </div>
            ) : (
              <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-100 text-center">
                <p className="text-gray-500">No classes have been created yet.</p>
                <p className="text-sm text-gray-400 mt-1">Use the form on the left to add your first class.</p>
              </div>
            )}
          </div>
          
        </div>
      </div>
    </main>
  )
}