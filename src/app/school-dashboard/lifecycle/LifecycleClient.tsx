'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import JSZip from 'jszip'
import { verifyHeadmasterPassword, executeYearEndWipe, executeSystemRestore } from '@/app/actions/lifecycle-actions'

export default function LifecycleClient({ schoolId, userId, schoolName, rawBackupData }: any) {
  const router = useRouter()
  
  // Wipe State
  const [hasDownloaded, setHasDownloaded] = useState(false)
  const [isWiping, setIsWiping] = useState(false)
  const [password, setPassword] = useState('')
  const [wipeError, setWipeError] = useState('')

  // Restore State
  const [isRestoring, setIsRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState('')

  // ==========================================
  // HYBRID ZIP ARCHIVE GENERATOR
  // ==========================================
  const handleGenerateBackup = async () => {
    const zip = new JSZip()

    // 1. Generate Machine-Readable Restore File
    zip.file("system_restore_data.json", JSON.stringify(rawBackupData, null, 2))

    // 2. Generate Human-Readable CSVs
    if (rawBackupData.students.length > 0) {
      const studentHeaders = Object.keys(rawBackupData.students[0]).join(',')
      const studentRows = rawBackupData.students.map((s: any) => Object.values(s).map(v => `"${v}"`).join(','))
      zip.file("Readable_Students.csv", [studentHeaders, ...studentRows].join('\n'))
    }

    if (rawBackupData.exams.length > 0) {
      const examHeaders = Object.keys(rawBackupData.exams[0]).join(',')
      const examRows = rawBackupData.exams.map((e: any) => Object.values(e).map(v => `"${v}"`).join(','))
      zip.file("Readable_Exams.csv", [examHeaders, ...examRows].join('\n'))
    }

    if (rawBackupData.exam_marks.length > 0) {
      // Need to stringify the JSONB breakdown_marks for CSV output
      const marksHeaders = Object.keys(rawBackupData.exam_marks[0]).join(',')
      const marksRows = rawBackupData.exam_marks.map((m: any) => 
        Object.values(m).map(v => typeof v === 'object' ? `"${JSON.stringify(v).replace(/"/g, '""')}"` : `"${v}"`).join(',')
      )
      zip.file("Readable_Exam_Marks.csv", [marksHeaders, ...marksRows].join('\n'))
    }

    // 3. Trigger Download
    const content = await zip.generateAsync({ type: "blob" })
    const url = URL.createObjectURL(content)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `${schoolName.replace(/\s+/g, '_')}_Academic_Archive_${new Date().getFullYear()}.zip`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setHasDownloaded(true) // Unlock the deletion step
  }

  // ==========================================
  // DESTRUCTIVE WIPE LOGIC
  // ==========================================
  const handleWipe = async () => {
    setWipeError('')
    if (!password) return setWipeError('Password is required.')
    
    setIsWiping(true)
    try {
      const authCheck = await verifyHeadmasterPassword(userId, password)
      if (!authCheck.success) throw new Error(authCheck.error)

      const wipeResult = await executeYearEndWipe(schoolId)
      if (!wipeResult.success) throw new Error(wipeResult.error)

      alert("Academic Year Data successfully wiped.")
      router.push('/school-dashboard')
    } catch (err: any) {
      setWipeError(err.message)
    } finally {
      setIsWiping(false)
    }
  }

  // ==========================================
  // SYSTEM RESTORE LOGIC
  // ==========================================
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!window.confirm("WARNING: This will inject historical data into your live database. Ensure you are not duplicating records. Proceed?")) {
      e.target.value = '' // Reset input
      return
    }

    setIsRestoring(true)
    setRestoreError('')

    try {
      const zip = new JSZip()
      const unzipped = await zip.loadAsync(file)
      
      const restoreFile = unzipped.file("system_restore_data.json")
      if (!restoreFile) throw new Error("Invalid archive. Missing system_restore_data.json.")

      const rawJsonString = await restoreFile.async("string")
      const parsedData = JSON.parse(rawJsonString)

      const restoreResult = await executeSystemRestore(schoolId, parsedData)
      if (!restoreResult.success) throw new Error(restoreResult.error)

      alert("System data completely restored!")
      router.push('/school-dashboard')
    } catch (err: any) {
      setRestoreError(err.message || "Failed to parse backup archive.")
    } finally {
      setIsRestoring(false)
      e.target.value = '' // Reset input
    }
  }

  return (
    <div className="space-y-8 font-sans text-stone-900 w-full">
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 items-start">
        
        {/* ============================== */}
        {/* DESTRUCTIVE ACTION WIDGET */}
        {/* ============================== */}
        <div className="bg-white rounded-sm border border-stone-200 shadow-sm flex flex-col h-full">
          <div className="p-6 md:p-8 border-b border-stone-200 bg-[#fcf8f8]">
            <h2 className="text-lg font-semibold text-stone-900 uppercase tracking-wide">Academic Year Rollover</h2>
            <p className="text-xs font-medium text-stone-600 mt-2">
              Securely back up your data before executing a permanent system wipe.
            </p>
          </div>
          
          <div className="p-6 md:p-8 flex-grow flex flex-col space-y-8 bg-white">
            
            {/* Step 1 */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#fbf9fc] border border-[#dad3e3] text-[#6b4c9a] text-[10px] font-bold">1</span>
                <p className="text-xs font-bold tracking-widest text-stone-800 uppercase">Mandatory Backup</p>
              </div>
              <button 
                onClick={handleGenerateBackup}
                className="w-full bg-white border border-[#dad3e3] text-[#6b4c9a] px-5 py-3.5 rounded-sm text-xs uppercase tracking-widest font-bold hover:bg-[#fbf9fc] transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                Download Hybrid Archive (.zip)
              </button>
            </div>

            {/* Step 2 */}
            <div className={`transition-opacity duration-300 ${hasDownloaded ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              <div className="flex items-center gap-3 mb-3">
                <span className={`flex items-center justify-center w-6 h-6 rounded-full border text-[10px] font-bold ${hasDownloaded ? 'bg-[#fcf8f8] border-[#b4483e]/30 text-[#b4483e]' : 'bg-stone-50 border-stone-200 text-stone-400'}`}>2</span>
                <p className={`text-xs font-bold tracking-widest uppercase ${hasDownloaded ? 'text-[#b4483e]' : 'text-stone-500'}`}>
                  Authenticate & Wipe
                </p>
              </div>
              
              {!hasDownloaded ? (
                <div className="bg-stone-50 border border-stone-200 border-dashed rounded-sm p-5 text-center">
                  <p className="text-[11px] font-bold text-stone-500 uppercase tracking-widest">Complete Step 1 to Unlock</p>
                </div>
              ) : (
                <div className="space-y-4 bg-[#fcf8f8] border border-[#b4483e]/20 p-5 rounded-sm">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-2">Head Teacher Password</label>
                    <input 
                      type="password" 
                      placeholder="Enter verification password..." 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full p-3.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 focus:outline-none focus:border-[#b4483e] focus:ring-1 focus:ring-[#b4483e] transition-all"
                    />
                  </div>
                  {wipeError && <p className="text-[10px] font-bold uppercase tracking-widest text-[#b4483e]">{wipeError}</p>}
                  <button 
                    onClick={handleWipe}
                    disabled={isWiping || !password}
                    className="w-full bg-[#b4483e] text-white px-5 py-3.5 rounded-sm text-xs uppercase tracking-widest font-bold hover:bg-[#9a3d34] transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    {isWiping ? 'Purging Database...' : 'Permanently Wipe Year'}
                  </button>
                </div>
              )}
            </div>
            
          </div>
        </div>

        {/* ============================== */}
        {/* SYSTEM RESTORE WIDGET */}
        {/* ============================== */}
        <div className="bg-white rounded-sm border border-stone-200 shadow-sm flex flex-col h-full">
          <div className="p-6 md:p-8 border-b border-stone-200 bg-[#fbf9fc]">
            <h2 className="text-lg font-semibold text-stone-900 uppercase tracking-wide">System Restoration</h2>
            <p className="text-xs font-medium text-stone-600 mt-2">
              Inject historical backup data into the live database.
            </p>
          </div>
          
          <div className="p-6 md:p-8 flex-grow flex flex-col bg-white">
            <p className="text-sm font-medium text-stone-600 mb-6 leading-relaxed">
              Upload a previously generated <span className="font-bold text-stone-900">Hybrid Archive (.zip)</span> to completely restore students, exams, and marks to the exact state they were in at the time of backup.
            </p>

            <div className="relative border-2 border-dashed border-stone-300 bg-stone-50 rounded-sm p-10 flex flex-col items-center justify-center text-center hover:border-[#6b4c9a] hover:bg-[#fbf9fc] transition-all duration-300 group cursor-pointer mt-auto">
              <input 
                type="file" 
                accept=".zip" 
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                disabled={isRestoring}
              />
              <div className="w-12 h-12 mb-4 rounded-full bg-white border border-stone-200 flex items-center justify-center text-stone-400 group-hover:text-[#6b4c9a] group-hover:border-[#dad3e3] shadow-sm transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
              </div>
              <p className="text-xs font-bold tracking-widest text-stone-600 uppercase group-hover:text-[#6b4c9a] transition-colors">
                {isRestoring ? 'Restoring System...' : 'Drop Archive Here'}
              </p>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-2">Only .ZIP format allowed</p>
            </div>
            
            {restoreError && (
              <div className="mt-4 p-3 bg-[#fcf8f8] border border-[#b4483e]/20 rounded-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#b4483e] text-center">{restoreError}</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}