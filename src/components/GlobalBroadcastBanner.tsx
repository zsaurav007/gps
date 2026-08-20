import { createClient } from '@/lib/supabase/server'

export default async function GlobalBroadcastBanner() {
  const supabase = await createClient()

  // Fetch the currently active platform broadcast
  const { data: broadcast, error } = await supabase
    .schema('gps')
    .from('global_broadcasts')
    .select('message, image_url, created_at')
    .eq('is_active', true)
    .maybeSingle()

  if (error || !broadcast) {
    return null 
  }

  const hasImage = !!broadcast.image_url
  const hasText = !!broadcast.message
  const formattedDate = new Date(broadcast.created_at).toLocaleDateString()

  return (
    <div className="mb-8 bg-gradient-to-r from-indigo-50/50 via-white to-indigo-50/50 border border-indigo-100 rounded-sm shadow-sm overflow-hidden relative flex flex-col h-72 md:h-80">
      
      {/* Premium Gradient Top Bar */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#4c2f74] via-[#6b4c9a] to-[#9b7ede] z-10"></div>
      
      {/* Header Row */}
      <div className="shrink-0 p-2 bg-white/50 backdrop-blur-sm border-b border-indigo-50 flex items-center justify-center gap-2.5 relative z-10">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#6b4c9a] opacity-60"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#6b4c9a]"></span>
        </span>
        <span className="text-[9px] font-black tracking-[0.25em] text-stone-600 uppercase">
          Global Platform Announcement
        </span>
      </div>

      {/* Dynamic Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* ========================================== */}
        {/* SCENARIO 1: IMAGE & TEXT (Side by Side)    */}
        {/* ========================================== */}
        {hasImage && hasText && (
          <div className="flex w-full h-full p-5 md:p-8 gap-8 md:gap-12 items-center justify-center">
            
            {/* Image Side - Dynamic Wrapper that hugs the ratio */}
            <div className="shrink-0 h-full max-w-[45%] flex items-center justify-end relative group">
              {/* Premium glowing shadow effect behind the image */}
              <div className="absolute inset-0 bg-indigo-900/5 blur-2xl rounded-full scale-90 group-hover:scale-100 transition-transform duration-700"></div>
              <img 
                src={broadcast.image_url!} 
                alt="System Broadcast" 
                className="relative max-h-full w-auto object-contain rounded-md border-4 border-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] z-10 transition-transform duration-500 hover:scale-[1.02]"
              />
            </div>

            {/* Text Side - Open Layout, No Box */}
            <div className="flex-1 h-full flex flex-col justify-center min-w-0 max-w-3xl py-4">
              <div className="overflow-y-auto custom-scrollbar pr-6 max-h-[200px] border-l-[3px] border-[#6b4c9a]/40 pl-5 md:pl-7">
                <p className="text-lg md:text-[1.35rem] font-medium text-stone-800 whitespace-pre-wrap leading-[1.7] tracking-wide">
                  {broadcast.message}
                </p>
              </div>
              <p className="text-[10px] font-bold tracking-[0.2em] text-stone-400 uppercase mt-6 shrink-0 pl-5 md:pl-7">
                Issued: {formattedDate}
              </p>
            </div>
            
          </div>
        )}

        {/* ========================================== */}
        {/* SCENARIO 2: TEXT ONLY (Massive Gradient)   */}
        {/* ========================================== */}
        {!hasImage && hasText && (
          <div className="flex flex-col w-full h-full p-8 items-center justify-center text-center">
            <div className="overflow-y-auto custom-scrollbar px-6 w-full flex flex-col items-center justify-center">
              <p className="text-2xl md:text-4xl font-black bg-gradient-to-r from-[#4c2f74] via-[#6b4c9a] to-[#9b7ede] bg-clip-text text-transparent whitespace-pre-wrap leading-tight max-w-4xl mx-auto drop-shadow-sm pb-2">
                {broadcast.message}
              </p>
            </div>
            <p className="text-[10px] font-bold tracking-[0.2em] text-stone-400 uppercase mt-8 shrink-0">
              Issued: {formattedDate}
            </p>
          </div>
        )}

        {/* ========================================== */}
        {/* SCENARIO 3: IMAGE ONLY (Premium Frame)     */}
        {/* ========================================== */}
        {hasImage && !hasText && (
          <div className="flex flex-col w-full h-full p-6 items-center justify-center relative">
            <img 
              src={broadcast.image_url!} 
              alt="System Broadcast" 
              className="max-w-full max-h-full w-auto object-contain rounded-md border-4 border-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] z-10 transition-transform duration-500 hover:scale-[1.01]"
            />
            <div className="absolute bottom-6 right-6 bg-white/95 backdrop-blur-md border border-stone-100 px-4 py-2 rounded-sm shadow-md z-20">
              <p className="text-[10px] font-black tracking-widest text-[#6b4c9a] uppercase">
                Issued: {formattedDate}
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}