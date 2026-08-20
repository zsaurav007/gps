'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import PhotoEditor from '@/components/PhotoEditor'
import Dropdown from '@/components/ui/dropdown'
import { updateHeadTeacherPhoto, removeHeadTeacherPhotoInstant } from '@/app/actions/head-teacher-actions'
import { getCloudinaryAuth, getCloudinaryDeleteAuth } from '@/app/actions/cloudinary-actions'

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
        if (width > height) { height = Math.round((height * MAX_SIZE) / width); width = MAX_SIZE } 
        else { width = Math.round((width * MAX_SIZE) / height); height = MAX_SIZE }
      }
      canvas.width = width; canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/webp', 0.8))
    }
    img.onerror = reject; img.src = url
  })
}

export default function EditHeadTeacherPhotoForm({ schoolId, headTeacher }: { schoolId: string, headTeacher: any }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [editorImage, setEditorImage] = useState<string | null>(null)
  const [finalPhotoBase64, setFinalPhotoBase64] = useState<string>('')
  const [previewUrl, setPreviewUrl] = useState<string>(headTeacher?.photo_url || '')
  const [removePhoto, setRemovePhoto] = useState(false)
  const [bloodGroup, setBloodGroup] = useState<string>(headTeacher?.blood_group || '')
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const bloodGroupOptions = [
    { label: 'A Positive (A+)', value: 'A+' },
    { label: 'A Negative (A-)', value: 'A-' },
    { label: 'B Positive (B+)', value: 'B+' },
    { label: 'B Negative (B-)', value: 'B-' },
    { label: 'AB Positive (AB+)', value: 'AB+' },
    { label: 'AB Negative (AB-)', value: 'AB-' },
    { label: 'O Positive (O+)', value: 'O+' },
    { label: 'O Negative (O-)', value: 'O-' },
  ]

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setEditorImage(URL.createObjectURL(file))
      setRemovePhoto(false)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleEditorComplete = async (finalImageUrl: string) => {
    setPreviewUrl(finalImageUrl)
    setEditorImage(null)
    const base64 = await convertUrlToBase64(finalImageUrl)
    setFinalPhotoBase64(base64)
  }

  const handleRemovePhoto = async () => {
    if (!window.confirm("Are you sure you want to remove your profile photo?")) return
    
    setIsSubmitting(true)
    try {
      if (headTeacher.photo_url) {
        const auth = await getCloudinaryDeleteAuth(headTeacher.photo_url)
        if (auth) {
          const fd = new FormData()
          fd.append('public_id', auth.publicId)
          fd.append('api_key', auth.apiKey)
          fd.append('timestamp', auth.timestamp.toString())
          fd.append('signature', auth.signature)
          await fetch(`https://api.cloudinary.com/v1_1/${auth.cloudName}/image/destroy`, { method: 'POST', body: fd }).catch(e => console.log("Cloudinary delete ignored:", e))
        }
      }

      await removeHeadTeacherPhotoInstant(headTeacher.id)
      setPreviewUrl('')
      setFinalPhotoBase64('')
      setRemovePhoto(true)
      headTeacher.photo_url = null
      alert("Photo removed successfully!")
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {editorImage && (
        <PhotoEditor initialImage={editorImage} onCancel={() => setEditorImage(null)} onComplete={handleEditorComplete} />
      )}

      <form 
        action={async (formData) => {
          if (isSubmitting) return
          setIsSubmitting(true)
          try {
            if (finalPhotoBase64 && !removePhoto) {
              if (headTeacher.photo_url) {
                const delAuth = await getCloudinaryDeleteAuth(headTeacher.photo_url)
                if (delAuth) {
                  const delForm = new FormData()
                  delForm.append('public_id', delAuth.publicId); delForm.append('api_key', delAuth.apiKey); delForm.append('timestamp', delAuth.timestamp.toString()); delForm.append('signature', delAuth.signature)
                  await fetch(`https://api.cloudinary.com/v1_1/${delAuth.cloudName}/image/destroy`, { method: 'POST', body: delForm }).catch(e => console.log("Old photo delete ignored:", e))
                }
              }

              const folderName = `school_${schoolId}_head_teacher`
              const auth = await getCloudinaryAuth(folderName)
              const uploadForm = new FormData()
              uploadForm.append('file', finalPhotoBase64); uploadForm.append('api_key', auth.apiKey); uploadForm.append('timestamp', auth.timestamp.toString()); uploadForm.append('signature', auth.signature); uploadForm.append('folder', folderName); uploadForm.append('transformation', auth.transformation)
              const res = await fetch(`https://api.cloudinary.com/v1_1/${auth.cloudName}/image/upload`, { method: 'POST', body: uploadForm })
              const data = await res.json()
              if (!res.ok) throw new Error(data.error?.message || 'Cloudinary upload failed')
              formData.append('uploadedPhotoUrl', data.secure_url)
            }

            formData.append('removePhoto', removePhoto ? 'true' : 'false')
            // Pass dropdown state into formData
            formData.append('bloodGroup', bloodGroup)

            const result = await updateHeadTeacherPhoto(formData)
            if (result?.success) {
              alert("Profile updated successfully!") 
              router.refresh()
              router.push('/school-dashboard/teachers')
            }
          } catch (error: any) {
            setIsSubmitting(false)
            alert(`Error: ${error.message}`)
          }
        }} 
        className="flex flex-col gap-10"
      >
        <input type="hidden" name="headTeacherId" value={headTeacher.id} />

        <div className="flex flex-col lg:flex-row gap-10 lg:gap-14 items-start">
          
          {/* Photo Section */}
          <div className="flex flex-col items-center gap-5 w-full lg:w-1/3 pt-2">
            <div className="w-40 h-40 md:w-48 md:h-48 rounded-full border border-stone-200 shadow-sm bg-stone-50 overflow-hidden flex items-center justify-center p-1.5">
              <div className="w-full h-full rounded-full overflow-hidden bg-stone-100 flex items-center justify-center">
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover grayscale-[10%]" />
                ) : (
                  <span className="text-stone-400 text-sm font-medium tracking-wide uppercase">No Photo</span>
                )}
              </div>
            </div>
            <div className="flex gap-3 w-full justify-center">
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()} 
                className="bg-white border border-stone-200 text-stone-700 px-4 py-2.5 rounded-sm text-[10px] uppercase tracking-widest font-medium hover:border-[#6b4c9a] hover:text-[#6b4c9a] transition-colors shadow-sm"
              >
                Change Photo
              </button>
              {previewUrl && (
                <button 
                  type="button" 
                  onClick={handleRemovePhoto} 
                  disabled={isSubmitting} 
                  className="bg-white border border-stone-200 text-[#b4483e] px-4 py-2.5 rounded-sm text-[10px] uppercase tracking-widest font-medium hover:bg-[#fcf8f8] hover:border-[#b4483e] transition-colors disabled:opacity-50 shadow-sm"
                >
                  Remove
                </button>
              )}
            </div>
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
          </div>

          {/* Details Section */}
          <div className="w-full lg:w-2/3 flex flex-col gap-8">
            
            {/* Editable Fields */}
            <div className="space-y-5">
              <div className="flex items-center gap-3 mb-6">
                <h3 className="text-[11px] font-medium text-stone-400 uppercase tracking-[0.2em]">Personal Information</h3>
                <div className="h-[1px] bg-stone-200 flex-1"></div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-widest text-stone-500 mb-2">Date of Birth</label>
                  <input 
                    type="date" 
                    name="birthDate" 
                    defaultValue={headTeacher.birth_date || ''} 
                    className="w-full p-3 border border-stone-200 rounded-sm text-sm font-medium bg-stone-50 text-stone-900 focus:outline-none focus:border-[#6b4c9a] focus:bg-white focus:ring-1 focus:ring-[#6b4c9a] transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-widest text-stone-500 mb-2">Blood Group</label>
                  <Dropdown 
                    options={bloodGroupOptions}
                    value={bloodGroup}
                    onChange={(val) => setBloodGroup(val as string)}
                    placeholder="Select Blood Group"
                  />
                </div>
              </div>
            </div>

            {/* Locked Read-Only Details */}
            <div className="bg-stone-50 p-6 rounded-sm border border-stone-200 mt-2">
              <div className="flex items-center gap-3 mb-5 border-b border-stone-200 pb-4">
                <svg className="w-5 h-5 text-[#6b4c9a]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                <h3 className="text-[11px] font-medium text-stone-500 uppercase tracking-widest">Locked Profile Information</h3>
              </div>
              <div className="space-y-5">
                <div>
                  <label className="block text-[9px] font-medium text-stone-400 uppercase tracking-[0.2em] mb-1.5">Full Name</label>
                  <p className="text-sm font-medium text-stone-900 tracking-wide uppercase">{headTeacher.full_name}</p>
                </div>
                <div>
                  <label className="block text-[9px] font-medium text-stone-400 uppercase tracking-[0.2em] mb-1.5">Role</label>
                  <p className="text-sm font-medium text-[#6b4c9a] tracking-wide">Head Teacher / Administration</p>
                </div>
                <div>
                  <label className="block text-[9px] font-medium text-stone-400 uppercase tracking-[0.2em] mb-1.5">Login ID / Username</label>
                  <p className="text-sm font-normal text-stone-800 tracking-wide">{headTeacher.username}</p>
                </div>
              </div>
              <p className="text-[10px] text-stone-400 mt-8 font-medium italic tracking-wide">Note: Core administrative details cannot be altered from the standard directory module.</p>
            </div>

          </div>
        </div>

        <div className="border-t border-stone-200 pt-8 mt-2 flex justify-end">
          <button 
            type="submit" 
            disabled={isSubmitting} 
            className="w-full md:w-auto bg-[#6b4c9a] text-white px-10 py-3.5 rounded-sm hover:bg-[#5a3f82] transition-colors text-xs uppercase tracking-widest font-bold disabled:opacity-50 shadow-sm"
          >
            {isSubmitting ? 'Saving Profile...' : 'Save Profile Updates'}
          </button>
        </div>
      </form>
    </>
  )
}