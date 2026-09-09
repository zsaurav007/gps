'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'
import { deleteStudentsBulk, getStudentPhotoUrl } from '@/app/actions/student-actions'
import { getCloudinaryDeleteAuth } from '@/app/actions/cloudinary-actions'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DeleteStudentButton from './DeleteStudentButton'
import Dropdown from '@/components/ui/dropdown'

export default function StudentDirectory({ students, classes }: { students: any[], classes: any[] }) {
  const router = useRouter()
  
  // --- Advanced Search & Filters ---
  const [searchTerm, setSearchTerm] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [filterGender, setFilterGender] = useState('')
  
  // --- Advanced Sorting ---
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc'|'desc' }>({ key: 'enrollment_id', direction: 'asc' })
  
  // --- Bulk Actions & Mobile UI State ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)

  // --- Filtering Logic ---
  let filteredStudents = students.filter(s => {
    const matchesClass = filterClass ? s.class_id === filterClass : true
    const matchesGender = filterGender ? s.gender?.toLowerCase() === filterGender.toLowerCase() : true
    const searchStr = `${s.first_name} ${s.last_name || ''} ${s.enrollment_id} ${s.guardian_name} ${s.guardian_phone}`.toLowerCase()
    const matchesSearch = searchStr.includes(searchTerm.toLowerCase())
    return matchesClass && matchesGender && matchesSearch
  })

  // --- Sorting Logic ---
  filteredStudents.sort((a, b) => {
    let aValue: any = a[sortConfig.key] || ''
    let bValue: any = b[sortConfig.key] || ''

    if (sortConfig.key === 'student_name') {
      aValue = `${a.first_name} ${a.last_name || ''}`.toLowerCase()
      bValue = `${b.first_name} ${b.last_name || ''}`.toLowerCase()
    } else if (sortConfig.key === 'class_name') {
      aValue = classes.find(c => c.id === a.class_id)?.name?.toLowerCase() || ''
      bValue = classes.find(c => c.id === b.class_id)?.name?.toLowerCase() || ''
    } else if (sortConfig.key === 'guardian_name') {
      aValue = (a.guardian_name || '').toLowerCase()
      bValue = (b.guardian_name || '').toLowerCase()
    }

    if (sortConfig.key === 'enrollment_id') {
      return sortConfig.direction === 'asc' 
        ? aValue.toString().localeCompare(bValue.toString(), undefined, { numeric: true })
        : bValue.toString().localeCompare(aValue.toString(), undefined, { numeric: true })
    }

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  })

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'
    setSortConfig({ key, direction })
  }

  // --- Action Logic ---
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredStudents.map(s => s.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedIds(newSet)
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!window.confirm(`WARNING: You are about to permanently delete ${selectedIds.size} student(s).\n\nThis will erase their profiles, exam marks, and all report cards from the database.\n\nDo you want to proceed?`)) return
    
    setIsDeleting(true)
    try {
      const studentIds = Array.from(selectedIds)
      for (const id of studentIds) {
        const photoUrl = await getStudentPhotoUrl(id)
        if (photoUrl) {
          const auth = await getCloudinaryDeleteAuth(photoUrl)
          if (auth) {
            const fd = new FormData()
            fd.append('public_id', auth.publicId)
            fd.append('api_key', auth.apiKey)
            fd.append('timestamp', auth.timestamp.toString())
            fd.append('signature', auth.signature)
            await fetch(`https://api.cloudinary.com/v1_1/${auth.cloudName}/image/destroy`, { method: 'POST', body: fd }).catch(e => console.error(e))
          }
        }
      }

      await deleteStudentsBulk(studentIds)
      
      alert(`${selectedIds.size} student(s) and all associated academic records deleted successfully.`)
      setSelectedIds(new Set())
      router.refresh()
    } catch (e: any) { 
      alert(`Error: ${e.message}`) 
    } finally { 
      setIsDeleting(false) 
    }
  }

  // --- Export Logic ---
  const exportToExcel = () => {
    const dataToExport = filteredStudents.map(s => ({
      'Roll No': s.enrollment_id,
      'Class': `Class ${classes.find(c => c.id === s.class_id)?.name || 'Unknown'}`,
      'Student Name': `${s.first_name} ${s.last_name || ''}`.trim(),
      'Gender': s.gender,
      'Guardian': s.guardian_name,
      'Phone': s.guardian_phone
    }))
    const ws = XLSX.utils.json_to_sheet(dataToExport)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Students")
    XLSX.writeFile(wb, "Student_Directory.xlsx")
  }

  // --- Dropdown Options ---
  const classOptions = [
    { label: 'All Classes', value: '' },
    ...classes.map(c => ({ label: `Class ${c.name}`, value: c.id }))
  ]

  const genderOptions = [
    { label: 'All Genders', value: '' },
    { label: 'Male', value: 'male' },
    { label: 'Female', value: 'female' },
    { label: 'Other', value: 'other' }
  ]

  // Render Arrow for sorting
  const renderSortArrow = (key: string) => {
    if (sortConfig.key !== key) return null
    return (
      <span className="ml-1 text-[#6b4c9a]">
        {sortConfig.direction === 'asc' ? '↑' : '↓'}
      </span>
    )
  }

  return (
    <div className="bg-white rounded-sm border border-stone-200 shadow-sm overflow-hidden font-sans">
      
      {/* Search & Filter Controls */}
      <div className="p-5 bg-stone-50 border-b border-stone-200 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 print:hidden">
        
        <div className="flex flex-wrap gap-4 items-center w-full xl:w-auto">
          {/* Search Bar */}
          <div className="relative w-full md:w-80">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              type="text" 
              placeholder="Search name, roll, guardian..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-stone-200 rounded-sm text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm" 
            />
          </div>

          {/* Filters using Dropdown */}
          <div className="w-full md:w-48 z-20">
            <Dropdown 
              options={classOptions}
              value={filterClass}
              onChange={(val) => setFilterClass(val as string)}
            />
          </div>

          <div className="w-full md:w-40 z-10">
            <Dropdown 
              options={genderOptions}
              value={filterGender}
              onChange={(val) => setFilterGender(val as string)}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 items-center w-full xl:w-auto justify-start xl:justify-end">
          {selectedIds.size > 0 && (
            <button 
              onClick={handleBulkDelete} 
              disabled={isDeleting} 
              className="bg-white border border-[#d3a8a5] text-[#b4483e] px-4 py-2.5 rounded-sm text-[11px] uppercase tracking-widest font-medium hover:bg-[#fcf8f8] hover:border-[#b4483e] disabled:opacity-50 transition-colors shadow-sm"
            >
              Delete ({selectedIds.size})
            </button>
          )}
          <button 
            onClick={exportToExcel} 
            className="bg-white border border-stone-200 text-stone-700 px-4 py-2.5 rounded-sm text-[11px] uppercase tracking-widest font-medium hover:border-[#6b4c9a]/50 hover:text-[#6b4c9a] transition-colors shadow-sm"
          >
            Export Excel
          </button>
          <button 
            onClick={() => window.print()} 
            className="bg-[#6b4c9a] text-white px-4 py-2.5 rounded-sm text-[11px] uppercase tracking-widest font-medium hover:bg-[#5a3f82] transition-colors shadow-sm border border-transparent"
          >
            Print PDF
          </button>
        </div>
      </div>

      {/* =========================================================
          MOBILE VIEW: EXPANDABLE CARDS (Hidden on Desktop/Print)
      ========================================================= */}
      <div className="md:hidden print:hidden flex flex-col gap-3 p-4 bg-stone-50">
        
        {/* Mobile Bulk Selection Header */}
        <div className="flex justify-between items-center bg-white border border-stone-200 p-3 rounded-sm shadow-sm">
          <label className="flex items-center gap-3 text-[10px] uppercase tracking-widest font-bold text-stone-600 cursor-pointer">
            <input 
              type="checkbox" 
              checked={selectedIds.size === filteredStudents.length && filteredStudents.length > 0} 
              onChange={toggleSelectAll} 
              className="w-4 h-4 rounded-sm border-stone-300 text-[#6b4c9a] focus:ring-[#6b4c9a] accent-[#6b4c9a] cursor-pointer" 
            />
            Select All
          </label>
          <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">{filteredStudents.length} Students</span>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="p-8 text-center text-stone-500 italic bg-white border border-stone-200 rounded-sm text-xs">
            No students match the current filters or search query.
          </div>
        ) : (
          filteredStudents.map(student => {
            const isExpanded = expandedCardId === student.id
            const isSelected = selectedIds.has(student.id)

            return (
              <div key={student.id} className={`bg-white border rounded-sm shadow-sm overflow-hidden transition-all ${isSelected ? 'border-[#6b4c9a] ring-1 ring-[#6b4c9a]' : 'border-stone-200'}`}>
                {/* Closed / Header State */}
                <div 
                  className={`p-3.5 flex items-center gap-3 cursor-pointer transition-colors active:bg-stone-50 ${isExpanded ? 'bg-[#fbf9fc] border-b border-[#dad3e3]' : ''}`}
                  onClick={() => setExpandedCardId(isExpanded ? null : student.id)}
                >
                  <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                    <input 
                      type="checkbox" 
                      checked={isSelected} 
                      onChange={() => toggleSelect(student.id)} 
                      className="w-4 h-4 rounded-sm border-stone-300 text-[#6b4c9a] focus:ring-[#6b4c9a] accent-[#6b4c9a] cursor-pointer" 
                    />
                  </div>

                  {student.photo_url ? (
                    <img src={student.photo_url} alt="Profile" className="w-10 h-10 rounded-sm object-cover border border-stone-300 shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-sm bg-stone-100 flex items-center justify-center text-xs text-stone-500 font-bold border border-stone-200 shrink-0">
                      {student.first_name.charAt(0)}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-stone-900 text-sm truncate">{student.first_name}</h4>
                    <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest mt-0.5 truncate">
                      Roll {student.enrollment_id} <span className="text-stone-300 px-1">|</span> Class {classes.find(c => c.id === student.class_id)?.name}
                    </p>
                  </div>

                  <div className="shrink-0 pl-2 text-stone-400">
                    <svg className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>

                {/* Expanded Details State */}
                <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                  <div className="overflow-hidden">
                    <div className="p-4 bg-white space-y-3">
                      
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-stone-50 p-2.5 rounded-sm border border-stone-100">
                          <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-1">Gender</p>
                          <p className="font-bold text-stone-800 capitalize">{student.gender || '-'}</p>
                        </div>
                        <div className="bg-stone-50 p-2.5 rounded-sm border border-stone-100">
                          <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-1">Phone</p>
                          <p className="font-bold text-stone-800">{student.guardian_phone || '-'}</p>
                        </div>
                        <div className="col-span-2 bg-stone-50 p-2.5 rounded-sm border border-stone-100">
                          <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-1">Guardian</p>
                          <p className="font-bold text-stone-800">{student.guardian_name || '-'}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-3 mt-2 border-t border-stone-100">
                        <Link 
                          href={`/school-dashboard/students/${student.id}/view`} 
                          className="flex-1 min-w-[30%] text-center px-3 py-2.5 bg-[#fbf9fc] border border-[#dad3e3] text-[#6b4c9a] rounded-sm text-[10px] uppercase tracking-widest font-bold hover:bg-[#f3eff8] transition-colors"
                        >
                          View Profile
                        </Link>
                        <Link 
                          href={`/school-dashboard/students/${student.id}/edit`} 
                          className="flex-1 min-w-[30%] text-center px-3 py-2.5 bg-stone-50 border border-stone-200 text-stone-700 rounded-sm text-[10px] uppercase tracking-widest font-bold hover:bg-stone-100 transition-colors"
                        >
                          Edit Profile
                        </Link>
                        <div className="flex-1 min-w-[30%]">
                          <DeleteStudentButton 
                            studentId={student.id} 
                            studentName={student.first_name} 
                          />
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* =========================================================
          DESKTOP / PRINT VIEW: STANDARD TABLE
      ========================================================= */}
      <div className="hidden md:block overflow-x-auto print:p-0">
        
        {/* Print Header */}
        <div className="hidden print:block text-center pb-4 mb-4 border-b border-stone-300">
          <p className="text-[10px] font-medium tracking-[0.2em] text-stone-500 uppercase mb-1">Institution Roster</p>
          <h1 className="text-2xl font-normal uppercase tracking-widest text-stone-900">Student Directory</h1>
          <p className="text-xs font-medium text-stone-600 mt-2 uppercase tracking-wide">
            {filterClass ? `Class ${classes.find(c=>c.id === filterClass)?.name}` : 'All Classes'} 
            {filterGender ? ` | ${filterGender.charAt(0).toUpperCase() + filterGender.slice(1)}s` : ''}
          </p>
        </div>

        <table className="w-full text-left text-sm border-collapse min-w-max">
          <thead className="bg-[#fbf9fc] border-b border-[#dad3e3] text-stone-500 print:bg-transparent print:border-b-2 print:border-stone-800 select-none">
            <tr>
              <th className="p-3 print:hidden w-12 text-center">
                <input 
                  type="checkbox" 
                  checked={selectedIds.size === filteredStudents.length && filteredStudents.length > 0} 
                  onChange={toggleSelectAll} 
                  className="w-4 h-4 rounded-sm border-stone-300 text-[#6b4c9a] focus:ring-[#6b4c9a] cursor-pointer accent-[#6b4c9a]" 
                />
              </th>
              
              <th className="p-3 cursor-pointer hover:text-[#6b4c9a] transition-colors font-medium text-[10px] uppercase tracking-widest print:border-b print:border-stone-800" onClick={() => requestSort('enrollment_id')}>
                Roll {renderSortArrow('enrollment_id')}
              </th>
              
              <th className="p-3 cursor-pointer hover:text-[#6b4c9a] transition-colors font-medium text-[10px] uppercase tracking-widest print:border-b print:border-stone-800" onClick={() => requestSort('class_name')}>
                Class {renderSortArrow('class_name')}
              </th>
              
              <th className="p-3 cursor-pointer hover:text-[#6b4c9a] transition-colors font-medium text-[10px] uppercase tracking-widest print:border-b print:border-stone-800" onClick={() => requestSort('student_name')}>
                Student Name {renderSortArrow('student_name')}
              </th>
              
              <th className="p-3 cursor-pointer hover:text-[#6b4c9a] transition-colors font-medium text-[10px] uppercase tracking-widest print:border-b print:border-stone-800" onClick={() => requestSort('gender')}>
                Gender {renderSortArrow('gender')}
              </th>
              
              <th className="p-3 cursor-pointer hover:text-[#6b4c9a] transition-colors font-medium text-[10px] uppercase tracking-widest print:border-b print:border-stone-800" onClick={() => requestSort('guardian_name')}>
                Guardian {renderSortArrow('guardian_name')}
              </th>
              
              <th className="p-3 font-medium text-[10px] uppercase tracking-widest print:border-b print:border-stone-800">
                Phone
              </th>

              <th className="p-3 font-medium text-[10px] uppercase tracking-widest print:hidden text-right">
                Actions
              </th>
            </tr>
          </thead>
          
          <tbody className="divide-y divide-stone-100 print:divide-stone-300 bg-white">
            {filteredStudents.map(student => (
              <tr key={student.id} className={`hover:bg-[#fbf9fc] transition-colors ${selectedIds.has(student.id) ? 'bg-[#fbf9fc]' : ''}`}>
                
                {/* Checkbox */}
                <td className="p-3 print:hidden text-center">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.has(student.id)} 
                    onChange={() => toggleSelect(student.id)} 
                    className="w-4 h-4 rounded-sm border-stone-300 text-[#6b4c9a] cursor-pointer accent-[#6b4c9a]" 
                  />
                </td>
                
                <td className="p-3 font-bold text-stone-900">{student.enrollment_id}</td>
                <td className="p-3 text-stone-600 font-medium">Class {classes.find(c => c.id === student.class_id)?.name}</td>
                <td className="p-3 font-bold text-stone-900">
                  <div className="flex items-center gap-3">
                    {student.photo_url ? (
                      <img src={student.photo_url} alt="Profile" className="w-8 h-8 rounded-sm object-cover border border-stone-300 print:hidden" />
                    ) : (
                      <div className="w-8 h-8 rounded-sm bg-stone-100 flex items-center justify-center text-xs text-stone-500 font-bold border border-stone-200 print:hidden">
                        {student.first_name.charAt(0)}
                      </div>
                    )}
                    {student.first_name}
                  </div>
                </td>
                <td className="p-3 text-stone-600 capitalize">{student.gender || '-'}</td>
                <td className="p-3 text-stone-800">{student.guardian_name || '-'}</td>
                <td className="p-3 text-stone-600 font-medium">{student.guardian_phone || '-'}</td>
                
                {/* Actions Buttons */}
                <td className="p-3 text-right print:hidden">
                  <div className="flex justify-end gap-2 items-center">
                    <Link 
                      href={`/school-dashboard/students/${student.id}/view`} 
                      className="px-3 py-1.5 bg-[#fbf9fc] border border-[#dad3e3] text-[#6b4c9a] rounded-sm text-[10px] uppercase tracking-widest font-bold hover:bg-[#f3eff8] transition-colors shadow-sm"
                    >
                      View
                    </Link>
                    <Link 
                      href={`/school-dashboard/students/${student.id}/edit`} 
                      className="px-3 py-1.5 bg-white border border-stone-200 text-stone-600 rounded-sm text-[10px] uppercase tracking-widest font-bold hover:border-[#6b4c9a]/50 hover:text-[#6b4c9a] transition-colors shadow-sm"
                    >
                      Edit
                    </Link>
                    <div className="scale-90 origin-right">
                      <DeleteStudentButton 
                        studentId={student.id} 
                        studentName={student.first_name} 
                      />
                    </div>
                  </div>
                </td>

              </tr>
            ))}
            {filteredStudents.length === 0 && (
              <tr>
                <td colSpan={8} className="p-12 text-center text-stone-500 italic bg-stone-50">
                  No students match the current filters or search query.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}