import { loginSchoolUser } from '@/app/auth/actions'

// Await searchParams for Next.js 15+ compatibility
export default async function SchoolLoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const resolvedParams = await searchParams
  const { error } = resolvedParams

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-6">School Portal Login</h1>
        
        {/* Graceful Error Display */}
        {error === 'invalid' && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200">
            Invalid username or password. Please try again.
          </div>
        )}
        {error === 'suspended' && (
          <div className="mb-4 p-3 bg-yellow-50 text-yellow-800 text-sm rounded-md border border-yellow-200">
            Your account has been suspended. Contact the Platform Admin.
          </div>
        )}

        <form action={loginSchoolUser} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700">Username</label>
            <input 
              type="text" 
              name="username" 
              required 
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input 
              type="password" 
              name="password" 
              required 
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            />
          </div>

          <button type="submit" className="w-full bg-blue-900 text-white p-2 rounded-md hover:bg-blue-800 transition-colors font-medium">
            Sign In
          </button>
        </form>
      </div>
    </main>
  )
}