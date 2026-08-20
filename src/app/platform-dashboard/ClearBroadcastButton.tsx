'use client'

import { useState } from 'react'
import { clearBroadcastServer } from '@/app/actions/broadcast-actions'
import { getCloudinaryDeleteAuth } from '@/app/actions/cloudinary-actions'

export default function ClearBroadcastButton({ imageUrl }: { imageUrl: string | null }) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleClear = async () => {
    if (!window.confirm("Are you sure you want to remove the active broadcast?")) return
    
    setIsDeleting(true)

    try {
      // 1. Delete from Cloudinary using your exact browser pattern
      if (imageUrl) {
        const auth = await getCloudinaryDeleteAuth(imageUrl)
        if (auth) {
          const fd = new FormData()
          fd.append('public_id', auth.publicId)
          fd.append('api_key', auth.apiKey)
          fd.append('timestamp', auth.timestamp.toString())
          fd.append('signature', auth.signature)
          await fetch(`https://api.cloudinary.com/v1_1/${auth.cloudName}/image/destroy`, { 
            method: 'POST', 
            body: fd 
          }).catch(e => console.error("Cloudinary delete ignored:", e))
        }
      }

      // 2. Hard delete from Supabase Database
      await clearBroadcastServer()
      
    } catch (error: any) {
      alert(`Failed to clear: ${error.message}`)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <button 
      onClick={handleClear} 
      disabled={isDeleting}
      className="bg-white border border-[#b4483e]/30 text-[#b4483e] px-3 py-1.5 rounded-sm hover:bg-[#fcf8f8] hover:border-[#b4483e]/50 transition-all font-bold tracking-widest text-[9px] uppercase shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
    >
      {isDeleting ? (
        <>
          <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          Clearing...
        </>
      ) : (
        <>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          Clear Broadcast
        </>
      )}
    </button>
  )
}