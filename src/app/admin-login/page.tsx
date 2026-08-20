'use client'

import { useState } from 'react'
import Image from 'next/image'
import { loginMasterUser } from '@/app/auth/actions'

export default function AdminLoginPage() {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <main className="min-h-screen bg-stone-50 relative flex flex-col items-center justify-center p-6 font-sans overflow-hidden z-0">
      
      {/* ========================================== */}
      {/* BACKGROUND GRAPHICS & MOTION */}
      {/* ========================================== */}
      {/* Abstract Purple Orb */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-gradient-to-br from-[#6b4c9a]/20 to-transparent blur-3xl animate-[spin_15s_linear_infinite] -z-10"></div>
      
      {/* Abstract Stone Orb */}
      <div className="absolute bottom-[-15%] right-[-5%] w-[600px] h-[600px] rounded-full bg-gradient-to-tl from-stone-300/30 to-transparent blur-3xl animate-[spin_25s_linear_infinite_reverse] -z-10"></div>
      
      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMCwwLDAsMC4wNSkiLz48L3N2Zz4=')] [mask-image:linear-gradient(to_bottom,white,transparent)] -z-10"></div>

      {/* ========================================== */}
      {/* LOGIN INTERFACE */}
      {/* ========================================== */}
      <div className="max-w-md w-full relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
        
        {/* Brand / Logo Area */}
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 bg-white border border-stone-200 shadow-sm rounded-sm flex items-center justify-center relative overflow-hidden group p-2">
            <div className="absolute inset-0 bg-stone-50 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out"></div>
            <Image 
              src="/logo.png" 
              alt="e-Biddaloy Logo" 
              width={64} 
              height={64} 
              className="relative z-10 object-contain"
              priority
            />
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-sm shadow-xl shadow-stone-200/50 border border-stone-200 border-t-4 border-t-[#6b4c9a] p-8 sm:p-10 transition-transform duration-500 hover:-translate-y-1">
          
          <div className="text-center mb-8">
            <p className="text-[10px] font-bold tracking-widest text-[#6b4c9a] uppercase mb-2">Master Administration</p>
            <h1 className="text-2xl font-semibold text-stone-900 uppercase tracking-wide">
              e-Biddaloy Admin
            </h1>
            <p className="text-xs font-medium text-stone-500 mt-1">
              Sign in to manage the global institution network.
            </p>
          </div>

          <form action={loginMasterUser} className="flex flex-col gap-6">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-2">
                Email Address
              </label>
              <input 
                type="email" 
                name="email" 
                required 
                placeholder="admin@platform.com"
                className="w-full p-3.5 bg-stone-50 border border-stone-200 rounded-sm text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:bg-white focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-2">
                Password
              </label>
              <div className="relative">
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  name="password" 
                  required 
                  placeholder="••••••••"
                  className="w-full p-3.5 pr-12 bg-stone-50 border border-stone-200 rounded-sm text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:bg-white focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors focus:outline-none"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? (
                    // Eye Slash (Hide)
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a10.035 10.035 0 014.132-5.411m3.805-1.28A9.957 9.957 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21M3 3l18 18" />
                    </svg>
                  ) : (
                    // Eye (Show)
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              className="mt-2 w-full bg-[#6b4c9a] text-white py-4 rounded-sm hover:bg-[#5a3f82] transition-colors text-xs font-bold uppercase tracking-widest shadow-sm flex items-center justify-center gap-2 group"
            >
              Sign In to Command Center
              <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
            </button>
          </form>
        </div>

        {/* Developer Credit Footer */}
        <div className="mt-12 text-center relative z-10 animate-in fade-in duration-1000 delay-300 fill-mode-both">
          <p className="text-[9px] font-bold tracking-[0.2em] text-stone-400 uppercase flex items-center justify-center gap-2">
            Developed & Engineered by
          </p>
          <p className="text-xs font-bold tracking-widest text-stone-700 uppercase mt-1">
            Zulkarnain Saurav
          </p>
        </div>

      </div>
    </main>
  )
}