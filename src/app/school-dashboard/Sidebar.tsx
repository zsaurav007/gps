'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'

// --- Professional SVG Icons ---
const Icons = {
  Dashboard: <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>,
  Students: <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>,
  Promotion: <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>,
  Teachers: <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>,
  Setup: <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>,
  Routine: <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>,
  Exams: <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>,
  Reports: <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"></path></svg>,
  Lifecycle: <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m-8 7v6m-4-3h8"></path></svg>,
  Logout: <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>,
  Menu: <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>,
  Close: <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
}

const navItems = [
  { name: 'Dashboard', href: '/school-dashboard', icon: Icons.Dashboard },
  { name: 'Students', href: '/school-dashboard/students', icon: Icons.Students },
  { name: 'Promotions', href: '/school-dashboard/promotion', icon: Icons.Promotion },
  { name: 'Teachers', href: '/school-dashboard/teachers', icon: Icons.Teachers },
  { name: 'Class Routines', href: '/school-dashboard/routine', icon: Icons.Routine },
  { name: 'School Setup', href: '/school-dashboard/setup', icon: Icons.Setup },
  { name: 'Exams & Marks', href: '/school-dashboard/exams', icon: Icons.Exams },
  { name: 'Report Engine', href: '/school-dashboard/reports', icon: Icons.Reports },
  { name: 'Data Lifecycle', href: '/school-dashboard/lifecycle', icon: Icons.Lifecycle },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    } catch (e) {
      console.error("Logout failed", e)
    }
  }

  return (
    <>
      {/* Mobile Trigger - floating 3-dot button, no bar */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className={`
          md:hidden fixed top-4 z-50 w-11 h-11 rounded-sm flex items-center justify-center
          bg-[#6b4c9a] border border-white/10 text-white
          transition-all duration-300
          ${isMobileOpen ? 'left-[210px]' : 'left-4'}
        `}
      >
        {isMobileOpen ? Icons.Close : Icons.Menu}
      </button>

      {/* Sidebar Container - single consistent color, no glass/transparency swap */}
      <div className={`
        fixed top-0 left-0 h-screen z-40 flex flex-col justify-between
        transition-all duration-400 ease-in-out
        bg-gradient-to-b from-[#2b1f45] via-[#221934] to-[#180f26] border-r border-white/10
        md:w-20 hover:w-[260px] group overflow-hidden
        ${isMobileOpen ? 'w-[260px] translate-x-0' : 'w-[260px] -translate-x-full md:translate-x-0'}
      `}>

        {/* Top accent bar - the "something else" visual touch, always same brand color */}
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-[#6b4c9a] via-[#9575c9] to-[#6b4c9a]" />

        {/* Soft ambient glow, purely decorative, never toggles */}
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-[#6b4c9a]/25 rounded-full blur-3xl pointer-events-none" />

        {/* Top Section: Logo & Links */}
        <div className="flex flex-col h-full relative">

          {/* Logo Area */}
          <div className="h-20 px-5 flex items-center shrink-0 border-b border-white/10">
            <div className="w-10 h-10 bg-white rounded-sm flex items-center justify-center shrink-0 shadow-[0_0_18px_rgba(107,76,154,0.55)] p-1.5 overflow-hidden">
              <Image 
                src="/logo.png" 
                alt="e-Biddaloy Logo" 
                width={40} 
                height={40} 
                className="w-full h-full object-contain"
                priority
              />
            </div>
            <span className="ml-4 whitespace-nowrap opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 text-white text-sm font-semibold uppercase tracking-wide">
              e-<span className="text-[#c3a9ec] font-bold">Biddaloy</span>
            </span>
          </div>

          {/* Section label - matches form section-heading style */}
          <div className="px-5 pt-6 pb-2 whitespace-nowrap opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
            <span className="text-[10px] font-bold text-[#c3a9ec] uppercase tracking-widest">Main Navigation</span>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden pb-4 px-3 pt-2 flex flex-col gap-1.5 custom-scrollbar">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
              
              // Prevent Dashboard root from matching everything
              const isStrictActive = item.href === '/school-dashboard' 
                ? pathname === '/school-dashboard'
                : isActive

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={`
                    flex items-center px-3.5 py-3.5 rounded-sm transition-all duration-300 relative group/nav
                    ${isStrictActive
                      ? 'bg-gradient-to-r from-[#6b4c9a] to-[#5a3f82] text-white border border-white/10 shadow-[0_2px_12px_rgba(107,76,154,0.45)]'
                      : 'bg-transparent text-[#c9bcdb] hover:bg-white/[0.06] hover:text-white'
                    }
                  `}
                >
                  {/* Subtle active indicator dot */}
                  {isStrictActive && (
                    <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1 h-5 bg-white rounded-sm"></div>
                  )}

                  <div className={`shrink-0 transition-transform duration-300 ${isStrictActive ? 'ml-1 scale-110' : 'group-hover/nav:scale-110'}`}>
                    {item.icon}
                  </div>

                  <span className="ml-4 text-xs whitespace-nowrap uppercase tracking-wider font-bold opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
                    {item.name}
                  </span>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Bottom Section: Logout & Credits */}
        <div className="shrink-0 p-3 border-t border-white/10">

          <button
            onClick={handleLogout}
            className="flex items-center px-3.5 py-3 w-full rounded-sm bg-transparent text-[#e39b8f] hover:bg-white/5 hover:text-[#f0b3a8] transition-all duration-300 group/logout"
          >
            <div className="shrink-0 group-hover/logout:scale-110 transition-transform duration-300">
              {Icons.Logout}
            </div>
            <span className="ml-4 text-xs uppercase tracking-widest font-bold whitespace-nowrap opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
              Logout
            </span>
          </button>

          <p className="px-3.5 pt-2 text-[10px] text-[#8f7bb0] font-medium tracking-wide whitespace-nowrap text-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
            Developed by Zulkarnain Saurav
          </p>

        </div>

      </div>

      {/* Mobile Background Overlay */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="md:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-30 transition-opacity duration-300"
        />
      )}
    </>
  )
}