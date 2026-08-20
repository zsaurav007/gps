import Image from 'next/image'

export default function Loading() {
  return (
    <main className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 font-sans relative">
      
      {/* Inline style for the slow fill animation */}
      <style>{`
        @keyframes slow-fill {
          0% { width: 0%; opacity: 0.5; }
          50% { width: 100%; opacity: 1; }
          100% { width: 0%; opacity: 0.5; }
        }
        .animate-slow-fill {
          animation: slow-fill 3.5s ease-in-out infinite;
        }
      `}</style>

      <div className="max-w-xs w-full flex flex-col items-center space-y-8 z-10">
        
        {/* Logo (Directly on background, no container) */}
        <div className="w-20 h-20 flex items-center justify-center">
          <Image 
            src="/logo.png" 
            alt="e-Biddaloy Logo" 
            width={80} 
            height={80} 
            className="w-full h-full object-contain animate-pulse"
            priority
          />
        </div>

        {/* Text & Progress Bar */}
        <div className="w-full text-center space-y-5">
          <div>
            <h2 className="text-sm font-bold text-stone-700 uppercase tracking-widest mb-1.5">e-Biddaloy</h2>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Loading workspace...</p>
          </div>

          {/* Ultra-minimal Slow Progress Bar */}
          <div className="w-full bg-stone-200 h-1 rounded-sm overflow-hidden flex justify-center">
            <div className="bg-[#6b4c9a] h-full rounded-sm animate-slow-fill"></div>
          </div>
        </div>

      </div>

      {/* Footer pinned to bottom */}
      <div className="absolute bottom-10 text-center">
        <p className="text-[9px] font-bold tracking-[0.2em] text-stone-400 uppercase">
          Developed by Zulkarnain Saurav
        </p>
      </div>
    </main>
  )
}