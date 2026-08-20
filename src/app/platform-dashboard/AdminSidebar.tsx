'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'

// --- Professional SVG Icons ---
const Icons = {
  Dashboard: <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>,
  Institutions: <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>,
  AddSchool: <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>,
  Lifecycle: <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m-8 7v6m-4-3h8"></path></svg>,
  Logout: <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>,
  Menu: <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>,
  Close: <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
}

// Master Admin Navigation Links
const navItems = [
  { name: 'Global Command', href: '/platform-dashboard', icon: Icons.Dashboard },
  { name: 'Register School', href: '/platform-dashboard/add-school', icon: Icons.AddSchool },
  { name: 'Data Lifecycle', href: '/platform-dashboard/lifecycle', icon: Icons.Lifecycle },
]

export default function AdminSidebar() {
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
      {/* Mobile Trigger - floating 3-dot button */}
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

      {/* Sidebar Container - Dark Purple Gradient */}
      <div className={`
        fixed top-0 left-0 h-screen z-40 flex flex-col justify-between
        transition-all duration-400 ease-in-out
        bg-gradient-to-b from-[#2b1f45] via-[#221934] to-[#180f26] border-r border-white/10
        md:w-20 hover:w-[260px] group overflow-hidden
        ${isMobileOpen ? 'w-[260px] translate-x-0' : 'w-[260px] -translate-x-full md:translate-x-0'}
      `}>

        {/* Top accent bar */}
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-[#6b4c9a] via-[#9575c9] to-[#6b4c9a]" />

        {/* Soft ambient glow */}
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-[#6b4c9a]/25 rounded-full blur-3xl pointer-events-none" />

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
              <span className="block text-[8px] text-[#c9bcdb] tracking-[0.2em] -mt-0.5 font-normal">Platform Admin</span>
            </span>
          </div>

          {/* Section label */}
          <div className="px-5 pt-6 pb-2 whitespace-nowrap opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
            <span className="text-[10px] font-bold text-[#c3a9ec] uppercase tracking-widest">Master Navigation</span>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden pb-4 px-3 pt-2 flex flex-col gap-1.5 custom-scrollbar">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
              
              const isStrictActive = item.href === '/platform-dashboard' 
                ? pathname === '/platform-dashboard'
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