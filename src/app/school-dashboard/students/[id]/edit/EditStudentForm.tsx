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

// --- UI Components for Bilingual Labels ---
const BiLabel = ({ bn, en, required }: { bn: string, en: string, required?: boolean }) => (
  <label className="block mb-2 flex items-center flex-wrap gap-y-1">
    <span className="text-lg font-bold text-stone-900 leading-none">{bn}</span>
    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-2 leading-none">/ {en}</span>
    {required && <span className="text-[#b4483e] ml-1.5 font-black">*</span>}
  </label>
)

const SectionHeader = ({ bn, en }: { bn: string, en: string }) => (
  <div className="border-b border-stone-200 pb-3 mb-6">
    <h3 className="text-xl font-bold text-[#6b4c9a] flex items-baseline flex-wrap gap-2">
      {bn} <span className="text-xs font-bold uppercase tracking-widest text-stone-400">/ {en}</span>
    </h3>
  </div>
)

// Standard Input Styling
const inputClass = "w-full p-3.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm"

export default function EditStudentForm({ schoolId, classes, student }: { schoolId: string, classes: any[], student: any }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Dropdown States
  const [classId, setClassId] = useState<string | number>(student.class_id || '')
  const [gender, setGender] = useState<string | number>(student.gender || '')
  const [bloodGroup, setBloodGroup] = useState<string | number>(student.blood_group || '')
  const [fatherBanking, setFatherBanking] = useState<string | number>(student.father_mobile_banking || '')
  const [motherBanking, setMotherBanking] = useState<string | number>(student.mother_mobile_banking || '')
  const [guardianBanking, setGuardianBanking] = useState<string | number>(student.guardian_mobile_banking || '')

  // Photo State
  const [editorImage, setEditorImage] = useState<string | null>(null)
  const [finalPhotoBase64, setFinalPhotoBase64] = useState<string>('')
  const [previewUrl, setPreviewUrl] = useState<string>(student.photo_url || '')
  const [removePhoto, setRemovePhoto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Options
  const classOptions = classes.map(c => ({ label: c.name, value: c.id }))
  const genderOptions = [
    { label: 'Male', value: 'Male' }, { label: 'Female', value: 'Female' }, { label: 'Other', value: 'Other' },
  ]
  const bloodGroupOptions = [
    { label: 'A Positive (A+)', value: 'A+' }, { label: 'A Negative (A-)', value: 'A-' },
    { label: 'B Positive (B+)', value: 'B+' }, { label: 'B Negative (B-)', value: 'B-' },
    { label: 'AB Positive (AB+)', value: 'AB+' }, { label: 'AB Negative (AB-)', value: 'AB-' },
    { label: 'O Positive (O+)', value: 'O+' }, { label: 'O Negative (O-)', value: 'O-' },
  ]
  const bankingOptions = [
    { label: 'বিকাশ (bKash)', value: 'bKash' }, { label: 'নগদ (Nagad)', value: 'Nagad' }, { label: 'None', value: '' }
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
      if (student.photo_url) {
        const auth = await getCloudinaryDeleteAuth(student.photo_url)
        if (auth) {
          const fd = new FormData()
          fd.append('public_id', auth.publicId); fd.append('api_key', auth.apiKey); fd.append('timestamp', auth.timestamp.toString()); fd.append('signature', auth.signature)
          await fetch(`https://api.cloudinary.com/v1_1/${auth.cloudName}/image/destroy`, { method: 'POST', body: fd }).catch(e => console.log("Cloudinary delete ignored"))
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
    <div className="font-sans w-full">
      {editorImage && <PhotoEditor initialImage={editorImage} onCancel={() => setEditorImage(null)} onComplete={handleEditorComplete} />}

      <form 
        action={async (formData) => {
          if (isSubmitting) return
          setIsSubmitting(true)
          try {
            if (finalPhotoBase64 && !removePhoto) {
              if (student.photo_url) {
                const delAuth = await getCloudinaryDeleteAuth(student.photo_url)
                if (delAuth) {
                  const delForm = new FormData()
                  delForm.append('public_id', delAuth.publicId); delForm.append('api_key', delAuth.apiKey); delForm.append('timestamp', delAuth.timestamp.toString()); delForm.append('signature', delAuth.signature)
                  await fetch(`https://api.cloudinary.com/v1_1/${delAuth.cloudName}/image/destroy`, { method: 'POST', body: delForm }).catch(e => console.log("Old photo delete ignored"))
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

            formData.append('classId', String(classId))
            formData.append('gender', String(gender))
            formData.append('bloodGroup', String(bloodGroup))
            formData.append('fatherMobileBanking', String(fatherBanking))
            formData.append('motherMobileBanking', String(motherBanking))
            formData.append('guardianMobileBanking', String(guardianBanking))
            formData.append('removePhoto', removePhoto ? 'true' : 'false')

            formData.set('studentNameEn', toTitleCase(formData.get('studentNameEn') as string)) 
            formData.set('fatherNameEn', toTitleCase(formData.get('fatherNameEn') as string))
            formData.set('motherNameEn', toTitleCase(formData.get('motherNameEn') as string))
            formData.set('guardianNameEn', toTitleCase(formData.get('guardianNameEn') as string))

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
        className="flex flex-col gap-8"
      >
        <input type="hidden" name="studentId" value={student.id} />

        {/* HEADER: Photo & Office Use */}
        <div className="bg-white p-6 md:p-8 border border-stone-200 rounded-sm shadow-sm flex flex-col md:flex-row gap-8 items-start relative z-[60]">
          <div className="flex flex-col items-center gap-4 shrink-0 w-full md:w-auto">
            <div className="w-40 h-40 rounded-sm border-2 border-stone-200 shadow-sm bg-stone-50 overflow-hidden flex items-center justify-center p-1">
              <div className="w-full h-full bg-white border border-stone-100 flex items-center justify-center overflow-hidden">
                {previewUrl ? <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" /> : <span className="text-xl font-bold text-stone-300">ছবি</span>}
              </div>
            </div>
            <div className="flex gap-2 w-full">
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()} 
                className="flex-1 bg-white text-stone-600 border border-stone-200 px-3 py-3 rounded-sm hover:bg-stone-50 hover:text-[#6b4c9a] font-bold text-[10px] uppercase tracking-widest transition-colors shadow-sm"
              >
                Upload
              </button>
              {previewUrl && (
                <button 
                  type="button" 
                  onClick={handleRemovePhoto} 
                  disabled={isSubmitting} 
                  className="flex-1 bg-[#fcf8f8] border border-[#b4483e]/20 text-[#b4483e] px-3 py-3 rounded-sm hover:bg-[#b4483e] hover:text-white font-bold text-[10px] uppercase tracking-widest transition-colors shadow-sm disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
          </div>

          <div className="flex-1 w-full relative z-[60]">
            <SectionHeader bn="ভর্তি সংক্রান্ত তথ্য" en="Office Use" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="flex flex-col h-full justify-end relative">
                <BiLabel bn="শ্রেণি" en="Class" required />
                <Dropdown options={classOptions} value={classId} onChange={(val) => setClassId(val)} placeholder="Select Class..." hasSearch />
              </div>
              <div className="flex flex-col h-full justify-end">
                <BiLabel bn="রোল" en="Roll No" required />
                <input type="text" name="enrollmentId" defaultValue={student.enrollment_id} required className={inputClass} />
              </div>
              <div className="flex flex-col h-full justify-end">
                <BiLabel bn="ভর্তির বছর" en="Year" />
                <input type="text" name="admissionYear" defaultValue={student.admission_year || ''} className={inputClass} />
              </div>
              <div className="flex flex-col h-full justify-end">
                <BiLabel bn="পুনরাবৃত্তি রোল" en="Prev Roll" />
                <input type="text" name="previousRoll" defaultValue={student.previous_roll || ''} className={inputClass} />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 1: Student Info */}
        <div className="bg-white p-6 md:p-8 border border-stone-200 rounded-sm shadow-sm relative z-[50]">
          <SectionHeader bn="শিক্ষার্থীর তথ্য" en="Student Info" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="flex flex-col h-full justify-end"><BiLabel bn="নাম (বাংলায়)" en="Name (Bangla)" /><input type="text" name="nameBangla" defaultValue={student.name_bangla || ''} className={inputClass} /></div>
            <div className="flex flex-col h-full justify-end"><BiLabel bn="ইংরেজিতে" en="Name (English)" required /><input type="text" name="studentNameEn" defaultValue={student.first_name} required className={inputClass} /></div>
            <div className="flex flex-col h-full justify-end"><BiLabel bn="জন্ম নিবন্ধন নং" en="Birth Reg No" /><input type="text" name="birthRegNo" defaultValue={student.birth_reg_no || ''} className={inputClass} /></div>
            
            <div className="flex flex-col h-full justify-end"><BiLabel bn="জন্ম তারিখ" en="Date of Birth" /><input type="date" name="dateOfBirth" defaultValue={student.date_of_birth || ''} className={inputClass} /></div>
            
            <div className="flex flex-col h-full justify-end relative">
              <BiLabel bn="লিঙ্গ" en="Gender" />
              <Dropdown options={genderOptions} value={gender} onChange={(val) => setGender(val)} placeholder="Select Gender" />
            </div>
            <div className="flex flex-col h-full justify-end relative">
              <BiLabel bn="রক্তের গ্রুপ" en="Blood Group" />
              <Dropdown options={bloodGroupOptions} value={bloodGroup} onChange={(val) => setBloodGroup(val)} placeholder="Select Blood Group" />
            </div>
          </div>

          <div className="pt-6 border-t border-stone-100">
            <h4 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">ঠিকানা <span className="text-[10px] uppercase tracking-widest text-stone-400">/ Student Address</span></h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-2 flex flex-col h-full justify-end"><BiLabel bn="গ্রাম" en="Village" /><input type="text" name="village" defaultValue={student.village || ''} className={inputClass} /></div>
              <div className="flex flex-col h-full justify-end"><BiLabel bn="ডাকঘর" en="Post Office" /><input type="text" name="postOffice" defaultValue={student.post_office || ''} className={inputClass} /></div>
              <div className="flex flex-col h-full justify-end"><BiLabel bn="পোস্ট কোড" en="Post Code" /><input type="text" name="postCode" defaultValue={student.post_code || ''} className={inputClass} /></div>
              <div className="flex flex-col h-full justify-end"><BiLabel bn="উপজেলা" en="Upazila" /><input type="text" name="upazila" defaultValue={student.upazila || ''} className={inputClass} /></div>
            </div>
          </div>
        </div>

        {/* SECTION 2: Father's Info */}
        <div className="bg-white p-6 md:p-8 border border-stone-200 rounded-sm shadow-sm relative z-[40]">
          <SectionHeader bn="পিতার তথ্য" en="Father's Info" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="flex flex-col h-full justify-end"><BiLabel bn="নাম (বাংলায়)" en="Name (BN)" /><input type="text" name="fatherNameBn" defaultValue={student.father_name_bn || ''} className={inputClass} /></div>
            <div className="flex flex-col h-full justify-end"><BiLabel bn="ইংরেজিতে" en="Name (EN)" /><input type="text" name="fatherNameEn" defaultValue={student.father_name_en || ''} className={inputClass} /></div>
            <div className="flex flex-col h-full justify-end"><BiLabel bn="শিক্ষাগত যোগ্যতা" en="Education" /><input type="text" name="fatherEdu" defaultValue={student.father_edu || ''} className={inputClass} /></div>
            
            <div className="flex flex-col h-full justify-end"><BiLabel bn="পিতার নাম" en="Father's Name" /><input type="text" name="fatherFatherName" defaultValue={student.father_father_name || ''} className={inputClass} /></div>
            <div className="flex flex-col h-full justify-end"><BiLabel bn="মাতার নাম" en="Mother's Name" /><input type="text" name="fatherMotherName" defaultValue={student.father_mother_name || ''} className={inputClass} /></div>
            <div className="flex flex-col h-full justify-end"><BiLabel bn="জাতীয় পরিচয়পত্র" en="Smart Card No" /><input type="text" name="fatherNid" defaultValue={student.father_nid || ''} className={inputClass} /></div>
            
            <div className="flex flex-col h-full justify-end lg:col-span-3"><BiLabel bn="জন্ম তারিখ" en="Date of Birth" /><input type="date" name="fatherDob" defaultValue={student.father_dob || ''} className={inputClass} /></div>
          </div>

          <div className="pt-6 border-t border-stone-100">
            <h4 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">ঠিকানা <span className="text-[10px] uppercase tracking-widest text-stone-400">/ Father's Address</span></h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-2 flex flex-col h-full justify-end"><BiLabel bn="গ্রাম" en="Village" /><input type="text" name="fatherVillage" defaultValue={student.father_village || ''} className={inputClass} /></div>
              <div className="flex flex-col h-full justify-end"><BiLabel bn="ডাকঘর" en="Post Office" /><input type="text" name="fatherPostOffice" defaultValue={student.father_post_office || ''} className={inputClass} /></div>
              <div className="flex flex-col h-full justify-end"><BiLabel bn="পোস্ট কোড" en="Post Code" /><input type="text" name="fatherPostCode" defaultValue={student.father_post_code || ''} className={inputClass} /></div>
              <div className="flex flex-col h-full justify-end"><BiLabel bn="উপজেলা" en="Upazila" /><input type="text" name="fatherUpazila" defaultValue={student.father_upazila || ''} className={inputClass} /></div>
            </div>
          </div>
        </div>

        {/* SECTION 3: Mother's Info */}
        <div className="bg-white p-6 md:p-8 border border-stone-200 rounded-sm shadow-sm relative z-[30]">
          <SectionHeader bn="মাতার তথ্য" en="Mother's Info" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="flex flex-col h-full justify-end"><BiLabel bn="নাম (বাংলায়)" en="Name (BN)" /><input type="text" name="motherNameBn" defaultValue={student.mother_name_bn || ''} className={inputClass} /></div>
            <div className="flex flex-col h-full justify-end"><BiLabel bn="ইংরেজিতে" en="Name (EN)" /><input type="text" name="motherNameEn" defaultValue={student.mother_name_en || ''} className={inputClass} /></div>
            <div className="flex flex-col h-full justify-end"><BiLabel bn="শিক্ষাগত যোগ্যতা" en="Education" /><input type="text" name="motherEdu" defaultValue={student.mother_edu || ''} className={inputClass} /></div>
            
            <div className="flex flex-col h-full justify-end"><BiLabel bn="পিতার নাম" en="Father's Name" /><input type="text" name="motherFatherName" defaultValue={student.mother_father_name || ''} className={inputClass} /></div>
            <div className="flex flex-col h-full justify-end"><BiLabel bn="মাতার নাম" en="Mother's Name" /><input type="text" name="motherMotherName" defaultValue={student.mother_mother_name || ''} className={inputClass} /></div>
            <div className="flex flex-col h-full justify-end"><BiLabel bn="জাতীয় পরিচয়পত্র" en="Smart Card No" /><input type="text" name="motherNid" defaultValue={student.mother_nid || ''} className={inputClass} /></div>
            
            <div className="flex flex-col h-full justify-end lg:col-span-3"><BiLabel bn="জন্ম তারিখ" en="Date of Birth" /><input type="date" name="motherDob" defaultValue={student.mother_dob || ''} className={inputClass} /></div>
          </div>

          <div className="pt-6 border-t border-stone-100">
            <h4 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">ঠিকানা <span className="text-[10px] uppercase tracking-widest text-stone-400">/ Mother's Address</span></h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-2 flex flex-col h-full justify-end"><BiLabel bn="গ্রাম" en="Village" /><input type="text" name="motherVillage" defaultValue={student.mother_village || ''} className={inputClass} /></div>
              <div className="flex flex-col h-full justify-end"><BiLabel bn="ডাকঘর" en="Post Office" /><input type="text" name="motherPostOffice" defaultValue={student.mother_post_office || ''} className={inputClass} /></div>
              <div className="flex flex-col h-full justify-end"><BiLabel bn="পোস্ট কোড" en="Post Code" /><input type="text" name="motherPostCode" defaultValue={student.mother_post_code || ''} className={inputClass} /></div>
              <div className="flex flex-col h-full justify-end"><BiLabel bn="উপজেলা" en="Upazila" /><input type="text" name="motherUpazila" defaultValue={student.mother_upazila || ''} className={inputClass} /></div>
            </div>
          </div>
        </div>

        {/* SECTION 4: Guardian's Info */}
        <div className="bg-white p-6 md:p-8 border border-stone-200 rounded-sm shadow-sm relative z-[20]">
          <SectionHeader bn="অভিভাবকের তথ্য" en="Guardian's Info" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="flex flex-col h-full justify-end"><BiLabel bn="নাম (বাংলায়)" en="Name (BN)" /><input type="text" name="guardianNameBn" defaultValue={student.guardian_name_bn || ''} className={inputClass} /></div>
            <div className="flex flex-col h-full justify-end"><BiLabel bn="ইংরেজিতে" en="Name (EN)" /><input type="text" name="guardianNameEn" defaultValue={student.guardian_name_en || ''} className={inputClass} /></div>
            <div className="flex flex-col h-full justify-end"><BiLabel bn="সম্পর্ক" en="Relation" /><input type="text" name="guardianRelation" defaultValue={student.guardian_relation || ''} className={inputClass} /></div>
            
            <div className="flex flex-col h-full justify-end"><BiLabel bn="শিক্ষাগত যোগ্যতা" en="Education" /><input type="text" name="guardianEdu" defaultValue={student.guardian_edu || ''} className={inputClass} /></div>
            <div className="flex flex-col h-full justify-end"><BiLabel bn="জাতীয় পরিচয়পত্র" en="Smart Card No" /><input type="text" name="guardianNid" defaultValue={student.guardian_nid || ''} className={inputClass} /></div>
            <div className="flex flex-col h-full justify-end"><BiLabel bn="জন্ম তারিখ" en="Date of Birth" /><input type="date" name="guardianDob" defaultValue={student.guardian_dob || ''} className={inputClass} /></div>
          </div>

          <div className="pt-6 border-t border-stone-100">
            <h4 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">ঠিকানা <span className="text-[10px] uppercase tracking-widest text-stone-400">/ Guardian's Address</span></h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-2 flex flex-col h-full justify-end"><BiLabel bn="গ্রাম" en="Village" /><input type="text" name="guardianVillage" defaultValue={student.guardian_village || ''} className={inputClass} /></div>
              <div className="flex flex-col h-full justify-end"><BiLabel bn="ডাকঘর" en="Post Office" /><input type="text" name="guardianPostOffice" defaultValue={student.guardian_post_office || ''} className={inputClass} /></div>
              <div className="flex flex-col h-full justify-end"><BiLabel bn="পোস্ট কোড" en="Post Code" /><input type="text" name="guardianPostCode" defaultValue={student.guardian_post_code || ''} className={inputClass} /></div>
              <div className="flex flex-col h-full justify-end"><BiLabel bn="উপজেলা" en="Upazila" /><input type="text" name="guardianUpazila" defaultValue={student.guardian_upazila || ''} className={inputClass} /></div>
            </div>
          </div>
        </div>

        {/* SECTION 5: Mobile & Banking */}
        <div className="bg-white p-6 md:p-8 border border-stone-200 rounded-sm shadow-sm relative z-[10]">
          <SectionHeader bn="মোবাইল নম্বর ও ব্যাংকিং" en="Mobile & Banking" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Father */}
            <div className="bg-stone-50 border border-stone-200 p-6 rounded-sm flex flex-col justify-between h-full">
              <div>
                <BiLabel bn="পিতার মোবাইল" en="Father's Mobile" />
                <input type="tel" name="fatherMobile" defaultValue={student.father_mobile || ''} className={inputClass} />
              </div>
              <div className="relative z-30 pt-5 mt-5 border-t border-stone-200">
                <BiLabel bn="ব্যাংকিং অপারেটর" en="Banking" />
                <Dropdown options={bankingOptions} value={fatherBanking} onChange={(val) => setFatherBanking(val)} placeholder="Select Operator" />
              </div>
            </div>

            {/* Mother */}
            <div className="bg-stone-50 border border-stone-200 p-6 rounded-sm flex flex-col justify-between h-full">
              <div>
                <BiLabel bn="মাতার মোবাইল" en="Mother's Mobile" />
                <input type="tel" name="motherMobile" defaultValue={student.mother_mobile || ''} className={inputClass} />
              </div>
              <div className="relative z-30 pt-5 mt-5 border-t border-stone-200">
                <BiLabel bn="ব্যাংকিং অপারেটর" en="Banking" />
                <Dropdown options={bankingOptions} value={motherBanking} onChange={(val) => setMotherBanking(val)} placeholder="Select Operator" />
              </div>
            </div>

            {/* Guardian */}
            <div className="bg-stone-50 border border-stone-200 p-6 rounded-sm flex flex-col justify-between h-full">
              <div>
                <BiLabel bn="অভিভাবকের মোবাইল" en="Guardian's Mobile" />
                <input type="tel" name="guardianMobile" defaultValue={student.guardian_mobile || student.guardian_phone || ''} className={inputClass} />
              </div>
              <div className="relative z-30 pt-5 mt-5 border-t border-stone-200">
                <BiLabel bn="ব্যাংকিং অপারেটর" en="Banking" />
                <Dropdown options={bankingOptions} value={guardianBanking} onChange={(val) => setGuardianBanking(val)} placeholder="Select Operator" />
              </div>
            </div>

          </div>
        </div>

        {/* Submit Footer */}
        <div className="pt-4 pb-12 relative z-0">
          <button 
            type="submit" 
            disabled={isSubmitting} 
            className="w-full bg-[#6b4c9a] text-white py-5 rounded-sm hover:bg-[#5a3f82] transition-colors font-bold tracking-widest uppercase disabled:opacity-50 text-xs shadow-sm flex items-center justify-center gap-2"
          >
            {isSubmitting ? 'Saving Changes...' : 'Save Profile Updates'}
          </button>
        </div>
      </form>
    </div>
  )
}