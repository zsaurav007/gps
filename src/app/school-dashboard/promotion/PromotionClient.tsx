'use client'

import { useState } from 'react'
import Dropdown from '@/components/ui/dropdown'
import { fetchStudentsForPromotion, promoteStudentsBulk } from '@/app/actions/promotion-actions'
import { useRouter } from 'next/navigation'

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

  const classOptions = classes.map(c => ({ label: `Class ${c.name}`, value: c.id }))

  // Load students when "From Class" is selected
  const handleLoadStudents = async () => {
    if (!fromClassId) return alert("Please select a 'From Class' first.")
    
    setIsLoading(true)
    try {
      const data = await fetchStudentsForPromotion(schoolId, fromClassId)
      setStudents(data)
      
      // Auto-select everyone by default and map their old rolls as placeholders
      const allIds = new Set<string>()
      const rollsMap: Record<string, string> = {}
      
      data.forEach(s => {
        allIds.add(s.id)
        rollsMap[s.id] = s.enrollment_id // Default to keeping their current roll
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
    if (!toClassId) return alert("Please select a destination 'To Class'.")
    if (selectedIds.size === 0) return alert("Please select at least one student to promote.")
    if (fromClassId === toClassId) return alert("Destination class cannot be the same as the current class.")

    // Build the payload
    const promotionsToProcess = Array.from(selectedIds).map(id => {
      const roll = newRolls[id]
      if (!roll || roll.trim() === '') throw new Error("All selected students must have a new Roll Number assigned.")
      return { id, newRoll: roll.trim() }
    })

    if (!window.confirm(`Are you sure you want to promote ${promotionsToProcess.length} students to the new class?`)) return

    setIsPromoting(true)
    try {
      await promoteStudentsBulk(schoolId, toClassId, promotionsToProcess)
      alert("Students successfully promoted!")
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

  return (
    <div className="space-y-6">
      
      {/* Configuration Bar */}
      <div className="bg-white p-6 rounded-sm shadow-sm border border-stone-200 flex flex-col md:flex-row gap-6 items-end relative z-50">
        <div className="w-full md:w-1/3">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-2">
            Current Class (From)
          </label>
          <Dropdown 
            options={classOptions}
            value={fromClassId}
            onChange={(val) => setFromClassId(val as string)}
            placeholder="Select Current Class..."
          />
        </div>
        
        <div className="w-full md:w-auto shrink-0 flex items-center justify-center pb-2 hidden md:flex">
          <svg className="w-6 h-6 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
        </div>

        <div className="w-full md:w-1/3">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-2">
            Promote To (Destination)
          </label>
          <Dropdown 
            options={classOptions.filter(c => c.value !== fromClassId)}
            value={toClassId}
            onChange={(val) => setToClassId(val as string)}
            placeholder="Select Destination Class..."
          />
        </div>

        <div className="w-full md:w-auto mt-4 md:mt-0">
          <button 
            onClick={handleLoadStudents}
            disabled={isLoading || !fromClassId}
            className="w-full bg-stone-900 text-white px-8 py-[11px] rounded-sm text-[11px] uppercase tracking-widest font-bold hover:bg-stone-800 transition-colors disabled:opacity-50 shadow-sm"
          >
            {isLoading ? 'Loading...' : 'Load Roster'}
          </button>
        </div>
      </div>

      {/* Promotion Grid */}
      {students.length > 0 && (
        <div className="bg-white rounded-sm shadow-sm border border-stone-200 overflow-hidden relative z-0">
          
          {/* Action Toolbar */}
          <div className="bg-stone-50 p-5 border-b border-stone-200 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="font-black text-stone-900 tracking-tight">Mass Promotion Roster</h3>
              <p className="text-[11px] text-stone-500 font-bold uppercase tracking-widest mt-1">
                {selectedIds.size} of {students.length} Selected
              </p>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <button 
                onClick={handleAutoNumber}
                className="flex-1 sm:flex-none bg-white border border-[#6b4c9a] text-[#6b4c9a] px-5 py-2.5 rounded-sm text-[11px] uppercase tracking-widest font-bold hover:bg-purple-50 transition-colors shadow-sm"
              >
                Auto-Number (1, 2, 3...)
              </button>
              <button 
                onClick={handlePromote}
                disabled={isPromoting}
                className="flex-1 sm:flex-none bg-[#6b4c9a] text-white px-8 py-2.5 rounded-sm text-[11px] uppercase tracking-widest font-bold hover:bg-[#5a3f82] transition-colors disabled:opacity-50 shadow-sm"
              >
                {isPromoting ? 'Processing...' : 'Confirm Promotion'}
              </button>
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-white text-stone-500 sticky top-0 z-10 shadow-sm outline outline-1 outline-stone-200">
                <tr>
                  <th className="p-4 w-12 text-center">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.size === students.length && students.length > 0} 
                      onChange={toggleSelectAll} 
                      className="w-4 h-4 rounded-sm border-stone-300 text-[#6b4c9a] cursor-pointer accent-[#6b4c9a]" 
                    />
                  </th>
                  <th className="p-4 font-bold text-[10px] uppercase tracking-widest">Student</th>
                  <th className="p-4 font-bold text-[10px] uppercase tracking-widest text-stone-400">Current Roll</th>
                  <th className="p-4 font-bold text-[10px] uppercase tracking-widest text-[#6b4c9a] bg-purple-50/50">New Roll (Required)</th>
                  <th className="p-4 font-bold text-[10px] uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {students.map(student => {
                  const isSelected = selectedIds.has(student.id)
                  
                  return (
                    <tr key={student.id} className={`transition-colors ${isSelected ? 'hover:bg-[#fbf9fc]' : 'bg-stone-50/50 opacity-60 grayscale-[50%]'}`}>
                      <td className="p-4 text-center">
                        <input 
                          type="checkbox" 
                          checked={isSelected} 
                          onChange={() => toggleSelect(student.id)} 
                          className="w-4 h-4 rounded-sm border-stone-300 text-[#6b4c9a] cursor-pointer accent-[#6b4c9a]" 
                        />
                      </td>
                      <td className="p-4 font-bold text-stone-900">
                        <div className="flex items-center gap-3">
                          {student.photo_url ? (
                            <img src={student.photo_url} alt="Profile" className="w-8 h-8 rounded-sm object-cover border border-stone-300" />
                          ) : (
                            <div className="w-8 h-8 rounded-sm bg-stone-200 flex items-center justify-center text-xs text-stone-500 font-bold border border-stone-300">
                              {student.first_name.charAt(0)}
                            </div>
                          )}
                          <span className="text-[14px] leading-none">{student.first_name}</span>
                        </div>
                      </td>
                      <td className="p-4 font-bold text-stone-400">
                        {student.enrollment_id}
                      </td>
                      <td className="p-3 bg-purple-50/20">
                        <input 
                          type="text" 
                          disabled={!isSelected}
                          value={newRolls[student.id] || ''} 
                          onChange={e => updateRoll(student.id, e.target.value)} 
                          placeholder="Assign Roll..."
                          className={`w-32 p-2 border rounded-sm text-sm font-bold focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm ${!isSelected ? 'bg-stone-100 border-transparent text-stone-400 cursor-not-allowed' : 'bg-white border-stone-300 text-[#6b4c9a]'}`} 
                        />
                      </td>
                      <td className="p-4">
                        {isSelected ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-[#e8f5e9] text-emerald-700 text-[10px] font-bold uppercase tracking-widest border border-emerald-200">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Promoting
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-stone-100 text-stone-500 text-[10px] font-bold uppercase tracking-widest border border-stone-200">
                            Repeating
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

    </div>
  )
}