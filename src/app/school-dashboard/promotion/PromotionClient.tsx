'use client'

import { useState } from 'react'
import Dropdown from '@/components/ui/dropdown'
import { fetchStudentsForPromotion, promoteStudentsBulk, deleteStudentsBulk } from '@/app/actions/promotion-actions'
import { useRouter } from 'next/navigation'

// Utility to convert English numbers to Bengali numerals
const engToBng = (str: string | number): string => {
  if (str === null || str === undefined) return '';
  const bngNums = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(str).replace(/[0-9]/g, w => bngNums[Number(w)]);
}

// Utility to convert Bengali numerals back to English for DB storage
const bngToEng = (str: string | number): string => {
  if (str === null || str === undefined) return '';
  const bngNums = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(str).replace(/[০-৯]/g, w => String(bngNums.indexOf(w)));
}

export default function PromotionClient({ schoolId, classes }: { schoolId: string, classes: any[] }) {
  const router = useRouter()
  
  // Setup States
  const [fromClassId, setFromClassId] = useState('')
  const [toClassId, setToClassId] = useState('')
  
  // Data States
  const [students, setStudents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isPromoting, setIsPromoting] = useState(false)

  // Interactive Grid States
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [newRolls, setNewRolls] = useState<Record<string, string>>({})

  // Map classes to dropdown and add the special "Graduate" option
  const classOptions = classes.map(c => ({ label: `${c.name}`, value: c.id }))
  const toClassOptions = [
    ...classOptions.filter(c => c.value !== fromClassId),
    { label: 'স্কুল সমাপ্ত (XML ব্যাকআপ) / GRADUATE (XML BACKUP)', value: 'graduate' }
  ]

  // Load students when "From Class" is selected
  const handleLoadStudents = async () => {
    if (!fromClassId) return alert("অনুগ্রহ করে একটি 'বর্তমান ক্লাস' নির্বাচন করুন। / Please select a 'From Class'.")
    
    setIsLoading(true)
    try {
      const data = await fetchStudentsForPromotion(schoolId, fromClassId)
      setStudents(data)
      
      // Auto-select everyone by default and map their old rolls as placeholders
      const allIds = new Set<string>()
      const rollsMap: Record<string, string> = {}
      
      data.forEach(s => {
        allIds.add(s.id)
        rollsMap[s.id] = String(s.enrollment_id) // Default to keeping their current roll
      })
      
      setSelectedIds(allIds)
      setNewRolls(rollsMap)
    } catch (error: any) {
      alert(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-Numbering Utility
  const handleAutoNumber = () => {
    if (students.length === 0) return
    const rollsMap: Record<string, string> = {}
    let counter = 1
    
    students.forEach(s => {
      if (selectedIds.has(s.id)) {
        rollsMap[s.id] = counter.toString()
        counter++
      } else {
        rollsMap[s.id] = newRolls[s.id] || ''
      }
    })
    setNewRolls(rollsMap)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === students.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(students.map(s => s.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedIds(newSet)
  }

  const updateRoll = (id: string, value: string) => {
    setNewRolls(prev => ({ ...prev, [id]: value }))
  }

  const handlePromote = async () => {
    if (!toClassId) return alert("অনুগ্রহ করে একটি 'প্রমোশন ক্লাস' নির্বাচন করুন। / Please select a Destination Class.")
    if (selectedIds.size === 0) return alert("অন্তত একজন শিক্ষার্থী নির্বাচন করুন। / Select at least one student.")
    if (fromClassId === toClassId) return alert("গন্তব্য ক্লাস বর্তমান ক্লাসের সমান হতে পারে না। / Destination cannot match current class.")

    const selectedStudentsData = students.filter(s => selectedIds.has(s.id))

    // ==========================================
    // GRADUATION & XML BACKUP LOGIC
    // ==========================================
    if (toClassId === 'graduate') {
      if (!window.confirm(`আপনি কি নিশ্চিত যে আপনি ${engToBng(selectedIds.size)} জন শিক্ষার্থীকে স্কুল থেকে বিদায় করতে চান? এর ফলে তাদের ডেটার একটি XML ব্যাকআপ ডাউনলোড হবে এবং তারা ডেটাবেস থেকে মুছে যাবে।`)) return
      
      setIsPromoting(true)
      try {
        // 1. Generate XML String
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<students>\n`
        selectedStudentsData.forEach(s => {
          xml += `  <student>\n`
          xml += `    <id>${s.id}</id>\n`
          xml += `    <name>${s.first_name}</name>\n`
          xml += `    <enrollment_id>${s.enrollment_id}</enrollment_id>\n`
          xml += `    <class_id>${fromClassId}</class_id>\n`
          xml += `    <graduated_date>${new Date().toISOString()}</graduated_date>\n`
          xml += `  </student>\n`
        })
        xml += `</students>`

        // 2. Trigger File Download
        const blob = new Blob([xml], { type: 'text/xml' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `graduated_students_${new Date().toISOString().split('T')[0]}.xml`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        // 3. Delete from Database
        await deleteStudentsBulk(schoolId, Array.from(selectedIds))
        
        alert("সফলভাবে শিক্ষার্থীদের বিদায় করা হয়েছে এবং ব্যাকআপ ডাউনলোড হয়েছে! / Students graduated & backup downloaded!")
        setStudents([])
        setFromClassId('')
        setToClassId('')
        router.refresh()
      } catch (error: any) {
        alert(error.message)
      } finally {
        setIsPromoting(false)
      }
      return
    }

    // ==========================================
    // STANDARD PROMOTION LOGIC
    // ==========================================
    const promotionsToProcess = Array.from(selectedIds).map(id => {
      const roll = newRolls[id]
      if (!roll || roll.trim() === '') throw new Error("নির্বাচিত সকল শিক্ষার্থীর নতুন রোল নম্বর থাকা আবশ্যক। / New roll required for all.")
      return { id, newRoll: bngToEng(roll.trim()) } // Save to DB in English numerals
    })

    if (!window.confirm(`আপনি কি নিশ্চিত যে আপনি ${engToBng(promotionsToProcess.length)} জন শিক্ষার্থীকে প্রমোশন দিতে চান? / Promote these students?`)) return

    setIsPromoting(true)
    try {
      await promoteStudentsBulk(schoolId, toClassId, promotionsToProcess)
      alert("সফলভাবে শিক্ষার্থীদের প্রমোশন দেওয়া হয়েছে! / Students successfully promoted!")
      setStudents([])
      setFromClassId('')
      setToClassId('')
      router.refresh()
    } catch (error: any) {
      alert(error.message)
    } finally {
      setIsPromoting(false)
    }
  }

  const isGraduating = toClassId === 'graduate'

  return (
    <div className="space-y-6">
      
      {/* Configuration Bar */}
      <div className="bg-white p-6 md:p-8 rounded-sm shadow-sm border border-stone-200 flex flex-col md:flex-row gap-6 items-end relative z-50">
        <div className="w-full md:w-1/3">
          <label className="block text-base font-bold text-stone-700 mb-2">
            বর্তমান ক্লাস <span className="text-[10px] uppercase tracking-widest text-stone-400 ml-1">/ CURRENT CLASS (FROM)</span>
          </label>
          <Dropdown 
            options={classOptions}
            value={fromClassId}
            onChange={(val) => setFromClassId(val as string)}
            placeholder="বর্তমান ক্লাস নির্বাচন করুন..."
          />
        </div>
        
        <div className="w-full md:w-auto shrink-0 flex items-center justify-center pb-2 hidden md:flex">
          <svg className="w-6 h-6 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
        </div>

        <div className="w-full md:w-1/3">
          <label className="block text-base font-bold text-stone-700 mb-2">
            প্রমোশন ক্লাস <span className="text-[10px] uppercase tracking-widest text-stone-400 ml-1">/ PROMOTE TO (DESTINATION)</span>
          </label>
          <Dropdown 
            options={toClassOptions}
            value={toClassId}
            onChange={(val) => setToClassId(val as string)}
            placeholder="প্রমোশন ক্লাস নির্বাচন করুন..."
          />
        </div>

        <div className="w-full md:w-auto mt-4 md:mt-0">
          <button 
            onClick={handleLoadStudents}
            disabled={isLoading || !fromClassId}
            className="w-full bg-stone-900 text-white px-8 py-3.5 rounded-sm text-sm font-bold hover:bg-stone-800 transition-colors disabled:opacity-50 shadow-sm"
          >
            {isLoading ? 'লোড হচ্ছে...' : 'তালিকা লোড করুন'} <span className="text-[9px] uppercase tracking-widest opacity-70 ml-1">/ LOAD ROSTER</span>
          </button>
        </div>
      </div>

      {/* Promotion Grid */}
      {students.length > 0 && (
        <div className="bg-white rounded-sm shadow-sm border border-stone-200 overflow-hidden relative z-0">
          
          {/* Action Toolbar */}
          <div className="bg-stone-50 p-6 border-b border-stone-200 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="font-bold text-stone-900 text-lg">
                গণ-প্রমোশন তালিকা <span className="text-[10px] text-stone-500 font-bold uppercase tracking-widest ml-2">/ MASS PROMOTION ROSTER</span>
              </h3>
              <p className="text-sm font-medium text-[#6b4c9a] mt-1">
                {engToBng(students.length)} জনের মধ্যে {engToBng(selectedIds.size)} জন নির্বাচিত
              </p>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              {!isGraduating && (
                <button 
                  onClick={handleAutoNumber}
                  className="flex-1 sm:flex-none bg-white border border-[#6b4c9a] text-[#6b4c9a] px-6 py-3 rounded-sm text-sm font-bold hover:bg-purple-50 transition-colors shadow-sm"
                >
                  স্বয়ংক্রিয় রোল <span className="text-[9px] uppercase tracking-widest opacity-70 ml-1">/ AUTO-NUMBER (১, ২, ৩)</span>
                </button>
              )}
              <button 
                onClick={handlePromote}
                disabled={isPromoting}
                className={`flex-1 sm:flex-none text-white px-8 py-3 rounded-sm text-sm font-bold transition-colors disabled:opacity-50 shadow-sm ${isGraduating ? 'bg-[#b4483e] hover:bg-[#8f3a32]' : 'bg-[#6b4c9a] hover:bg-[#5a3f82]'}`}
              >
                {isPromoting ? 'প্রসেসিং...' : isGraduating ? 'বিদায় ও ব্যাকআপ নিন' : 'প্রমোশন নিশ্চিত করুন'} 
                <span className="text-[9px] uppercase tracking-widest opacity-70 ml-1">
                  / {isGraduating ? 'GRADUATE & BACKUP' : 'CONFIRM PROMOTION'}
                </span>
              </button>
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
            <table className="w-full text-left text-base whitespace-nowrap">
              <thead className="bg-white text-stone-500 sticky top-0 z-10 shadow-sm outline outline-1 outline-stone-200">
                <tr>
                  <th className="p-4 w-12 text-center border-r border-stone-200">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.size === students.length && students.length > 0} 
                      onChange={toggleSelectAll} 
                      className="w-5 h-5 rounded-sm border-stone-300 text-[#6b4c9a] cursor-pointer accent-[#6b4c9a]" 
                    />
                  </th>
                  <th className="p-4 text-sm font-bold text-stone-700">
                    শিক্ষার্থী <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400 ml-1">/ STUDENT</span>
                  </th>
                  <th className="p-4 text-sm font-bold text-stone-700">
                    বর্তমান রোল <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400 ml-1">/ CURRENT ROLL</span>
                  </th>
                  <th className={`p-4 text-sm font-bold transition-colors ${isGraduating ? 'text-stone-400 bg-stone-50' : 'text-[#6b4c9a] bg-purple-50/50'}`}>
                    নতুন রোল <span className="text-[9px] font-bold uppercase tracking-widest opacity-70 ml-1">/ NEW ROLL</span>
                  </th>
                  <th className="p-4 text-sm font-bold text-stone-700">
                    অবস্থা <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400 ml-1">/ STATUS</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {students.map(student => {
                  const isSelected = selectedIds.has(student.id)
                  
                  return (
                    <tr key={student.id} className={`transition-colors ${isSelected ? 'hover:bg-[#fbf9fc]' : 'bg-stone-50/50 opacity-60 grayscale-[50%]'}`}>
                      <td className="p-4 text-center border-r border-stone-100">
                        <input 
                          type="checkbox" 
                          checked={isSelected} 
                          onChange={() => toggleSelect(student.id)} 
                          className="w-5 h-5 rounded-sm border-stone-300 text-[#6b4c9a] cursor-pointer accent-[#6b4c9a]" 
                        />
                      </td>
                      <td className="p-4 font-bold text-stone-900">
                        <div className="flex items-center gap-4">
                          {student.photo_url ? (
                            <img src={student.photo_url} alt="Profile" className="w-10 h-10 rounded-sm object-cover border border-stone-300 shadow-sm" />
                          ) : (
                            <div className="w-10 h-10 rounded-sm bg-stone-200 flex items-center justify-center text-sm text-stone-500 font-bold border border-stone-300 shadow-sm">
                              {student.first_name.charAt(0)}
                            </div>
                          )}
                          <span className="text-base tracking-wide">{student.first_name}</span>
                        </div>
                      </td>
                      <td className="p-4 font-bold text-stone-500 text-lg">
                        {engToBng(student.enrollment_id)}
                      </td>
                      <td className={`p-3 ${isGraduating ? 'bg-transparent' : 'bg-purple-50/20'}`}>
                        {isGraduating ? (
                          <span className="text-stone-400 font-semibold italic text-sm px-2">প্রযোজ্য নয় / N/A</span>
                        ) : (
                          <input 
                            type="text"
                            inputMode="numeric"
                            disabled={!isSelected}
                            value={newRolls[student.id] ? engToBng(newRolls[student.id]) : ''} 
                            onChange={e => updateRoll(student.id, bngToEng(e.target.value))} 
                            placeholder="রোল দিন..."
                            className={`w-32 p-3 border rounded-sm text-base font-bold focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm ${!isSelected ? 'bg-stone-100 border-transparent text-stone-400 cursor-not-allowed' : 'bg-white border-stone-300 text-[#6b4c9a]'}`} 
                          />
                        )}
                      </td>
                      <td className="p-4">
                        {isSelected ? (
                          isGraduating ? (
                            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm bg-[#fcf2f1] text-[#b4483e] text-xs font-bold border border-[#f2d5d2] shadow-sm">
                              <div className="w-2 h-2 rounded-full bg-[#b4483e]"></div> বিদায় <span className="text-[9px] uppercase tracking-widest opacity-70">/ GRADUATING</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm bg-[#e8f5e9] text-emerald-700 text-xs font-bold border border-emerald-200 shadow-sm">
                              <div className="w-2 h-2 rounded-full bg-emerald-500"></div> উত্তীর্ণ <span className="text-[9px] uppercase tracking-widest opacity-70">/ PROMOTING</span>
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm bg-stone-100 text-stone-500 text-xs font-bold border border-stone-200 shadow-sm">
                            অপরিবর্তিত <span className="text-[9px] uppercase tracking-widest opacity-70">/ REPEATING</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Styles for scrollbar */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #d6d3d1; border-radius: 4px; }
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #d6d3d1 transparent; }
      `}} />

    </div>
  )
}