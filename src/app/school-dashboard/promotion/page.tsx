import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { decrypt } from '@/lib/auth/jwt'
import { createClient } from '@/lib/supabase/server'
import PromotionClient from './PromotionClient'

export default async function PromotionPage() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('school_session')?.value
  if (!sessionCookie) redirect('/login')

  const sessionData = await decrypt(sessionCookie)
  if (!sessionData) redirect('/login')

  const supabase = await createClient()

  const { data: classes } = await supabase
    .schema('gps')
    .from('classes')
    .select('id, name')
    .eq('school_id', sessionData.schoolId)
    .order('name')

  return (
    <main className="min-h-screen bg-stone-50 p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="bg-white p-6 md:p-8 rounded-sm shadow-sm border border-stone-200 border-t-4 border-t-[#6b4c9a]">
          <h1 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">
            Student Promotion Engine
          </h1>
          <p className="text-sm font-medium text-stone-600 mt-2">
            Mass-promote students to the next academic year. Uncheck students who are repeating the year, and assign new roll numbers instantly.
          </p>
        </div>

        <PromotionClient schoolId={sessionData.schoolId} classes={classes || []} />

      </div>
    </main>
  )
}