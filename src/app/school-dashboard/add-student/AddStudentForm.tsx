'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import PhotoEditor from '@/components/PhotoEditor'
import Dropdown from '@/components/ui/dropdown'
import { addStudent, addBulkStudents, validateRollNumbers } from '@/app/actions/student-actions'
import { getCloudinaryAuth } from '@/app/actions/cloudinary-actions'
import * as XLSX from 'xlsx'

// --- Helpers ---
const toTitleCase = (str: string) => {
  if (!str) return ''
  return str.toString().toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

const parseExcelDate = (excelDate: any): string | null => {
  if (!excelDate) return null;
  if (typeof excelDate === 'number') {
    const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
    return date.toISOString().split('T')[0];
  }
  const parsed = new Date(excelDate);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return null;
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

interface ClassData { id: string; name: string }

export default function AddStudentForm({ schoolId, classes }: { schoolId: string, classes: ClassData[] }) {
  const router = useRouter()
  
  // --- UI State ---
  const [entryMode, setEntryMode] = useState<'single' | 'bulk'>('single')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // --- Single Entry Custom Dropdown States ---
  const [classId, setClassId] = useState<string | number>('')
  const [gender, setGender] = useState<string | number>('')
  const [bloodGroup, setBloodGroup] = useState<string | number>('')
  const [fatherBanking, setFatherBanking] = useState<string | number>('')
  const [motherBanking, setMotherBanking] = useState<string | number>('')
  const [guardianBanking, setGuardianBanking] = useState<string | number>('')

  // --- Photo State ---
  const [editorImage, setEditorImage] = useState<string | null>(null)
  const [finalPhotoBase64, setFinalPhotoBase64] = useState<string>('')
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // --- Bulk Entry State ---
  const [parsedBulkData, setParsedBulkData] = useState<any[]>([])
  const [selectedBulkClassId, setSelectedBulkClassId] = useState<string | number>('')
  const bulkFileInputRef = useRef<HTMLInputElement>(null)

  // --- Dropdown Options ---
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

  // --- Single Entry Handlers ---
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

  // --- Bulk Excel Handlers ---
  const handleBulkFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const data = event.target?.result
      const workbook = XLSX.read(data, { type: 'binary' })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      const rawJson = XLSX.utils.sheet_to_json(worksheet)

      const normalizedData = rawJson.map((row: any) => {
        const newRow: any = { error: null }
        Object.keys(row).forEach(key => {
          const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '')
          const rawValue = row[key]
          if (rawValue === undefined || rawValue === null) return
          const valStr = rawValue.toString().trim()

          // Basic
          if (['roll', 'rollno', 'enrollmentid'].includes(cleanKey)) newRow.enrollmentId = valStr
          else if (['nameen', 'studentnameen', 'nameenglish', 'name', 'studentname'].includes(cleanKey)) newRow.studentNameEn = toTitleCase(valStr)
          else if (['namebn', 'studentnamebn', 'namebangla'].includes(cleanKey)) newRow.nameBangla = valStr
          else if (cleanKey === 'admissionyear') newRow.admissionYear = valStr
          else if (cleanKey === 'previousroll') newRow.previousRoll = valStr
          else if (cleanKey === 'birthregno') newRow.birthRegNo = valStr
          else if (['dob', 'dateofbirth'].includes(cleanKey)) newRow.dateOfBirth = parseExcelDate(rawValue)
          else if (['gender', 'sex'].includes(cleanKey)) newRow.gender = toTitleCase(valStr)
          else if (['bloodgroup', 'bg'].includes(cleanKey)) newRow.bloodGroup = valStr.toUpperCase()
          
          // Address
          else if (cleanKey === 'village') newRow.village = valStr
          else if (cleanKey === 'postoffice') newRow.postOffice = valStr
          else if (cleanKey === 'postcode') newRow.postCode = valStr
          else if (cleanKey === 'upazila') newRow.upazila = valStr

          // Father
          else if (cleanKey === 'fathernameen') newRow.fatherNameEn = toTitleCase(valStr)
          else if (cleanKey === 'fathernamebn') newRow.fatherNameBn = valStr
          else if (cleanKey === 'fatheredu') newRow.fatherEdu = valStr
          else if (cleanKey === 'fatherfathername') newRow.fatherFatherName = valStr
          else if (cleanKey === 'fathermothername') newRow.fatherMotherName = valStr
          else if (cleanKey === 'fathernid') newRow.fatherNid = valStr
          else if (cleanKey === 'fatherdob') newRow.fatherDob = parseExcelDate(rawValue)
          else if (cleanKey === 'fathervillage') newRow.fatherVillage = valStr
          else if (cleanKey === 'fatherpostoffice') newRow.fatherPostOffice = valStr
          else if (cleanKey === 'fatherpostcode') newRow.fatherPostCode = valStr
          else if (cleanKey === 'fatherupazila') newRow.fatherUpazila = valStr
          else if (cleanKey === 'fathermobile') newRow.fatherMobile = valStr
          else if (cleanKey === 'fathermobilebanking') newRow.fatherMobileBanking = valStr

          // Mother
          else if (cleanKey === 'mothernameen') newRow.motherNameEn = toTitleCase(valStr)
          else if (cleanKey === 'mothernamebn') newRow.motherNameBn = valStr
          else if (cleanKey === 'motheredu') newRow.motherEdu = valStr
          else if (cleanKey === 'motherfathername') newRow.motherFatherName = valStr
          else if (cleanKey === 'mothermothername') newRow.motherMotherName = valStr
          else if (cleanKey === 'mothernid') newRow.motherNid = valStr
          else if (cleanKey === 'motherdob') newRow.motherDob = parseExcelDate(rawValue)
          else if (cleanKey === 'mothervillage') newRow.motherVillage = valStr
          else if (cleanKey === 'motherpostoffice') newRow.motherPostOffice = valStr
          else if (cleanKey === 'motherpostcode') newRow.motherPostCode = valStr
          else if (cleanKey === 'motherupazila') newRow.motherUpazila = valStr
          else if (cleanKey === 'mothermobile') newRow.motherMobile = valStr
          else if (cleanKey === 'mothermobilebanking') newRow.motherMobileBanking = valStr

          // Guardian
          else if (['guardiannameen', 'guardianname', 'guardian'].includes(cleanKey)) newRow.guardianNameEn = toTitleCase(valStr)
          else if (cleanKey === 'guardiannamebn') newRow.guardianNameBn = valStr
          else if (cleanKey === 'guardianrelation') newRow.guardianRelation = valStr
          else if (cleanKey === 'guardianedu') newRow.guardianEdu = valStr
          else if (cleanKey === 'guardiannid') newRow.guardianNid = valStr
          else if (cleanKey === 'guardiandob') newRow.guardianDob = parseExcelDate(rawValue)
          else if (cleanKey === 'guardianvillage') newRow.guardianVillage = valStr
          else if (cleanKey === 'guardianpostoffice') newRow.guardianPostOffice = valStr
          else if (cleanKey === 'guardianpostcode') newRow.guardianPostCode = valStr
          else if (cleanKey === 'guardianupazila') newRow.guardianUpazila = valStr
          else if (['guardianmobile', 'guardianphone', 'phone', 'mobile'].includes(cleanKey)) newRow.guardianMobile = valStr
          else if (cleanKey === 'guardianmobilebanking') newRow.guardianMobileBanking = valStr
        })
        return newRow
      }).filter((row: any) => row.studentNameEn && row.enrollmentId)

      if (normalizedData.length === 0) {
        alert("Could not find valid 'Name' and 'Roll' columns in the Excel file.")
        return
      }

      setParsedBulkData(normalizedData)
    }
    reader.readAsBinaryString(file)
    if (bulkFileInputRef.current) bulkFileInputRef.current.value = ''
  }

  const handleBulkSubmit = async () => {
    if (!selectedBulkClassId) return alert("Please select a class for this batch.")
    if (parsedBulkData.length === 0) return alert("No valid data to import.")
    
    setIsSubmitting(true)
    try {
      const rolls = parsedBulkData.map(d => d.enrollmentId)
      
      const rollCounts: Record<string, number> = {}
      parsedBulkData.forEach(row => {
        rollCounts[row.enrollmentId] = (rollCounts[row.enrollmentId] || 0) + 1
      })

      const existingStudents = await validateRollNumbers(String(selectedBulkClassId), rolls)

      let hasErrors = false
      const updatedData = parsedBulkData.map(row => {
        if (rollCounts[row.enrollmentId] > 1) {
          hasErrors = true
          return { ...row, error: `Roll ${row.enrollmentId} is duplicated in your Excel file.` }
        }
        const conflict = existingStudents.find((e: any) => e.enrollment_id === row.enrollmentId)
        if (conflict) {
          hasErrors = true
          return { ...row, error: `Taken by: ${conflict.first_name}` }
        }
        return { ...row, error: null }
      })

      if (hasErrors) {
        setParsedBulkData(updatedData)
        alert("Duplicate Roll Numbers detected! Please change the highlighted roll numbers in the preview table before importing.")
        setIsSubmitting(false)
        return 
      }

      await addBulkStudents(schoolId, String(selectedBulkClassId), parsedBulkData)
      alert(`Successfully enrolled ${parsedBulkData.length} students!`)
      setParsedBulkData([])
      setSelectedBulkClassId('')
      router.refresh()
      router.push('/school-dashboard/students')
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateRow = (index: number, field: string, value: string) => {
    const newData = [...parsedBulkData]
    newData[index][field] = value
    newData[index].error = null 
    setParsedBulkData(newData)
  }

  return (
    <div className="font-sans w-full">
      {editorImage && <PhotoEditor initialImage={editorImage} onCancel={() => setEditorImage(null)} onComplete={handleEditorComplete} />}

      {/* Mode Switcher */}
      <div className="flex bg-stone-100 p-1.5 rounded-sm w-full md:w-max mb-8 border border-stone-200">
        <button 
          onClick={() => setEntryMode('single')} 
          className={`flex-1 md:flex-none px-6 py-3 text-[10px] font-bold uppercase tracking-widest rounded-sm transition-all ${entryMode === 'single' ? 'bg-white shadow-sm text-[#6b4c9a]' : 'text-stone-500 hover:text-stone-700'}`}
        >
          Detailed Admission
        </button>
        <button 
          onClick={() => setEntryMode('bulk')} 
          className={`flex-1 md:flex-none px-6 py-3 text-[10px] font-bold uppercase tracking-widest rounded-sm transition-all ${entryMode === 'bulk' ? 'bg-white shadow-sm text-[#6b4c9a]' : 'text-stone-500 hover:text-stone-700'}`}
        >
          Bulk Excel Import
        </button>
      </div>

      {/* --- SINGLE ENTRY MODE --- */}
      {entryMode === 'single' && (
        <form 
          action={async (formData) => {
            if (isSubmitting) return
            if (!classId) return alert("Please select a Class!")
            setIsSubmitting(true)
            
            try {
              const enrollmentId = formData.get('enrollmentId') as string
              const existing = await validateRollNumbers(String(classId), [enrollmentId])
              
              if (existing.length > 0) {
                alert(`Error: Roll No ${enrollmentId} is already assigned to ${existing[0].first_name} in this class. Please choose a different roll.`)
                setIsSubmitting(false)
                return
              }

              if (finalPhotoBase64) {
                const folderName = `school_${schoolId}_students`
                const auth = await getCloudinaryAuth(folderName)
                const uploadForm = new FormData()
                uploadForm.append('file', finalPhotoBase64); uploadForm.append('api_key', auth.apiKey); uploadForm.append('timestamp', auth.timestamp.toString()); uploadForm.append('signature', auth.signature); uploadForm.append('folder', folderName); uploadForm.append('transformation', auth.transformation)
                const res = await fetch(`https://api.cloudinary.com/v1_1/${auth.cloudName}/image/upload`, { method: 'POST', body: uploadForm })
                const data = await res.json()
                if (!res.ok) throw new Error(data.error?.message || 'Cloudinary browser upload failed')
                formData.append('uploadedPhotoUrl', data.secure_url)
              }

              formData.append('classId', String(classId))
              formData.append('gender', String(gender))
              formData.append('bloodGroup', String(bloodGroup))
              formData.append('fatherMobileBanking', String(fatherBanking))
              formData.append('motherMobileBanking', String(motherBanking))
              formData.append('guardianMobileBanking', String(guardianBanking))

              formData.set('studentNameEn', toTitleCase(formData.get('studentNameEn') as string))
              formData.set('fatherNameEn', toTitleCase(formData.get('fatherNameEn') as string))
              formData.set('motherNameEn', toTitleCase(formData.get('motherNameEn') as string))
              formData.set('guardianNameEn', toTitleCase(formData.get('guardianNameEn') as string))

              const result = await addStudent(formData)
              if (result?.success) {
                alert("Student enrolled successfully!") 
                router.refresh()
                router.push('/school-dashboard/students')
              }
            } catch (error: any) {
              setIsSubmitting(false)
              alert(`Error: ${error.message || "Failed to add student"}`)
            }
          }} 
          className="flex flex-col gap-8"
        >
          <input type="hidden" name="schoolId" value={schoolId} />

          {/* BLOCK 1: Academic & Photo */}
          <div className="bg-white p-6 md:p-8 border border-stone-200 rounded-sm shadow-sm flex flex-col md:flex-row gap-8 items-start">
            <div className="flex flex-col items-center gap-4 shrink-0 w-full md:w-auto">
              <div className="w-40 h-40 rounded-sm border-2 border-stone-200 shadow-sm bg-stone-50 overflow-hidden flex items-center justify-center p-1">
                <div className="w-full h-full bg-white border border-stone-100 flex items-center justify-center">
                  {previewUrl ? <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" /> : <span className="text-xl font-bold text-stone-300">ছবি</span>}
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()} 
                className="w-full md:w-40 bg-white text-stone-600 border border-stone-200 px-4 py-3 rounded-sm hover:bg-stone-50 hover:text-[#6b4c9a] font-bold text-[10px] uppercase tracking-widest transition-colors shadow-sm"
              >
                Upload Photo
              </button>
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
                  <input type="text" name="enrollmentId" required className={inputClass} />
                </div>
                <div className="flex flex-col h-full justify-end">
                  <BiLabel bn="ভর্তির বছর" en="Year" />
                  <input type="text" name="admissionYear" placeholder="e.g. 2026" className={inputClass} />
                </div>
                <div className="flex flex-col h-full justify-end">
                  <BiLabel bn="পুনরাবৃত্তি রোল" en="Prev Roll" />
                  <input type="text" name="previousRoll" className={inputClass} />
                </div>
              </div>
            </div>
          </div>

          {/* BLOCK 2: Student Identity */}
          <div className="bg-white p-6 md:p-8 border border-stone-200 rounded-sm shadow-sm relative z-[50]">
            <SectionHeader bn="শিক্ষার্থীর তথ্য" en="Student Info" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="flex flex-col h-full justify-end"><BiLabel bn="নাম (বাংলায়)" en="Name (Bangla)" /><input type="text" name="nameBangla" className={inputClass} /></div>
              <div className="flex flex-col h-full justify-end"><BiLabel bn="ইংরেজিতে" en="Name (English)" required /><input type="text" name="studentNameEn" required className={inputClass} /></div>
              <div className="flex flex-col h-full justify-end"><BiLabel bn="জন্ম নিবন্ধন নং" en="Birth Reg No" /><input type="text" name="birthRegNo" className={inputClass} /></div>
              
              <div className="flex flex-col h-full justify-end"><BiLabel bn="জন্ম তারিখ" en="Date of Birth" /><input type="date" name="dateOfBirth" className={inputClass} /></div>
              
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
              <h4 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">ঠিকানা <span className="text-[10px] uppercase tracking-widest text-stone-400">/ Address</span></h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-2 flex flex-col h-full justify-end"><BiLabel bn="গ্রাম" en="Village" /><input type="text" name="village" className={inputClass} /></div>
                <div className="flex flex-col h-full justify-end"><BiLabel bn="ডাকঘর" en="Post Office" /><input type="text" name="postOffice" className={inputClass} /></div>
                <div className="flex flex-col h-full justify-end"><BiLabel bn="পোস্ট কোড" en="Post Code" /><input type="text" name="postCode" className={inputClass} /></div>
                <div className="flex flex-col h-full justify-end"><BiLabel bn="উপজেলা" en="Upazila" /><input type="text" name="upazila" className={inputClass} /></div>
              </div>
            </div>
          </div>

          {/* BLOCK 3: Father's Info */}
          <div className="bg-white p-6 md:p-8 border border-stone-200 rounded-sm shadow-sm relative z-[40]">
            <SectionHeader bn="পিতার তথ্য" en="Father's Info" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="flex flex-col h-full justify-end"><BiLabel bn="নাম (বাংলায়)" en="Name (BN)" /><input type="text" name="fatherNameBn" className={inputClass} /></div>
              <div className="flex flex-col h-full justify-end"><BiLabel bn="ইংরেজিতে" en="Name (EN)" /><input type="text" name="fatherNameEn" className={inputClass} /></div>
              <div className="flex flex-col h-full justify-end"><BiLabel bn="শিক্ষাগত যোগ্যতা" en="Education" /><input type="text" name="fatherEdu" className={inputClass} /></div>
              
              <div className="flex flex-col h-full justify-end"><BiLabel bn="পিতার নাম" en="Father's Name" /><input type="text" name="fatherFatherName" className={inputClass} /></div>
              <div className="flex flex-col h-full justify-end"><BiLabel bn="মাতার নাম" en="Mother's Name" /><input type="text" name="fatherMotherName" className={inputClass} /></div>
              <div className="flex flex-col h-full justify-end"><BiLabel bn="জাতীয় পরিচয়পত্র" en="Smart Card No" /><input type="text" name="fatherNid" className={inputClass} /></div>
              
              <div className="flex flex-col h-full justify-end lg:col-span-3"><BiLabel bn="জন্ম তারিখ" en="Date of Birth" /><input type="date" name="fatherDob" className={inputClass} /></div>
            </div>

            <div className="pt-6 border-t border-stone-100">
              <h4 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">ঠিকানা <span className="text-[10px] uppercase tracking-widest text-stone-400">/ Father's Address</span></h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-2 flex flex-col h-full justify-end"><BiLabel bn="গ্রাম" en="Village" /><input type="text" name="fatherVillage" className={inputClass} /></div>
                <div className="flex flex-col h-full justify-end"><BiLabel bn="ডাকঘর" en="Post Office" /><input type="text" name="fatherPostOffice" className={inputClass} /></div>
                <div className="flex flex-col h-full justify-end"><BiLabel bn="পোস্ট কোড" en="Post Code" /><input type="text" name="fatherPostCode" className={inputClass} /></div>
                <div className="flex flex-col h-full justify-end"><BiLabel bn="উপজেলা" en="Upazila" /><input type="text" name="fatherUpazila" className={inputClass} /></div>
              </div>
            </div>
          </div>

          {/* BLOCK 4: Mother's Info */}
          <div className="bg-white p-6 md:p-8 border border-stone-200 rounded-sm shadow-sm relative z-[30]">
            <SectionHeader bn="মাতার তথ্য" en="Mother's Info" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="flex flex-col h-full justify-end"><BiLabel bn="নাম (বাংলায়)" en="Name (BN)" /><input type="text" name="motherNameBn" className={inputClass} /></div>
              <div className="flex flex-col h-full justify-end"><BiLabel bn="ইংরেজিতে" en="Name (EN)" /><input type="text" name="motherNameEn" className={inputClass} /></div>
              <div className="flex flex-col h-full justify-end"><BiLabel bn="শিক্ষাগত যোগ্যতা" en="Education" /><input type="text" name="motherEdu" className={inputClass} /></div>
              
              <div className="flex flex-col h-full justify-end"><BiLabel bn="পিতার নাম" en="Father's Name" /><input type="text" name="motherFatherName" className={inputClass} /></div>
              <div className="flex flex-col h-full justify-end"><BiLabel bn="মাতার নাম" en="Mother's Name" /><input type="text" name="motherMotherName" className={inputClass} /></div>
              <div className="flex flex-col h-full justify-end"><BiLabel bn="জাতীয় পরিচয়পত্র" en="Smart Card No" /><input type="text" name="motherNid" className={inputClass} /></div>
              
              <div className="flex flex-col h-full justify-end lg:col-span-3"><BiLabel bn="জন্ম তারিখ" en="Date of Birth" /><input type="date" name="motherDob" className={inputClass} /></div>
            </div>

            <div className="pt-6 border-t border-stone-100">
              <h4 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">ঠিকানা <span className="text-[10px] uppercase tracking-widest text-stone-400">/ Mother's Address</span></h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-2 flex flex-col h-full justify-end"><BiLabel bn="গ্রাম" en="Village" /><input type="text" name="motherVillage" className={inputClass} /></div>
                <div className="flex flex-col h-full justify-end"><BiLabel bn="ডাকঘর" en="Post Office" /><input type="text" name="motherPostOffice" className={inputClass} /></div>
                <div className="flex flex-col h-full justify-end"><BiLabel bn="পোস্ট কোড" en="Post Code" /><input type="text" name="motherPostCode" className={inputClass} /></div>
                <div className="flex flex-col h-full justify-end"><BiLabel bn="উপজেলা" en="Upazila" /><input type="text" name="motherUpazila" className={inputClass} /></div>
              </div>
            </div>
          </div>

          {/* BLOCK 5: Guardian's Info */}
          <div className="bg-white p-6 md:p-8 border border-stone-200 rounded-sm shadow-sm relative z-[20]">
            <SectionHeader bn="অভিভাবকের তথ্য" en="Guardian's Info" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="flex flex-col h-full justify-end"><BiLabel bn="নাম (বাংলায়)" en="Name (BN)" /><input type="text" name="guardianNameBn" className={inputClass} /></div>
              <div className="flex flex-col h-full justify-end"><BiLabel bn="ইংরেজিতে" en="Name (EN)" /><input type="text" name="guardianNameEn" className={inputClass} /></div>
              <div className="flex flex-col h-full justify-end"><BiLabel bn="সম্পর্ক" en="Relation" /><input type="text" name="guardianRelation" className={inputClass} /></div>
              
              <div className="flex flex-col h-full justify-end"><BiLabel bn="শিক্ষাগত যোগ্যতা" en="Education" /><input type="text" name="guardianEdu" className={inputClass} /></div>
              <div className="flex flex-col h-full justify-end"><BiLabel bn="জাতীয় পরিচয়পত্র" en="Smart Card No" /><input type="text" name="guardianNid" className={inputClass} /></div>
              <div className="flex flex-col h-full justify-end"><BiLabel bn="জন্ম তারিখ" en="Date of Birth" /><input type="date" name="guardianDob" className={inputClass} /></div>
            </div>

            <div className="pt-6 border-t border-stone-100">
              <h4 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">ঠিকানা <span className="text-[10px] uppercase tracking-widest text-stone-400">/ Guardian's Address</span></h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-2 flex flex-col h-full justify-end"><BiLabel bn="গ্রাম" en="Village" /><input type="text" name="guardianVillage" className={inputClass} /></div>
                <div className="flex flex-col h-full justify-end"><BiLabel bn="ডাকঘর" en="Post Office" /><input type="text" name="guardianPostOffice" className={inputClass} /></div>
                <div className="flex flex-col h-full justify-end"><BiLabel bn="পোস্ট কোড" en="Post Code" /><input type="text" name="guardianPostCode" className={inputClass} /></div>
                <div className="flex flex-col h-full justify-end"><BiLabel bn="উপজেলা" en="Upazila" /><input type="text" name="guardianUpazila" className={inputClass} /></div>
              </div>
            </div>
          </div>

          {/* BLOCK 6: Mobile & Banking */}
          <div className="bg-white p-6 md:p-8 border border-stone-200 rounded-sm shadow-sm relative z-[10]">
            <SectionHeader bn="মোবাইল নম্বর ও ব্যাংকিং" en="Mobile & Banking" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Father */}
              <div className="bg-stone-50 border border-stone-200 p-6 rounded-sm flex flex-col justify-between">
                <div>
                  <BiLabel bn="পিতার মোবাইল" en="Father's Mobile" />
                  <input type="tel" name="fatherMobile" className={inputClass} />
                </div>
                <div className="relative z-30 pt-5 mt-5 border-t border-stone-200">
                  <BiLabel bn="ব্যাংকিং অপারেটর" en="Banking" />
                  <Dropdown options={bankingOptions} value={fatherBanking} onChange={(val) => setFatherBanking(val as string)} placeholder="Select Operator" />
                </div>
              </div>

              {/* Mother */}
              <div className="bg-stone-50 border border-stone-200 p-6 rounded-sm flex flex-col justify-between">
                <div>
                  <BiLabel bn="মাতার মোবাইল" en="Mother's Mobile" />
                  <input type="tel" name="motherMobile" className={inputClass} />
                </div>
                <div className="relative z-30 pt-5 mt-5 border-t border-stone-200">
                  <BiLabel bn="ব্যাংকিং অপারেটর" en="Banking" />
                  <Dropdown options={bankingOptions} value={motherBanking} onChange={(val) => setMotherBanking(val as string)} placeholder="Select Operator" />
                </div>
              </div>

              {/* Guardian */}
              <div className="bg-stone-50 border border-stone-200 p-6 rounded-sm flex flex-col justify-between">
                <div>
                  <BiLabel bn="অভিভাবকের মোবাইল" en="Guardian's Mobile" />
                  <input type="tel" name="guardianMobile" className={inputClass} />
                </div>
                <div className="relative z-30 pt-5 mt-5 border-t border-stone-200">
                  <BiLabel bn="ব্যাংকিং অপারেটর" en="Banking" />
                  <Dropdown options={bankingOptions} value={guardianBanking} onChange={(val) => setGuardianBanking(val as string)} placeholder="Select Operator" />
                </div>
              </div>

            </div>
          </div>

          <div className="pt-6 pb-12 relative z-0">
            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="w-full bg-[#6b4c9a] text-white py-5 rounded-sm hover:bg-[#5a3f82] transition-colors font-bold tracking-widest uppercase disabled:opacity-50 text-xs shadow-sm flex items-center justify-center gap-2"
            >
              {isSubmitting ? 'Registering Student...' : 'Complete Enrollment Process'}
            </button>
          </div>
        </form>
      )}

      {/* --- BULK ENTRY --- */}
      {entryMode === 'bulk' && (
        <div className="space-y-6 md:space-y-8">
          <div className="bg-[#fcf8f8] border border-[#b4483e]/20 p-5 md:p-6 rounded-sm flex gap-4 text-[#b4483e]">
            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <p className="text-sm leading-relaxed tracking-wide font-medium text-stone-700">
              <strong className="text-[#b4483e] font-bold uppercase tracking-widest text-[10px] block mb-1">Administrative Note</strong>
              Bulk import handles comprehensive academic and personal data mapping. Biometric photos must be updated individually from the student profile page after import.
            </p>
          </div>

          <div className="bg-white border border-stone-200 p-6 md:p-8 rounded-sm shadow-sm flex flex-col md:flex-row gap-8 items-start relative z-50">
            <div className="w-full md:flex-1">
              <label className="block text-[10px] font-bold tracking-widest uppercase text-stone-600 mb-3">1. Target Class for this Batch</label>
              <Dropdown 
                options={classOptions} 
                value={selectedBulkClassId} 
                onChange={(val) => setSelectedBulkClassId(val)} 
                placeholder="-- Choose Destination Class --" 
                hasSearch 
              />
            </div>
            <div className="w-full md:flex-1">
              <label className="block text-[10px] font-bold tracking-widest uppercase text-stone-600 mb-3">2. Upload Excel/CSV File</label>
              <input 
                type="file" 
                accept=".xlsx, .xls, .csv" 
                ref={bulkFileInputRef} 
                onChange={handleBulkFileUpload} 
                className="block w-full text-sm text-stone-500 file:mr-4 file:py-3 file:px-5 file:rounded-sm file:border-0 file:text-[10px] file:font-bold file:uppercase file:tracking-widest file:bg-stone-900 file:text-white hover:file:bg-stone-800 cursor-pointer border border-stone-200 rounded-sm bg-stone-50 transition-colors" 
              />
            </div>
          </div>

          {parsedBulkData.length > 0 && (
            <div className="bg-white border border-stone-200 rounded-sm overflow-hidden shadow-sm">
              <div className="bg-[#fbf9fc] p-6 border-b border-[#dad3e3] flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                  <h3 className="font-bold text-stone-900 text-lg tracking-wide uppercase">Data Validation</h3>
                  <p className="text-[10px] text-[#6b4c9a] uppercase tracking-widest font-bold mt-1">✓ Loaded {parsedBulkData.length} valid rows. Please verify duplicates.</p>
                </div>
                <button 
                  onClick={handleBulkSubmit} 
                  disabled={isSubmitting} 
                  className="w-full md:w-auto bg-emerald-700 text-white px-8 py-3.5 rounded-sm text-[10px] tracking-widest uppercase font-bold hover:bg-emerald-800 transition-colors disabled:opacity-50 shadow-sm"
                >
                  {isSubmitting ? 'Validating & Importing...' : `Verify & Import ${parsedBulkData.length} Students`}
                </button>
              </div>
              <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
                <table className="w-full text-left text-sm whitespace-nowrap min-w-max">
                  <thead className="bg-stone-100 text-stone-600 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="p-4 font-bold border-b border-stone-200 uppercase tracking-widest text-[10px]">Roll No</th>
                      <th className="p-4 font-bold border-b border-stone-200 uppercase tracking-widest text-[10px]">Name (EN)</th>
                      <th className="p-4 font-bold border-b border-stone-200 uppercase tracking-widest text-[10px]">Name (BN)</th>
                      <th className="p-4 font-bold border-b border-stone-200 uppercase tracking-widest text-[10px]">DOB</th>
                      <th className="p-4 font-bold border-b border-stone-200 uppercase tracking-widest text-[10px]">Blood Grp</th>
                      <th className="p-4 font-bold border-b border-stone-200 uppercase tracking-widest text-[10px]">Village</th>
                      <th className="p-4 font-bold border-b border-stone-200 uppercase tracking-widest text-[10px]">Father's Name</th>
                      <th className="p-4 font-bold border-b border-stone-200 uppercase tracking-widest text-[10px]">Father's Mobile</th>
                      <th className="p-4 font-bold border-b border-stone-200 uppercase tracking-widest text-[10px]">Mother's Name</th>
                      <th className="p-4 font-bold border-b border-stone-200 uppercase tracking-widest text-[10px]">Mother's Mobile</th>
                      <th className="p-4 font-bold border-b border-stone-200 uppercase tracking-widest text-[10px] bg-stone-200">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {parsedBulkData.map((row, idx) => (
                      <tr key={idx} className={row.error ? 'bg-[#fcf8f8]' : 'hover:bg-stone-50'}>
                        <td className="p-2">
                          <input 
                            type="text" 
                            value={row.enrollmentId} 
                            onChange={e => updateRow(idx, 'enrollmentId', e.target.value)} 
                            className={`w-20 p-2.5 border rounded-sm text-sm font-bold transition-colors ${row.error ? 'border-[#b4483e]/50 bg-white text-[#b4483e] focus:ring-[#b4483e]' : 'bg-transparent border-transparent hover:border-stone-300 focus:bg-white focus:border-[#6b4c9a] text-stone-900'} focus:outline-none focus:ring-1`} 
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="text" 
                            value={row.studentNameEn} 
                            onChange={e => updateRow(idx, 'studentNameEn', e.target.value)} 
                            className="w-full p-2.5 border border-transparent hover:border-stone-300 rounded-sm bg-transparent focus:bg-white text-stone-900 font-bold text-sm transition-colors focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a]" 
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="text" 
                            value={row.nameBangla || ''} 
                            onChange={e => updateRow(idx, 'nameBangla', e.target.value)} 
                            className="w-full p-2.5 border border-transparent hover:border-stone-300 rounded-sm bg-transparent focus:bg-white text-stone-900 font-bold text-sm transition-colors focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a]" 
                          />
                        </td>
                        <td className="p-4 text-stone-600 font-medium">{row.dateOfBirth || '-'}</td>
                        <td className="p-4 font-bold text-[#b4483e]">{row.bloodGroup || '-'}</td>
                        <td className="p-4 text-stone-600 font-medium">{row.village || '-'}</td>
                        <td className="p-4 text-stone-600 font-medium">{row.fatherNameEn || '-'}</td>
                        <td className="p-4 text-stone-600 font-medium">{row.fatherMobile || '-'}</td>
                        <td className="p-4 text-stone-600 font-medium">{row.motherNameEn || '-'}</td>
                        <td className="p-4 text-stone-600 font-medium">{row.motherMobile || '-'}</td>
                        <td className={`p-4 text-xs font-bold uppercase tracking-widest ${row.error ? 'text-[#b4483e]' : 'text-emerald-700'}`}>
                          {row.error ? row.error : 'Valid Record'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}