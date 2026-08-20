'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import PhotoEditor from '@/components/PhotoEditor'
import Dropdown from '@/components/ui/dropdown'
import { updateStudent, removeStudentPhotoInstant } from '@/app/actions/student-actions'
import { getCloudinaryAuth, getCloudinaryDeleteAuth } from '@/app/actions/cloudinary-actions'

const toTitleCase = (str: string) => {
  if (!str) return ''
  return str.toString().toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

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

export default function EditStudentForm({ schoolId, classes, student }: { schoolId: string, classes: any[], student: any }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Dropdown States
  const [classId, setClassId] = useState<string>(student.class_id || '')
  const [gender, setGender] = useState<string>(student.gender || '')
  const [bloodGroup, setBloodGroup] = useState<string>(student.blood_group || '')

  // Photo State
  const [editorImage, setEditorImage] = useState<string | null>(null)
  const [finalPhotoBase64, setFinalPhotoBase64] = useState<string>('')
  const [previewUrl, setPreviewUrl] = useState<string>(student.photo_url || '')
  const [removePhoto, setRemovePhoto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Options for Dropdowns
  const classOptions = classes.map(c => ({ label: c.name, value: c.id }))
  const genderOptions = [
    { label: 'Male', value: 'Male' },
    { label: 'Female', value: 'Female' },
    { label: 'Other', value: 'Other' },
  ]
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

  // Browser-based direct photo deletion
  const handleRemovePhoto = async () => {
    if (!window.confirm("Are you sure you want to permanently delete this profile photo?")) return
    
    setIsSubmitting(true)
    try {
      if (student.photo_url) {
        const auth = await getCloudinaryDeleteAuth(student.photo_url)
        if (auth) {
          const fd = new FormData()
          fd.append('public_id', auth.publicId)
          fd.append('api_key', auth.apiKey)
          fd.append('timestamp', auth.timestamp.toString())
          fd.append('signature', auth.signature)
          await fetch(`https://api.cloudinary.com/v1_1/${auth.cloudName}/image/destroy`, { method: 'POST', body: fd }).catch(e => console.log("Cloudinary delete ignored:", e))
        }
      }

      await removeStudentPhotoInstant(student.id)
      setPreviewUrl('')
      setFinalPhotoBase64('')
      setRemovePhoto(true)
      student.photo_url = null
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
            // 1. If replacing the photo, delete the old one from Cloudinary via browser first
            if (finalPhotoBase64 && !removePhoto) {
              if (student.photo_url) {
                const delAuth = await getCloudinaryDeleteAuth(student.photo_url)
                if (delAuth) {
                  const delForm = new FormData()
                  delForm.append('public_id', delAuth.publicId); delForm.append('api_key', delAuth.apiKey); delForm.append('timestamp', delAuth.timestamp.toString()); delForm.append('signature', delAuth.signature)
                  await fetch(`https://api.cloudinary.com/v1_1/${delAuth.cloudName}/image/destroy`, { method: 'POST', body: delForm }).catch(e => console.log("Old photo delete ignored:", e))
                }
              }

              const folderName = `school_${schoolId}_students`
              const auth = await getCloudinaryAuth(folderName)
              const uploadForm = new FormData()
              uploadForm.append('file', finalPhotoBase64); uploadForm.append('api_key', auth.apiKey); uploadForm.append('timestamp', auth.timestamp.toString()); uploadForm.append('signature', auth.signature); uploadForm.append('folder', folderName); uploadForm.append('transformation', auth.transformation)
              const res = await fetch(`https://api.cloudinary.com/v1_1/${auth.cloudName}/image/upload`, { method: 'POST', body: uploadForm })
              const data = await res.json()
              if (!res.ok) throw new Error(data.error?.message || 'Cloudinary upload failed')
              formData.append('uploadedPhotoUrl', data.secure_url)
            }

            // Append Dropdown states manually
            formData.append('classId', classId)
            formData.append('gender', gender)
            formData.append('bloodGroup', bloodGroup)
            formData.append('removePhoto', removePhoto ? 'true' : 'false')

            formData.set('firstName', toTitleCase(formData.get('firstName') as string))
            formData.set('lastName', toTitleCase(formData.get('lastName') as string))
            formData.set('guardianName', toTitleCase(formData.get('guardianName') as string))

            const result = await updateStudent(formData)
            if (result?.success) {
              alert("Student profile updated successfully!") 
              router.refresh()
              router.push('/school-dashboard/students')
            }
          } catch (error: any) {
            setIsSubmitting(false)
            alert(`Error: ${error.message}`)
          }
        }} 
        className="flex flex-col gap-10"
      >
        <input type="hidden" name="studentId" value={student.id} />

        <div className="flex flex-col lg:flex-row gap-10 lg:gap-14 items-start">
          
          {/* Photo Section */}
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

          {/* Form Fields Section */}
          <div className="w-full lg:w-3/4 flex flex-col gap-10">
            
            {/* Academic Info */}
            <div className="space-y-5">
              <div className="flex items-center gap-3 mb-6">
                <h3 className="text-[11px] font-medium text-stone-400 uppercase tracking-[0.2em]">Academic Info</h3>
                <div className="h-[1px] bg-stone-200 flex-1"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="relative z-20">
                  <label className="block text-[10px] font-medium uppercase tracking-widest text-stone-500 mb-2">Class Assigned</label>
                  <Dropdown 
                    options={classOptions}
                    value={classId}
                    onChange={(val) => setClassId(val as string)}
                    placeholder="Select Class..."
                    hasSearch={classOptions.length > 5}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-widest text-stone-500 mb-2">Roll No / ID</label>
                  <input 
                    type="text" 
                    name="enrollmentId" 
                    defaultValue={student.enrollment_id} 
                    required 
                    className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-sm text-sm font-medium text-stone-900 focus:outline-none focus:border-[#6b4c9a] focus:bg-white focus:ring-1 focus:ring-[#6b4c9a] transition-all" 
                  />
                </div>
              </div>
            </div>

            {/* Personal Info */}
            <div className="space-y-5">
              <div className="flex items-center gap-3 mb-6">
                <h3 className="text-[11px] font-medium text-stone-400 uppercase tracking-[0.2em]">Personal Info</h3>
                <div className="h-[1px] bg-stone-200 flex-1"></div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-widest text-stone-500 mb-2">First Name</label>
                  <input 
                    type="text" 
                    name="firstName" 
                    defaultValue={student.first_name} 
                    required 
                    className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-sm text-sm font-medium text-stone-900 focus:outline-none focus:border-[#6b4c9a] focus:bg-white focus:ring-1 focus:ring-[#6b4c9a] transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-widest text-stone-500 mb-2">Last Name</label>
                  <input 
                    type="text" 
                    name="lastName" 
                    defaultValue={student.last_name} 
                    className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-sm text-sm font-medium text-stone-900 focus:outline-none focus:border-[#6b4c9a] focus:bg-white focus:ring-1 focus:ring-[#6b4c9a] transition-all" 
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-widest text-stone-500 mb-2">Date of Birth</label>
                  <input 
                    type="date" 
                    name="dateOfBirth" 
                    defaultValue={student.date_of_birth || ''} 
                    className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-sm text-sm font-medium text-stone-900 focus:outline-none focus:border-[#6b4c9a] focus:bg-white focus:ring-1 focus:ring-[#6b4c9a] transition-all" 
                  />
                </div>
                <div className="relative z-10">
                  <label className="block text-[10px] font-medium uppercase tracking-widest text-stone-500 mb-2">Gender</label>
                  <Dropdown 
                    options={genderOptions}
                    value={gender}
                    onChange={(val) => setGender(val as string)}
                    placeholder="Select Gender..."
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-widest text-stone-500 mb-2">Blood Group</label>
                  <Dropdown 
                    options={bloodGroupOptions}
                    value={bloodGroup}
                    onChange={(val) => setBloodGroup(val as string)}
                    placeholder="Select Blood Group..."
                  />
                </div>
              </div>
            </div>

            {/* Guardian Info */}
            <div className="space-y-5">
              <div className="flex items-center gap-3 mb-6">
                <h3 className="text-[11px] font-medium text-stone-400 uppercase tracking-[0.2em]">Guardian Info</h3>
                <div className="h-[1px] bg-stone-200 flex-1"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-widest text-stone-500 mb-2">Guardian Name</label>
                  <input 
                    type="text" 
                    name="guardianName" 
                    defaultValue={student.guardian_name || ''} 
                    className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-sm text-sm font-medium text-stone-900 focus:outline-none focus:border-[#6b4c9a] focus:bg-white focus:ring-1 focus:ring-[#6b4c9a] transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-widest text-stone-500 mb-2">Guardian Phone</label>
                  <input 
                    type="tel" 
                    name="guardianPhone" 
                    defaultValue={student.guardian_phone || ''} 
                    className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-sm text-sm font-medium text-stone-900 focus:outline-none focus:border-[#6b4c9a] focus:bg-white focus:ring-1 focus:ring-[#6b4c9a] transition-all" 
                  />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Submit Footer */}
        <div className="border-t border-stone-200 pt-8 mt-2 flex justify-end">
          <button 
            type="submit" 
            disabled={isSubmitting} 
            className="w-full md:w-auto bg-[#6b4c9a] text-white px-10 py-3.5 rounded-sm hover:bg-[#5a3f82] transition-colors text-xs uppercase tracking-widest font-bold disabled:opacity-50 shadow-sm"
          >
            {isSubmitting ? 'Saving Changes...' : 'Save Profile Updates'}
          </button>
        </div>
      </form>
    </>
  )
}