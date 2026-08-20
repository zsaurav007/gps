'use client'

import { useState } from 'react'
import { verifyMasterAdmin, resetHeadmasterPassword } from '@/app/actions/user-actions'

export default function HeadmasterPasswordManager({ headmasterId }: { headmasterId: string }) {
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  
  const [newPassword, setNewPassword] = useState('')
  const [isResetting, setIsResetting] = useState(false)

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await verifyMasterAdmin(adminPassword)
      setIsUnlocked(true)
      setAdminPassword('')
    } catch (error: any) {
      alert(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPassword || newPassword.length < 6) {
      alert("Password must be at least 6 characters long.")
      return
    }
    
    setIsResetting(true)
    try {
      await resetHeadmasterPassword(headmasterId, newPassword)
      setNewPassword('')
      alert("Headmaster password updated successfully.")
      setIsUnlocked(false) // Auto re-lock for security
    } catch (error: any) {
      alert(error.message)
    } finally {
      setIsResetting(false)
    }
  }

  if (!isUnlocked) {
    return (
      <div className="bg-stone-50 border border-stone-200 rounded-sm p-6 mt-8 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <svg className="w-5 h-5 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
          <h3 className="text-xs font-bold text-stone-800 uppercase tracking-widest">Security Override</h3>
        </div>
        <p className="text-xs text-stone-600 mb-5 leading-relaxed">
          Headmaster credentials are mathematically hashed and hidden. Enter your Master Admin password to unlock the ability to force-reset this user's password.
        </p>
        
        <form onSubmit={handleVerify} className="flex flex-col sm:flex-row gap-3">
          <input 
            type="password" 
            placeholder="Master Admin Password..."
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            required
            className="flex-1 p-3.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 focus:outline-none focus:border-stone-500 focus:ring-1 focus:ring-stone-500 transition-all shadow-sm"
          />
          <button 
            type="submit" 
            disabled={isLoading || !adminPassword}
            className="bg-stone-800 text-white px-6 py-3.5 rounded-sm text-xs uppercase tracking-widest font-bold hover:bg-stone-900 transition-colors shadow-sm disabled:opacity-50 whitespace-nowrap"
          >
            {isLoading ? 'Verifying...' : 'Unlock Credentials'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="bg-white border border-[#6b4c9a]/30 rounded-sm p-6 mt-8 shadow-sm">
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-[#6b4c9a]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"></path></svg>
          <h3 className="text-xs font-bold text-[#6b4c9a] uppercase tracking-widest">Credentials Unlocked</h3>
        </div>
        <button onClick={() => setIsUnlocked(false)} className="text-[10px] uppercase tracking-widest font-bold text-stone-400 hover:text-stone-600 transition-colors">
          Re-Lock
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        {/* Current Password Display */}
        <div className="flex flex-col">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-2">
            Current Password
          </label>
          <div className="h-[46px] px-4 bg-stone-50 border border-stone-200 rounded-sm flex items-center justify-between shadow-inner">
            <span className="font-mono text-sm text-stone-400 font-bold tracking-wider">[ ENCRYPTED ]</span>
            <span className="text-[9px] uppercase tracking-widest text-emerald-600 font-bold bg-emerald-100/50 px-2.5 py-1 rounded-sm border border-emerald-200/50">Secure</span>
          </div>
        </div>

        {/* Reset Password Form */}
        <form onSubmit={handleReset} className="flex flex-col">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-2">
            Set New Password
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text" 
              placeholder="Type new password..."
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="flex-1 h-[46px] px-4 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm"
            />
            <button 
              type="submit" 
              disabled={isResetting || !newPassword}
              className="h-[46px] bg-[#6b4c9a] text-white px-6 rounded-sm text-xs uppercase tracking-widest font-bold hover:bg-[#5a3f82] transition-colors shadow-sm disabled:opacity-50 whitespace-nowrap flex items-center justify-center"
            >
              {isResetting ? 'Saving...' : 'Reset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}