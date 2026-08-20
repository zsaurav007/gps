import Image from 'next/image'

export default function Loading() {
  return (
    <main className="min-h-screen bg-stone-50 relative flex flex-col items-center justify-center p-6 font-sans overflow-hidden z-0">
      
      {/* ========================================== */}
      {/* BACKGROUND GRAPHICS & MOTION */}
      {/* ========================================== */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-gradient-to-br from-[#6b4c9a]/15 to-transparent blur-3xl animate-[spin_15s_linear_infinite] -z-10"></div>
      <div className="absolute bottom-[-15%] right-[-5%] w-[600px] h-[600px] rounded-full bg-gradient-to-tl from-stone-300/30 to-transparent blur-3xl animate-[spin_25s_linear_infinite_reverse] -z-10"></div>
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMCwwLDAsMC4wNSkiLz48L3N2Zz4=')] [mask-image:linear-gradient(to_bottom,white,transparent)] -z-10"></div>

      {/* ========================================== */}
      {/* LOADING CARD CONTAINER                     */}
      {/* ========================================== */}
      <div className="max-w-md w-full bg-white p-8 md:p-10 rounded-sm shadow-xl shadow-stone-200/50 border border-stone-200 text-center border-t-4 border-t-[#6b4c9a] relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Animated Logo Container with Spinner Ring */}
        <div className="relative w-20 h-20 mx-auto mb-6 flex items-center justify-center">
          <div className="absolute inset-0 border-2 border-stone-200 rounded-full"></div>
          <div className="absolute inset-0 border-2 border-[#6b4c9a] rounded-full animate-spin border-t-transparent"></div>
          <div className="w-12 h-12 bg-white rounded-sm flex items-center justify-center p-1 relative z-10 shadow-sm">
            <Image 
              src="/logo.png" 
              alt="e-Biddaloy Logo" 
              width={36} 
              height={36} 
              className="w-full h-full object-contain"
              priority
            />
          </div>
        </div>

        {/* Text Content */}
        <p className="text-[10px] font-bold tracking-widest text-[#6b4c9a] uppercase mb-1">e-Biddaloy System</p>
        <h2 className="text-base font-bold text-stone-900 uppercase tracking-widest mb-2">Compiling Workspace</h2>
        <p className="text-xs font-medium text-stone-500 tracking-wide leading-relaxed">
          Please wait while we securely synchronize your institutional records...
        </p>

        {/* Dynamic Progress Bar Animation */}
        <div className="w-full bg-stone-100 h-1.5 rounded-sm overflow-hidden mt-8 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#6b4c9a] to-transparent animate-[shimmer_2s_infinite] w-full"></div>
        </div>

      </div>

      {/* Developer Credit Footer */}
      <div className="mt-12 text-center relative z-10">
        <p className="text-[9px] font-bold tracking-[0.2em] text-stone-400 uppercase">
          Developed & Engineered by Zulkarnain Saurav
        </p>
      </div>

    </main>
  )
}