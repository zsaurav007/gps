'use client'

import { useState, useRef } from 'react'
import { saveBroadcast, getBroadcastCloudinaryAuth } from '@/app/actions/broadcast-actions'
import { getCloudinaryDeleteAuth } from '@/app/actions/cloudinary-actions' 
import Dropdown from '@/components/ui/dropdown'

export default function BroadcastClientForm({ activeImageUrl }: { activeImageUrl: string | null }) {
  const [isUploading, setIsUploading] = useState(false)
  const [imageRatio, setImageRatio] = useState<string>('c_limit,w_1200') // Default to Original
  const formRef = useRef<HTMLFormElement>(null)

  // Cloudinary Transformation Options for the Dropdown
  const ratioOptions = [
    { label: 'Original (No Crop)', value: 'c_limit,w_1200' },
    { label: 'Widescreen (16:9)', value: 'c_fill,ar_16:9,w_1200' },
    { label: 'Cinematic Banner (21:9)', value: 'c_fill,ar_21:9,w_1200' },
    { label: 'Perfect Square (1:1)', value: 'c_fill,ar_1:1,w_800' },
    { label: 'Portrait (3:4)', value: 'c_fill,ar_3:4,w_800' },
    { label: 'Vertical Mobile (9:16)', value: 'c_fill,ar_9:16,w_800' }
  ]

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsUploading(true)

    try {
      const formData = new FormData(e.currentTarget)
      const message = formData.get('message') as string
      const imageFile = formData.get('image') as File
      let imageUrl = activeImageUrl

      // Handle new image upload
      if (imageFile && imageFile.size > 0) {
        
        // 1. Delete the OLD image from Cloudinary if it exists
        if (activeImageUrl) {
          const delAuth = await getCloudinaryDeleteAuth(activeImageUrl)
          if (delAuth) {
            const delForm = new FormData()
            delForm.append('public_id', delAuth.publicId)
            delForm.append('api_key', delAuth.apiKey)
            delForm.append('timestamp', delAuth.timestamp.toString())
            delForm.append('signature', delAuth.signature)
            await fetch(`https://api.cloudinary.com/v1_1/${delAuth.cloudName}/image/destroy`, { 
              method: 'POST', body: delForm 
            }).catch(e => console.log("Old photo delete ignored:", e))
          }
        }

        // 2. Upload the NEW image using the selected dynamic ratio
        const auth = await getBroadcastCloudinaryAuth('platform_broadcasts', imageRatio)
        
        const uploadData = new FormData()
        uploadData.append('file', imageFile)
        uploadData.append('api_key', auth.apiKey)
        uploadData.append('timestamp', auth.timestamp.toString())
        uploadData.append('signature', auth.signature)
        uploadData.append('folder', 'platform_broadcasts')
        uploadData.append('transformation', auth.transformation)

        const res = await fetch(`https://api.cloudinary.com/v1_1/${auth.cloudName}/image/upload`, {
          method: 'POST',
          body: uploadData
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error?.message || 'Cloudinary upload failed')
        
        imageUrl = data.secure_url
      }

      if ((!message || !message.trim()) && !imageUrl) {
        alert('Please provide either a message or an image.')
        setIsUploading(false)
        return
      }

      // Save to Database
      await saveBroadcast(message, imageUrl)
      formRef.current?.reset()

    } catch (error: any) {
      console.error(error)
      alert(error.message)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-2">
          Text Message (Optional)
        </label>
        <textarea 
          name="message" 
          rows={3}
          placeholder="Type an announcement for all institutions..."
          className="w-full p-3.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all resize-none custom-scrollbar"
        ></textarea>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-2">
            Image Attachment (Optional)
          </label>
          <input 
            type="file" 
            name="image" 
            accept="image/*"
            className="w-full text-xs font-medium text-stone-500 bg-white border border-stone-300 rounded-sm cursor-pointer file:cursor-pointer file:mr-4 file:py-2.5 file:px-4 file:rounded-sm file:rounded-r-none file:border-0 file:border-r file:border-stone-300 file:text-[10px] file:font-bold file:uppercase file:tracking-widest file:bg-stone-50 file:text-stone-700 hover:file:bg-stone-100 transition-all focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a]"
          />
        </div>
        
        <div className="relative z-20">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-2">
            Image Aspect Ratio
          </label>
          <Dropdown 
            options={ratioOptions}
            value={imageRatio}
            onChange={(val) => setImageRatio(val as string)}
            placeholder="Select Display Ratio"
          />
        </div>
      </div>

      <div className="pt-2">
        <button 
          type="submit" 
          disabled={isUploading}
          className="w-full bg-[#6b4c9a] text-white px-5 py-3.5 rounded-sm text-xs uppercase tracking-widest font-bold hover:bg-[#5a3f82] transition-colors disabled:opacity-50 shadow-sm flex items-center justify-center gap-2"
        >
          {isUploading ? (
            'Transmitting...'
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
              Publish Live Broadcast
            </>
          )}
        </button>
      </div>
    </form>
  )
}