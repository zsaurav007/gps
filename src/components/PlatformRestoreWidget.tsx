'use client'

import { useState } from 'react'
import JSZip from 'jszip'
import { restoreFullSchoolEnvironment } from '@/app/actions/admin-school-backup'
import { useRouter } from 'next/navigation'

export default function PlatformRestoreWidget() {
  const router = useRouter()
  const [isRestoring, setIsRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState('')

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!window.confirm("WARNING: You are about to resurrect an entire school environment from this archive. Continue?")) {
      e.target.value = '' // Reset input
      return
    }

    setIsRestoring(true)
    setRestoreError('')

    try {
      const zip = new JSZip()
      const unzipped = await zip.loadAsync(file)
      
      const restoreFile = unzipped.file("full_school_backup.json")
      if (!restoreFile) throw new Error("Invalid archive. Missing full_school_backup.json.")

      const rawJsonString = await restoreFile.async("string")
      const parsedData = JSON.parse(rawJsonString)

      const restoreResult = await restoreFullSchoolEnvironment(parsedData)
      if (!restoreResult.success) throw new Error(restoreResult.error)

      alert("Institution completely restored from backup!")
      router.refresh() // Refresh the dashboard to show the restored school
    } catch (err: any) {
      setRestoreError(err.message || "Failed to parse backup archive.")
    } finally {
      setIsRestoring(false)
      e.target.value = '' // Reset input
    }
  }

  return (
    <div className="bg-white rounded-sm shadow-sm border border-stone-200 p-6 md:p-8 flex flex-col h-full mt-8">
      <div className="mb-6 pb-4 border-b border-stone-200">
        <h2 className="text-sm font-bold text-stone-800 uppercase tracking-wider">System Recovery</h2>
        <p className="text-[11px] font-medium text-stone-500 mt-2">
          Upload a <span className="font-bold text-[#6b4c9a]">Master_Backup (.zip)</span> archive to fully resurrect a deleted school environment.
        </p>
      </div>
      
      <div className="relative border-2 border-dashed border-stone-300 bg-stone-50 rounded-sm p-10 flex flex-col items-center justify-center text-center hover:border-[#6b4c9a] hover:bg-[#fbf9fc] transition-all duration-300 group cursor-pointer">
        <input 
          type="file" 
          accept=".zip" 
          onChange={handleFileUpload}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          disabled={isRestoring}
        />
        <div className="w-12 h-12 mb-4 rounded-full bg-white border border-stone-200 flex items-center justify-center text-stone-400 group-hover:text-[#6b4c9a] group-hover:border-[#dad3e3] shadow-sm transition-colors">
          {isRestoring ? (
            <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
          )}
        </div>
        <p className="text-xs font-bold tracking-widest text-stone-600 uppercase group-hover:text-[#6b4c9a] transition-colors">
          {isRestoring ? 'Resurrecting Institution...' : 'Drop Backup Archive Here'}
        </p>
        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-2">.ZIP format only</p>
      </div>
      
      {restoreError && (
        <div className="mt-4 p-4 bg-[#fcf8f8] border border-[#b4483e]/20 rounded-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#b4483e] text-center">{restoreError}</p>
        </div>
      )}
    </div>
  )
}