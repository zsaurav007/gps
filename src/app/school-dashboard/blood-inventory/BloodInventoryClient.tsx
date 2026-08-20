'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Dropdown from '@/components/ui/dropdown'

type BloodRecord = {
  id: string
  name: string
  role: string
  bloodGroup: string
  details: string
}

export default function BloodInventoryClient({ initialData }: { initialData: BloodRecord[] }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [bloodFilter, setBloodFilter] = useState<string | number>('All')
  const [roleFilter, setRoleFilter] = useState<string | number>('All')

  // Filter Data Dynamically
  const filteredData = useMemo(() => {
    return initialData.filter(record => {
      const matchesSearch = record.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            record.details.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesBlood = bloodFilter === 'All' || record.bloodGroup === bloodFilter
      const matchesRole = roleFilter === 'All' || record.role === roleFilter
      return matchesSearch && matchesBlood && matchesRole
    })
  }, [initialData, searchTerm, bloodFilter, roleFilter])

  // Export to CSV (Excel Compatible)
  const handleExportCSV = () => {
    const headers = ['Name', 'Role', 'Blood Group', 'Details']
    const rows = filteredData.map(record => [
      `"${record.name}"`, 
      `"${record.role}"`, 
      `"${record.bloodGroup}"`, 
      `"${record.details}"`
    ])
    
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `blood_inventory_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Export to PDF (Triggers Print Dialog configured for PDF)
  const handleExportPDF = () => {
    window.print()
  }

  // Dropdown Options
  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unrecorded']
  const roles = ['Headmaster', 'Faculty', 'Student']

  const bloodGroupOptions = [
    { label: 'All Blood Groups', value: 'All' },
    ...bloodGroups.map(bg => ({ label: bg, value: bg }))
  ]

  const roleOptions = [
    { label: 'All Roles', value: 'All' },
    ...roles.map(r => ({ label: r, value: r }))
  ]

  return (
    <div className="space-y-6 sm:space-y-8 font-sans text-stone-900 print:space-y-4">
      
      {/* Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 md:p-8 rounded-sm shadow-sm border border-stone-200 border-t-4 border-t-[#6b4c9a] gap-5 print:hidden">
        <div>
          <p className="text-[10px] font-bold tracking-widest text-stone-500 uppercase mb-1.5">Institution Database</p>
          <h1 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">
            Blood Inventory
          </h1>
          <p className="text-sm font-medium text-stone-600 mt-2">
            Track and manage emergency donor demographics across the campus.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 shrink-0 pt-2 md:pt-0 border-t border-stone-100 md:border-t-0 md:border-l md:border-stone-200 md:pl-6 w-full md:w-auto">
          <button 
            onClick={handleExportCSV} 
            className="flex-1 md:flex-none bg-white text-stone-600 border border-stone-200 px-5 py-3 rounded-sm hover:bg-stone-50 transition-colors font-bold tracking-widest text-[10px] uppercase shadow-sm"
          >
            Export CSV
          </button>
          <button 
            onClick={handleExportPDF} 
            className="flex-1 md:flex-none bg-[#6b4c9a] text-white px-5 py-3 rounded-sm hover:bg-[#5a3f82] transition-colors font-bold tracking-widest text-[10px] uppercase shadow-sm"
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* Print-Only Header */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold text-black uppercase tracking-wide">Institution Blood Inventory</h1>
        <p className="text-sm text-gray-600 mt-1">Generated on: {new Date().toLocaleDateString()}</p>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-sm border border-stone-200 p-6 md:p-8 shadow-sm print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="relative z-30">
            <label className="block text-[10px] font-bold text-stone-600 tracking-widest uppercase mb-2">Search Records</label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              <input 
                type="text" 
                placeholder="Search name or details..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-stone-300 rounded-sm text-sm font-medium focus:ring-1 focus:ring-[#6b4c9a] focus:border-[#6b4c9a] outline-none transition-all bg-white placeholder:text-stone-400 shadow-sm"
              />
            </div>
          </div>
          <div className="relative z-20">
            <label className="block text-[10px] font-bold text-stone-600 tracking-widest uppercase mb-2">Blood Group</label>
            <Dropdown 
              options={bloodGroupOptions}
              value={bloodFilter}
              onChange={setBloodFilter}
              placeholder="-- All Blood Groups --"
            />
          </div>
          <div className="relative z-10">
            <label className="block text-[10px] font-bold text-stone-600 tracking-widest uppercase mb-2">Campus Role</label>
            <Dropdown 
              options={roleOptions}
              value={roleFilter}
              onChange={setRoleFilter}
              placeholder="-- All Roles --"
            />
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-sm border border-stone-200 shadow-sm overflow-hidden print:border-none print:shadow-none">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              <tr className="bg-[#fbf9fc] border-b border-[#dad3e3] print:bg-white print:border-b-2 print:border-black">
                <th className="p-5 text-[10px] font-bold tracking-widest text-stone-500 uppercase">Name</th>
                <th className="p-5 text-[10px] font-bold tracking-widest text-stone-500 uppercase">Role</th>
                <th className="p-5 text-[10px] font-bold tracking-widest text-stone-500 uppercase">Blood Group</th>
                <th className="p-5 text-[10px] font-bold tracking-widest text-stone-500 uppercase">Assignment / Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 print:divide-gray-200">
              {filteredData.length > 0 ? (
                filteredData.map((record) => (
                  <tr key={record.id} className="hover:bg-stone-50/50 transition-colors bg-white print:break-inside-avoid">
                    <td className="p-5 text-sm font-bold text-stone-900 uppercase tracking-wide print:text-black">
                      {record.name}
                    </td>
                    <td className="p-5">
                      <span className={`inline-flex px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest rounded-sm border ${
                        record.role === 'Student' ? 'bg-stone-50 border-stone-200 text-stone-600' : 
                        record.role === 'Faculty' ? 'bg-[#fbf9fc] border-[#dad3e3] text-[#6b4c9a]' : 
                        'bg-stone-800 border-stone-900 text-white'
                      } print:border-none print:p-0 print:bg-transparent print:text-black`}>
                        {record.role}
                      </span>
                    </td>
                    <td className="p-5">
                      <span className={`text-sm font-bold tracking-widest ${
                        record.bloodGroup === 'Unrecorded' ? 'text-stone-400 font-medium italic' : 'text-[#b4483e]'
                      } print:text-black`}>
                        {record.bloodGroup}
                      </span>
                    </td>
                    <td className="p-5 text-xs font-medium text-stone-500 tracking-wide uppercase print:text-black">
                      {record.details}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-xs font-medium text-stone-400 tracking-wide uppercase italic">
                    No matching records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-[#fbf9fc] p-4 border-t border-[#dad3e3] text-right print:hidden">
          <p className="text-[10px] font-bold tracking-widest text-[#6b4c9a] uppercase">
            Showing {filteredData.length} records
          </p>
        </div>
      </div>

    </div>
  )
}