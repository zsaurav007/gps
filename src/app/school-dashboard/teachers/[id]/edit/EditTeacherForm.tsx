'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import PhotoEditor from '@/components/PhotoEditor'
import Dropdown from '@/components/ui/dropdown'
import { updateTeacher, removeTeacherPhotoInstant } from '@/app/actions/teacher-actions'
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

export default function EditTeacherForm({ schoolId, subjects = [], teacher }: any) {
  const router = useRouter()
  
  const [editorImage, setEditorImage] = useState<string | null>(null)
  const [finalPhotoBase64, setFinalPhotoBase64] = useState<string>('')
  const [previewUrl, setPreviewUrl] = useState<string>(teacher?.photo_url || '')
  const [removePhoto, setRemovePhoto] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [bloodGroup, setBloodGroup] = useState<string>(teacher?.blood_group || '')
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const existingSubjects = teacher?.subjects_taught ? teacher.subjects_taught.split(',').map((s: string) => s.trim()) : []

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
    if (!window.confirm("Are you sure you want to permanently delete this profile photo?")) return
    
    setIsSubmitting(true)
    try {
      if (teacher.photo_url) {
        const auth = await getCloudinaryDeleteAuth(teacher.photo_url)
        if (auth) {
          const fd = new FormData()
          fd.append('public_id', auth.publicId)
          fd.append('api_key', auth.apiKey)
          fd.append('timestamp', auth.timestamp.toString())
          fd.append('signature', auth.signature)
          await fetch(`https://api.cloudinary.com/v1_1/${auth.cloudName}/image/destroy`, { method: 'POST', body: fd })
            .catch(e => console.log("Cloudinary delete ignored:", e))
        }
      }

      await removeTeacherPhotoInstant(teacher.id)
      setPreviewUrl('')
      setFinalPhotoBase64('')
      setRemovePhoto(true)
      teacher.photo_url = null
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
            if (finalPhotoBase64 && !removePhoto) {
              if (teacher.photo_url) {
                const delAuth = await getCloudinaryDeleteAuth(teacher.photo_url)
                if (delAuth) {
                  const delForm = new FormData()
                  delForm.append('public_id', delAuth.publicId)
                  delForm.append('api_key', delAuth.apiKey)
                  delForm.append('timestamp', delAuth.timestamp.toString())
                  delForm.append('signature', delAuth.signature)
                  await fetch(`https://api.cloudinary.com/v1_1/${delAuth.cloudName}/image/destroy`, { method: 'POST', body: delForm })
                    .catch(e => console.log("Old photo delete ignored:", e))
                }
              }

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

              formData.append('uploadedPhotoUrl', data.secure_url)
            }

            formData.append('removePhoto', removePhoto ? 'true' : 'false')
            formData.append('bloodGroup', bloodGroup) 

            const result = await updateTeacher(formData)
            if (result?.success) {
              alert("Teacher profile updated successfully!")
              router.refresh()
              router.push('/school-dashboard/teachers')
            }
          } catch (error: any) {
            setIsSubmitting(false)
            alert(`Error: ${error.message || "Failed to update teacher"}`)
          }
        }} 
        className="flex flex-col gap-10"
      >
        <input type="hidden" name="schoolId" value={schoolId} />
        <input type="hidden" name="teacherId" value={teacher.id} />

        <div className="flex flex-col lg:flex-row gap-10 lg:gap-14 items-start">
          
          <div className="flex flex-col items-center gap-5 w-full lg:w-1/4 pt-2">
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

          <div className="w-full lg:w-3/4 flex flex-col gap-10">
            
            <div className="space-y-5">
              <div className="flex items-center gap-3 mb-6">
                <h3 className="text-[11px] font-medium text-stone-400 uppercase tracking-[0.2em]">Personal Information</h3>
                <div className="h-[1px] bg-stone-200 flex-1"></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-medium uppercase tracking-widest text-stone-500 mb-2">Full Name</label>
                  <input 
                    type="text" 
                    name="fullName" 
                    defaultValue={teacher.full_name} 
                    required 
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-sm text-sm font-medium text-stone-900 focus:outline-none focus:border-[#6b4c9a] focus:bg-white focus:ring-1 focus:ring-[#6b4c9a] transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-widest text-stone-500 mb-2">Joining Date</label>
                  <input 
                    type="date" 
                    name="joiningDate" 
                    defaultValue={teacher.joining_date || ''} 
                    required 
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-sm text-sm font-medium text-stone-900 focus:outline-none focus:border-[#6b4c9a] focus:bg-white focus:ring-1 focus:ring-[#6b4c9a] transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-widest text-stone-500 mb-2">Birth Date</label>
                  <input 
                    type="date" 
                    name="birthDate" 
                    defaultValue={teacher.birth_date || ''} 
                    required 
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-sm text-sm font-medium text-stone-900 focus:outline-none focus:border-[#6b4c9a] focus:bg-white focus:ring-1 focus:ring-[#6b4c9a] transition-all" 
                  />
                </div>
                <div className="md:col-span-2">
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

            <div className="space-y-5">
              <div className="flex items-center gap-3 mb-6">
                <h3 className="text-[11px] font-medium text-stone-400 uppercase tracking-[0.2em]">Employment Information</h3>
                <div className="h-[1px] bg-stone-200 flex-1"></div>
              </div>
              
              <div className="grid grid-cols-1 gap-5">
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-widest text-stone-500 mb-3">Subjects Assigned (Optional)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 bg-stone-50 p-5 border border-stone-200 rounded-sm">
                    {subjects?.length > 0 ? (
                      subjects.map((sub: any) => {
                        const isChecked = existingSubjects.includes(sub.name)
                        return (
                          <label key={sub.id} className="flex items-center gap-3 cursor-pointer group">
                            <input 
                              type="checkbox" 
                              name="subjectsTaught" 
                              value={sub.name} 
                              defaultChecked={isChecked}
                              className="w-4 h-4 text-[#6b4c9a] bg-white border-stone-300 rounded-sm focus:ring-[#6b4c9a] cursor-pointer accent-[#6b4c9a]" 
                            />
                            <span className="text-sm text-stone-700 font-medium group-hover:text-[#6b4c9a] transition-colors">{sub.name}</span>
                          </label>
                        )
                      })
                    ) : (
                      <p className="text-xs font-medium text-stone-400 italic col-span-full">No subjects configured in School Setup.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        <div className="border-t border-stone-200 pt-8 mt-2 flex justify-end">
          <button 
            type="submit" 
            disabled={isSubmitting} 
            className="w-full md:w-auto bg-[#6b4c9a] text-white px-10 py-3.5 rounded-sm hover:bg-[#5a3f82] transition-colors text-xs uppercase tracking-widest font-bold disabled:opacity-50 shadow-sm"
          >
            {isSubmitting ? 'Saving Changes...' : 'Save Profile Changes'}
          </button>
        </div>
      </form>
    </>
  )
}