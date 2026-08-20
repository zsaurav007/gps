'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import PhotoEditor from '@/components/PhotoEditor'
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

interface ClassData { id: string; name: string }

export default function AddStudentForm({ schoolId, classes }: { schoolId: string, classes: ClassData[] }) {
  const router = useRouter()
  
  // --- UI State ---
  const [entryMode, setEntryMode] = useState<'single' | 'bulk'>('single')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // --- Single Entry State ---
  const [editorImage, setEditorImage] = useState<string | null>(null)
  const [finalPhotoBase64, setFinalPhotoBase64] = useState<string>('')
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // --- Bulk Entry State ---
  const [parsedBulkData, setParsedBulkData] = useState<any[]>([])
  const [selectedBulkClassId, setSelectedBulkClassId] = useState('')
  const bulkFileInputRef = useRef<HTMLInputElement>(null)

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

      // Smart Parser & Formatter
      const normalizedData = rawJson.map((row: any) => {
        const newRow: any = { error: null }
        Object.keys(row).forEach(key => {
          const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '')
          const rawValue = row[key]
          
          if (cleanKey.includes('guardian') || cleanKey.includes('parent') || cleanKey.includes('father') || cleanKey.includes('mother')) {
            if (cleanKey.includes('phone') || cleanKey.includes('mobile')) newRow.guardianPhone = rawValue.toString().trim()
            else newRow.guardianName = toTitleCase(rawValue)
          }
          else if (cleanKey.includes('first') || cleanKey === 'name' || cleanKey === 'studentname') {
            newRow.firstName = toTitleCase(rawValue)
          }
          else if (cleanKey.includes('last')) {
            newRow.lastName = toTitleCase(rawValue)
          }
          else if (cleanKey.includes('roll') || cleanKey.includes('enrollment') || cleanKey === 'id') {
            newRow.enrollmentId = rawValue.toString().trim()
          }
          else if (cleanKey.includes('dob') || cleanKey.includes('birth')) {
            newRow.dateOfBirth = parseExcelDate(rawValue) 
          }
          else if (cleanKey.includes('gender') || cleanKey.includes('sex')) {
            newRow.gender = toTitleCase(rawValue)
          }
          // NEW: Support for Blood Group scanning in Excel files
          else if (cleanKey.includes('blood') || cleanKey.includes('group') || cleanKey === 'bg') {
            newRow.bloodGroup = rawValue.toString().trim().toUpperCase()
          }
        })
        return newRow
      }).filter((row: any) => row.firstName && row.enrollmentId)

      if (normalizedData.length === 0) {
        alert("Could not find valid 'First Name' and 'Roll' columns in the Excel file.")
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

      const existingStudents = await validateRollNumbers(selectedBulkClassId, rolls)

      let hasErrors = false
      const updatedData = parsedBulkData.map(row => {
        if (rollCounts[row.enrollmentId] > 1) {
          hasErrors = true
          return { ...row, error: `Roll ${row.enrollmentId} is duplicated in your Excel file.` }
        }
        const conflict = existingStudents.find((e: any) => e.enrollment_id === row.enrollmentId)
        if (conflict) {
          hasErrors = true
          return { ...row, error: `Taken by: ${conflict.first_name} ${conflict.last_name}` }
        }
        return { ...row, error: null }
      })

      if (hasErrors) {
        setParsedBulkData(updatedData)
        alert("Duplicate Roll Numbers detected! Please change the highlighted roll numbers in the preview table before importing.")
        setIsSubmitting(false)
        return 
      }

      await addBulkStudents(schoolId, selectedBulkClassId, parsedBulkData)
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
    <>
      {editorImage && (
        <PhotoEditor 
          initialImage={editorImage} 
          onCancel={() => setEditorImage(null)} 
          onComplete={handleEditorComplete} 
        />
      )}

      {/* Mode Switcher */}
      <div className="flex bg-gray-200 p-1 rounded-sm w-max mb-8">
        <button onClick={() => setEntryMode('single')} className={`px-6 py-2 text-sm font-bold rounded-sm transition-colors ${entryMode === 'single' ? 'bg-white shadow-sm text-slate-900' : 'text-gray-500 hover:text-gray-700'}`}>
          Single Student Entry
        </button>
        <button onClick={() => setEntryMode('bulk')} className={`px-6 py-2 text-sm font-bold rounded-sm transition-colors ${entryMode === 'bulk' ? 'bg-white shadow-sm text-slate-900' : 'text-gray-500 hover:text-gray-700'}`}>
          Bulk Excel Import
        </button>
      </div>

      {entryMode === 'single' && (
        <form 
          action={async (formData) => {
            if (isSubmitting) return
            setIsSubmitting(true)
            try {
              const classId = formData.get('classId') as string
              const enrollmentId = formData.get('enrollmentId') as string
              const existing = await validateRollNumbers(classId, [enrollmentId])
              
              if (existing.length > 0) {
                alert(`Error: Roll No ${enrollmentId} is already assigned to ${existing[0].first_name} ${existing[0].last_name} in this class. Please choose a different roll.`)
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

              formData.set('firstName', toTitleCase(formData.get('firstName') as string))
              formData.set('lastName', toTitleCase(formData.get('lastName') as string))
              formData.set('guardianName', toTitleCase(formData.get('guardianName') as string))

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

          <div className="flex flex-col sm:flex-row gap-8 items-start">
            <div className="flex flex-col items-center gap-3 w-full sm:w-1/3">
              <div className="w-32 h-32 rounded-full border-4 border-white shadow-sm bg-slate-100 overflow-hidden flex items-center justify-center">
                {previewUrl ? <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" /> : <span className="text-slate-400 text-sm font-bold">No Photo</span>}
              </div>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs bg-slate-200 text-slate-700 px-4 py-2 rounded-sm hover:bg-slate-300 font-bold">
                Select Photo
              </button>
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
            </div>

            <div className="w-full sm:w-2/3 flex flex-col gap-6">
              <div className="space-y-4">
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Academic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Class Assigned</label>
                    <select name="classId" required className="w-full p-2.5 border border-slate-300 rounded-sm bg-white font-medium text-sm">
                      <option value="">Select a class...</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Enrollment ID / Roll No</label>
                    <input type="text" name="enrollmentId" required className="w-full p-2.5 border border-slate-300 rounded-sm font-bold text-sm" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Personal Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-slate-700 mb-1">First Name</label><input type="text" name="firstName" required className="w-full p-2.5 border border-slate-300 rounded-sm text-sm font-medium" /></div>
                  <div><label className="block text-xs font-bold text-slate-700 mb-1">Last Name</label><input type="text" name="lastName" className="w-full p-2.5 border border-slate-300 rounded-sm text-sm font-medium" /></div>
                </div>
                
                {/* 3-Column Grid for Dates, Gender, and Blood Group */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Date of Birth</label>
                    <input type="date" name="dateOfBirth" className="w-full p-2.5 border border-slate-300 rounded-sm text-sm font-medium" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Gender</label>
                    <select name="gender" className="w-full p-2.5 border border-slate-300 rounded-sm bg-white text-sm font-medium">
                      <option value="">Select...</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Blood Group</label>
                    <select name="bloodGroup" className="w-full p-2.5 border border-slate-300 rounded-sm bg-white text-sm font-bold text-slate-700">
                      <option value="">Select...</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Guardian Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-slate-700 mb-1">Guardian Name</label><input type="text" name="guardianName" className="w-full p-2.5 border border-slate-300 rounded-sm text-sm font-medium" /></div>
                  <div><label className="block text-xs font-bold text-slate-700 mb-1">Guardian Phone</label><input type="tel" name="guardianPhone" className="w-full p-2.5 border border-slate-300 rounded-sm text-sm font-medium" /></div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6">
            <button type="submit" disabled={isSubmitting} className="w-full bg-slate-900 text-white py-3.5 rounded-sm hover:bg-slate-800 transition-colors font-bold disabled:opacity-50 text-base shadow-sm">
              {isSubmitting ? 'Registering Student...' : 'Complete Enrollment'}
            </button>
          </div>
        </form>
      )}

      {entryMode === 'bulk' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 p-6 rounded-sm shadow-sm flex flex-wrap gap-6 items-center justify-between">
            <div className="flex-grow max-w-md">
              <label className="block text-xs font-bold tracking-widest uppercase text-slate-500 mb-2">1. Target Class for this Batch</label>
              <select value={selectedBulkClassId} onChange={e => setSelectedBulkClassId(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-sm bg-white text-slate-900 font-bold text-sm">
                <option value="">-- Choose Destination Class --</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex-grow max-w-md">
              <label className="block text-xs font-bold tracking-widest uppercase text-slate-500 mb-2">2. Upload Excel/CSV File</label>
              <input type="file" accept=".xlsx, .xls, .csv" ref={bulkFileInputRef} onChange={handleBulkFileUpload} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-sm file:border-0 file:text-xs file:font-bold file:uppercase file:tracking-wider file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer border border-slate-300 rounded-sm bg-slate-50" />
            </div>
          </div>

          {parsedBulkData.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-sm overflow-hidden shadow-sm">
              <div className="bg-slate-50 p-5 border-b border-slate-200 flex justify-between items-center">
                <div>
                  <h3 className="font-black text-slate-900 tracking-tight">Data Preview & Validation</h3>
                  <p className="text-xs text-emerald-600 font-bold mt-1">✓ Loaded {parsedBulkData.length} valid rows. Please verify duplicates.</p>
                </div>
                <button onClick={handleBulkSubmit} disabled={isSubmitting} className="bg-emerald-600 text-white px-8 py-2.5 rounded-sm text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-sm">
                  {isSubmitting ? 'Validating & Importing...' : `Verify & Import ${parsedBulkData.length} Students`}
                </button>
              </div>
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-100 text-slate-600 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="p-3 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">Roll No</th>
                      <th className="p-3 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">First Name</th>
                      <th className="p-3 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">Last Name</th>
                      <th className="p-3 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">Gender</th>
                      <th className="p-3 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">Blood Grp</th>
                      <th className="p-3 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">Guardian</th>
                      <th className="p-3 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">Phone</th>
                      <th className="p-3 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px] bg-slate-200">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedBulkData.map((row, idx) => (
                      <tr key={idx} className={row.error ? 'bg-rose-50' : 'hover:bg-slate-50'}>
                        <td className="p-2">
                          <input type="text" value={row.enrollmentId} onChange={e => updateRow(idx, 'enrollmentId', e.target.value)} className={`w-20 p-1.5 border rounded-sm text-sm font-bold ${row.error ? 'border-rose-400 bg-rose-100 text-rose-900 focus:ring-rose-500' : 'bg-transparent border-transparent hover:border-slate-300 focus:bg-white text-slate-900'}`} />
                        </td>
                        <td className="p-2">
                          <input type="text" value={row.firstName} onChange={e => updateRow(idx, 'firstName', e.target.value)} className="w-full p-1.5 border border-transparent hover:border-slate-300 rounded-sm bg-transparent focus:bg-white text-slate-900 font-medium text-sm" />
                        </td>
                        <td className="p-2">
                          <input type="text" value={row.lastName || ''} onChange={e => updateRow(idx, 'lastName', e.target.value)} className="w-full p-1.5 border border-transparent hover:border-slate-300 rounded-sm bg-transparent focus:bg-white text-slate-900 font-medium text-sm" />
                        </td>
                        <td className="p-3 text-slate-600 font-medium">{row.gender || '-'}</td>
                        <td className="p-3 font-bold text-rose-600">{row.bloodGroup || '-'}</td>
                        <td className="p-2">
                          <input type="text" value={row.guardianName || ''} onChange={e => updateRow(idx, 'guardianName', e.target.value)} className="w-full p-1.5 border border-transparent hover:border-slate-300 rounded-sm bg-transparent focus:bg-white text-slate-600 text-sm" />
                        </td>
                        <td className="p-3 text-slate-600 font-medium">{row.guardianPhone || '-'}</td>
                        <td className={`p-3 text-xs font-bold ${row.error ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {row.error ? row.error : 'Valid'}
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
    </>
  )
}