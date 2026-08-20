import { loginMasterUser } from '@/app/auth/actions'

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">
          Platform Admin
        </h1>
        <p className="text-sm text-gray-500 mb-6 text-center">
          Sign in to manage the GPS network.
        </p>
        
        <form action={loginMasterUser} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email Address</label>
            <input 
              type="email" 
              name="email" 
              required 
              placeholder="admin@platform.com"
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input 
              type="password" 
              name="password" 
              required 
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
            />
          </div>

          <button 
            type="submit" 
            className="mt-6 w-full bg-blue-900 text-white p-2 rounded-md hover:bg-blue-800 transition-colors font-medium"
          >
            Sign In
          </button>
        </form>
      </div>
    </main>
  )
}