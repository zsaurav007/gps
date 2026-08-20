import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { decrypt } from '@/lib/auth/jwt'
import { createClient } from '@/lib/supabase/server'
import Sidebar from './Sidebar'

export default async function SchoolDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('school_session')?.value
  
  if (!sessionCookie) redirect('/login')
  
  const sessionData = await decrypt(sessionCookie)
  
  // Extract user ID (Handle whichever key you used in your JWT payload)
  const userId = sessionData?.userId || sessionData?.id 
  const schoolId = sessionData?.schoolId

  if (!userId || !schoolId) redirect('/login')

  const supabase = await createClient()

  // 1. Verify the User Status
  const { data: user, error: userError } = await supabase
    .schema('gps')
    .from('school_users')
    .select('is_active')
    .eq('id', userId)
    .single()

  if (userError || !user) {
    redirect('/api/auth/force-logout?reason=deleted')
  }

  if (user.is_active === false) {
    // Immediate kick for suspended users
    redirect('/api/auth/force-logout?reason=suspended')
  }

  // 2. Verify the School still exists
  const { data: school, error: schoolError } = await supabase
    .schema('gps')
    .from('schools')
    .select('id')
    .eq('id', schoolId)
    .single()

  if (schoolError || !school) {
    // Immediate kick to Global Not Found if school is deleted
    redirect('/api/auth/force-logout?reason=school_deleted')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 
        The Sidebar is fixed and handles its own logic. 
        We just drop it in the layout.
      */}
      <Sidebar />

      {/* 
        Main Content Wrapper 
        - On Mobile: Adds top padding to account for the mobile top-bar (pt-16)
        - On Desktop: Adds left padding to account for the collapsed sidebar (md:pl-20)
      */}
      <main className="flex-1 w-full pt-16 md:pt-0 md:pl-20 transition-all duration-300 ease-in-out">
        {children}
      </main>
    </div>
  )
}