'use client'

import { loginSchoolUser } from '@/app/auth/actions'
import Image from 'next/image'
import { useState, use } from 'react'

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default function SchoolLoginPage({ searchParams }: Props) {
  // Use React's `use()` to unwrap the Promise in a Client Component (Next.js 15+)
  const resolvedParams = use(searchParams)
  const error = resolvedParams.error as string | undefined
  
  // State for password peeking
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
            <p className="text-[10px] font-bold tracking-widest text-stone-500 uppercase mb-2">Secure Access</p>
            <h1 className="text-2xl font-semibold text-stone-900 uppercase tracking-wide">
              e-Biddaloy Portal
            </h1>
          </div>
          
          {/* Graceful Error Display */}
          {error === 'invalid' && (
            <div className="mb-6 p-4 bg-[#fcf8f8] border border-[#b4483e]/20 text-[#b4483e] rounded-sm flex items-start gap-3">
              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <p className="text-[11px] font-bold uppercase tracking-widest">Invalid credentials. Please verify your username and password.</p>
            </div>
          )}
          {error === 'suspended' && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-sm flex items-start gap-3">
              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              <p className="text-[11px] font-bold uppercase tracking-widest">Account suspended. Please contact the Platform Administrator.</p>
            </div>
          )}

          <form action={loginSchoolUser} className="flex flex-col gap-6">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-2">
                Username / ID
              </label>
              <input 
                type="text" 
                name="username" 
                required 
                placeholder="Enter your assigned username"
                className="w-full p-3.5 bg-stone-50 border border-stone-200 rounded-sm text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:bg-white focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600">
                  Password
                </label>
              </div>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  name="password" 
                  required 
                  placeholder="••••••••"
                  className="w-full p-3.5 pr-12 bg-stone-50 border border-stone-200 rounded-sm text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:bg-white focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-stone-400 hover:text-[#6b4c9a] transition-colors rounded-sm focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.5" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                  )}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              className="mt-2 w-full bg-[#6b4c9a] text-white py-4 rounded-sm hover:bg-[#5a3f82] transition-colors text-xs font-bold uppercase tracking-widest shadow-sm flex items-center justify-center gap-2 group"
            >
              Authenticate & Enter
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