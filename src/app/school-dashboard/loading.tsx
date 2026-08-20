import Image from 'next/image'

export default function Loading() {
  return (
    <main className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-sm w-full bg-white p-8 rounded-sm shadow-sm border border-stone-200 text-center border-t-4 border-t-[#6b4c9a] space-y-6">
        
        {/* Logo */}
        <div className="w-16 h-16 mx-auto bg-stone-50 border border-stone-200 rounded-sm flex items-center justify-center p-2 shadow-sm">
          <Image 
            src="/logo.png" 
            alt="e-Biddaloy Logo" 
            width={48} 
            height={48} 
            className="w-full h-full object-contain animate-pulse"
            priority
          />
        </div>

        {/* Text */}
        <div>
          <h2 className="text-xs font-bold text-stone-900 uppercase tracking-widest mb-1">e-Biddaloy</h2>
          <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">Loading workspace...</p>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-stone-100 h-1.5 rounded-sm overflow-hidden relative">
          <div className="absolute inset-0 bg-[#6b4c9a] animate-[shimmer_1.5s_infinite] w-full"></div>
        </div>

      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-[9px] font-bold tracking-[0.2em] text-stone-400 uppercase">
          Developed by Zulkarnain Saurav
        </p>
      </div>
    </main>
  )
}