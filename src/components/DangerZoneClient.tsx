'use client'

import { useState } from 'react'
import JSZip from 'jszip'
// Updated import path below:
import { fetchFullSchoolBackup } from '@/app/actions/admin-school-backup'

export default function DangerZoneClient({ schoolId, schoolName, adminEmail, deleteAction }: any) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [hasDownloaded, setHasDownloaded] = useState(false)

  const handleGenerateBackup = async () => {
    setIsGenerating(true)
    
    try {
      // Calls the newly named action file
      const backupData = await fetchFullSchoolBackup(schoolId)
      const zip = new JSZip()

      // Core JSON Backup (Used for potential restoration)
      zip.file("full_school_backup.json", JSON.stringify(backupData, null, 2))

      // Generate Readable CSVs for the Administration
      const datasets = [
        { name: 'Students', data: backupData.students },
        { name: 'Teachers', data: backupData.teachers },
        { name: 'Exams', data: backupData.exams },
        { name: 'ExamMarks', data: backupData.examMarks }
      ]

      datasets.forEach(set => {
        if (set.data && set.data.length > 0) {
          const headers = Object.keys(set.data[0]).join(',')
          const rows = set.data.map((item: any) => 
            Object.values(item).map(v => typeof v === 'object' ? `"${JSON.stringify(v).replace(/"/g, '""')}"` : `"${v}"`).join(',')
          )
          zip.file(`Readable_${set.name}.csv`, [headers, ...rows].join('\n'))
        }
      })

      const content = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(content)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `Master_Backup_${schoolName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.zip`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      setHasDownloaded(true)
    } catch (error) {
      console.error("Backup Generation Error:", error)
      alert("Failed to generate complete backup archive.")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="bg-white rounded-sm border border-stone-200 shadow-sm flex flex-col h-full overflow-hidden">
      <div className="p-6 md:p-8 border-b border-[#b4483e]/20 bg-[#fcf8f8] border-t-4 border-t-[#b4483e]">
        <h2 className="text-lg font-semibold text-[#b4483e] uppercase tracking-wide flex items-center gap-3">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          Danger Zone: Complete Deletion
        </h2>
        <p className="text-xs font-medium text-[#b4483e]/80 mt-2">
          Permanently erase this institution. You must download a full backup before the system authorizes deletion.
        </p>
      </div>
      
      <div className="p-6 md:p-8 flex-grow flex flex-col space-y-10 bg-white">
        
        {/* Step 1: Backup */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#fcf8f8] border border-[#b4483e]/30 text-[#b4483e] text-[10px] font-bold">1</span>
            <p className="text-xs font-bold tracking-widest text-stone-800 uppercase">Export Tenant Data</p>
          </div>
          <button 
            onClick={handleGenerateBackup}
            disabled={isGenerating}
            type="button"
            className="w-full bg-white border border-[#b4483e] text-[#b4483e] px-5 py-3.5 rounded-sm text-[11px] uppercase tracking-widest font-bold hover:bg-[#b4483e] hover:text-white transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            {isGenerating ? 'Assembling Full Archive...' : 'Download Complete Backup (.zip)'}
          </button>
        </div>

        {/* Step 2: Delete */}
        <div className={`transition-opacity duration-300 ${hasDownloaded ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          <div className="flex items-center gap-3 mb-4">
            <span className={`flex items-center justify-center w-6 h-6 rounded-full border text-[10px] font-bold ${hasDownloaded ? 'bg-[#fcf8f8] border-[#b4483e]/30 text-[#b4483e]' : 'bg-stone-50 border-stone-200 text-stone-400'}`}>2</span>
            <p className={`text-xs font-bold tracking-widest uppercase ${hasDownloaded ? 'text-[#b4483e]' : 'text-stone-500'}`}>
              Verify & Terminate
            </p>
          </div>
          
          {!hasDownloaded ? (
            <div className="bg-stone-50 border border-stone-200 border-dashed rounded-sm p-6 text-center">
              <p className="text-[11px] font-bold text-stone-500 uppercase tracking-widest">Complete Step 1 to Unlock Deletion</p>
            </div>
          ) : (
            <form action={deleteAction} className="space-y-5 bg-[#fcf8f8] border border-[#b4483e]/20 p-6 rounded-sm shadow-inner">
              <input type="hidden" name="schoolId" value={schoolId} />
              <input type="hidden" name="actualSchoolName" value={schoolName} />
              <input type="hidden" name="adminEmail" value={adminEmail} />

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#b4483e] mb-2">
                  Type <span className="bg-[#b4483e]/10 px-1.5 py-0.5 rounded-sm mx-1 text-[#b4483e]">{schoolName}</span> to confirm
                </label>
                <input 
                  type="text" 
                  name="schoolNameConfirm" 
                  required 
                  autoComplete="off"
                  className="w-full p-3.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 focus:outline-none focus:border-[#b4483e] focus:ring-1 focus:ring-[#b4483e] transition-all shadow-sm"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#b4483e] mb-2">
                  Verify Master Admin Password
                </label>
                <input 
                  type="password" 
                  name="passwordConfirm" 
                  required 
                  className="w-full p-3.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 focus:outline-none focus:border-[#b4483e] focus:ring-1 focus:ring-[#b4483e] transition-all shadow-sm"
                />
              </div>

              <button 
                type="submit" 
                className="w-full bg-[#b4483e] text-white px-5 py-3.5 rounded-sm text-[11px] uppercase tracking-widest font-bold hover:bg-[#9a3d34] transition-colors shadow-sm flex items-center justify-center gap-2 mt-2"
              >
                Permanently Delete School
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  )
}