import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-white p-8 md:p-10 rounded-sm shadow-sm border border-stone-200 text-center border-t-4 border-t-stone-800">
        
        {/* Icon */}
        <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        {/* Text Content */}
        <h1 className="text-4xl font-black text-stone-900 uppercase tracking-widest mb-2">404</h1>
        <h2 className="text-sm font-bold text-stone-500 uppercase tracking-widest mb-4">Resource Not Found</h2>
        
        <p className="text-sm font-medium text-stone-600 mb-8 leading-relaxed">
          The page or data you are looking for does not exist. It may have been moved, permanently deleted, or you might have followed a broken link.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <Link 
            href="/school-dashboard" 
            className="w-full bg-[#6b4c9a] text-white px-6 py-3.5 rounded-sm text-xs uppercase tracking-widest font-bold hover:bg-[#5a3f82] transition-colors shadow-sm"
          >
            Return to Dashboard
          </Link>
          <Link 
            href="/login" 
            className="w-full bg-white text-stone-700 border border-stone-300 px-6 py-3.5 rounded-sm text-xs uppercase tracking-widest font-bold hover:bg-stone-50 transition-colors shadow-sm"
          >
            Go to Login
          </Link>
        </div>

      </div>
    </div>
  )
}