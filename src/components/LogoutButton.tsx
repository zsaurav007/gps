import { logoutUser } from '@/app/auth/actions'

export default function LogoutButton() {
  return (
    <form action={logoutUser}>
      <button 
        type="submit" 
        className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors border border-red-100"
      >
        Log Out
      </button>
    </form>
  )
}