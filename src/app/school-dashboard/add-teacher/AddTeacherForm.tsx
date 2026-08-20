'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation' 
import PhotoEditor from '@/components/PhotoEditor'
import { addTeacher } from '@/app/actions/teacher-actions'
import { getCloudinaryAuth } from '@/app/actions/cloudinary-actions'
import Dropdown from '@/components/ui/dropdown'

const convertUrlToBase64 = async (url: string): Promise<string> => {
  if (url.startsWith('data:')) return url
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const MAX_SIZE = 600
      let { width, height } = img
      if (width > MAX_SIZE || height > MAX_SIZE) {
        if (width > height) {
          height = Math.round((height * MAX_SIZE) / width)
          width = MAX_SIZE
        } else {
          width = Math.round((width * MAX_SIZE) / height)
          height = MAX_SIZE
        }
      }
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/webp', 0.8))
    }
    img.onerror = reject
    img.src = url
  })
}

interface Subject {
  id: string
  name: string
}

export default function AddTeacherForm({ schoolId, subjects }: { schoolId: string, subjects: Subject[] }) {
  const router = useRouter()
  
  const [editorImage, setEditorImage] = useState<string | null>(null)
  const [finalPhotoBase64, setFinalPhotoBase64] = useState<string>('')
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // State for Custom Dropdown
  const [bloodGroup, setBloodGroup] = useState<string | number>('')
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const bloodGroupOptions = [
    { label: 'A+', value: 'A+' },
    { label: 'A-', value: 'A-' },
    { label: 'B+', value: 'B+' },
    { label: 'B-', value: 'B-' },
    { label: 'AB+', value: 'AB+' },
    { label: 'AB-', value: 'AB-' },
    { label: 'O+', value: 'O+' },
    { label: 'O-', value: 'O-' }
  ]

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setEditorImage(URL.createObjectURL(file))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleEditorComplete = async (finalImageUrl: string) => {
    setPreviewUrl(finalImageUrl)
    setEditorImage(null)
    const base64 = await convertUrlToBase64(finalImageUrl)
    setFinalPhotoBase64(base64)
  }

  return (
    <>
      {editorImage && (
        <PhotoEditor 
          initialImage={editorImage} 
          onCancel={() => setEditorImage(null)} 
          onComplete={handleEditorComplete} 
        />
      )}

      <form 
        action={async (formData) => {
          if (isSubmitting) return 
          
          setIsSubmitting(true)
          try {
            // 1. DIRECT BROWSER UPLOAD (Bypasses Firewall/Node.js)
            if (finalPhotoBase64) {
              const folderName = `school_${schoolId}_teachers`
              const auth = await getCloudinaryAuth(folderName)
              
              const uploadForm = new FormData()
              uploadForm.append('file', finalPhotoBase64)
              uploadForm.append('api_key', auth.apiKey)
              uploadForm.append('timestamp', auth.timestamp.toString())
              uploadForm.append('signature', auth.signature)
              uploadForm.append('folder', folderName)
              uploadForm.append('transformation', auth.transformation)

              const res = await fetch(`https://api.cloudinary.com/v1_1/${auth.cloudName}/image/upload`, {
                method: 'POST',
                body: uploadForm
              })
              
              const data = await res.json()
              if (!res.ok) throw new Error(data.error?.message || 'Cloudinary browser upload failed')

              // Attach secure URL for the database
              formData.append('uploadedPhotoUrl', data.secure_url)
            }

            // 2. Save everything to Supabase
            const result = await addTeacher(formData)
            
            if (result?.success) {
              alert("Teacher created successfully!") 
              router.refresh()
              router.push('/school-dashboard/teachers')
            }
            
          } catch (error: any) {
            setIsSubmitting(false)
            alert(`Error: ${error.message || "Failed to add teacher"}`)
          }
        }} 
        className="flex flex-col gap-8 font-sans"
      >
        <input type="hidden" name="schoolId" value={schoolId} />
        {/* Hidden input to pass the custom dropdown state to the form action */}
        <input type="hidden" name="bloodGroup" value={bloodGroup} />

        <div className="flex flex-col md:flex-row gap-8 lg:gap-12 items-start">
          
          {/* Profile Photo Upload */}
          <div className="flex flex-col items-center gap-5 w-full md:w-1/3 pt-2">
            <div className="w-40 h-40 rounded-full border-2 border-stone-200 shadow-sm bg-stone-50 overflow-hidden flex items-center justify-center p-1.5">
              <div className="w-full h-full rounded-full overflow-hidden bg-white flex items-center justify-center border border-stone-100">
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-stone-400 text-[10px] font-bold uppercase tracking-widest text-center px-4">No Photo</span>
                )}
              </div>
            </div>
            
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              className="text-[10px] bg-white text-stone-600 px-5 py-2.5 rounded-sm hover:bg-stone-50 hover:text-[#6b4c9a] font-bold tracking-widest uppercase transition-colors border border-stone-200 shadow-sm w-full sm:w-auto"
            >
              Select Profile Photo
            </button>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
            />
          </div>

          <div className="w-full md:w-2/3 flex flex-col gap-8">
            
            <div className="space-y-5">
              <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest border-b border-stone-200 pb-2">Personal Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-2">Full Name</label>
                  <input 
                    type="text" 
                    name="fullName" 
                    required 
                    placeholder="Enter teacher's full name"
                    className="w-full p-3 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-800 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm placeholder:text-stone-400" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-2">Joining Date</label>
                  <input 
                    type="date" 
                    name="joiningDate" 
                    required 
                    className="w-full p-3 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-800 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-2">Birth Date</label>
                  <input 
                    type="date" 
                    name="birthDate" 
                    required 
                    className="w-full p-3 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-800 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm" 
                  />
                </div>
                <div className="sm:col-span-2 relative z-50">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-2">Blood Group</label>
                  <Dropdown 
                    options={bloodGroupOptions}
                    value={bloodGroup}
                    onChange={(val) => setBloodGroup(val)}
                    placeholder="-- Select Blood Group --"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-5 relative z-10">
              <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest border-b border-stone-200 pb-2">Employment Information</h3>
              <div className="grid grid-cols-1 gap-5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-3">Subjects Assigned (Optional)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-white p-5 border border-stone-200 rounded-sm shadow-sm">
                    {subjects.length > 0 ? (
                      subjects.map(sub => (
                        <label key={sub.id} className="flex items-center gap-3 cursor-pointer group">
                          <input 
                            type="checkbox" 
                            name="subjectsTaught" 
                            value={sub.name} 
                            className="w-4 h-4 text-[#6b4c9a] border-stone-300 rounded-sm focus:ring-[#6b4c9a] cursor-pointer accent-[#6b4c9a]" 
                          />
                          <span className="text-xs text-stone-700 font-bold tracking-wide uppercase group-hover:text-[#6b4c9a] transition-colors">{sub.name}</span>
                        </label>
                      ))
                    ) : (
                      <p className="text-xs text-stone-500 italic col-span-full font-medium">
                        No subjects found. Please configure your School Setup first.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        <div className="border-t border-stone-100 pt-6 mt-4">
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-[#6b4c9a] text-white py-4 rounded-sm hover:bg-[#5a3f82] transition-colors font-bold disabled:opacity-50 text-[11px] uppercase tracking-widest shadow-sm flex items-center justify-center gap-2"
          >
            {isSubmitting ? 'Uploading & Saving...' : 'Deploy Teacher Record'}
          </button>
        </div>
      </form>
    </>
  )
}