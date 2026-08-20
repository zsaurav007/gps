import AdminSidebar from '@/app/platform-dashboard/AdminSidebar'

export default function PlatformDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex font-sans">
      
      {/* 
        1. The Admin Sidebar Component 
        It is fixed to the left side of the screen and handles its own mobile toggle state.
      */}
      <AdminSidebar />
      
      {/* 
        2. The Main Content Wrapper
        The 'md:pl-20' class is crucial here. Since the sidebar is fixed and has a width of 5rem (20 units) 
        in its collapsed state, we must push all content 80px to the right on desktop screens so 
        the dashboard doesn't hide behind the sidebar.
      */}
      <div className="flex-1 w-full md:pl-20 transition-all duration-400 ease-in-out">
        {children}
      </div>

    </div>
  )
}