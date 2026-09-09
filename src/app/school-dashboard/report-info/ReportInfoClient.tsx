'use client'

import React, { useState } from 'react'
import * as XLSX from 'xlsx'

// Interface Definitions
interface FieldConfig {
  key: string
  label: string
  isLocked?: boolean
}

const STUDENT_FIELDS: FieldConfig[] = [
  { key: 'name', label: 'Name (EN/BN)', isLocked: true },
  { key: 'roll', label: 'Roll No', isLocked: true },
  { key: 'class', label: 'Class', isLocked: true },
  { key: 'gender', label: 'Gender' },
  { key: 'dob', label: 'Date of Birth' },
  { key: 'bloodGroup', label: 'Blood Group' },
  { key: 'village', label: 'Village / Address' },
  { key: 'fatherName', label: "Father's Name" },
  { key: 'fatherPayment', label: "Father's Payment (No & Method)" },
  { key: 'motherName', label: "Mother's Name" },
  { key: 'motherPayment', label: "Mother's Payment (No & Method)" },
  { key: 'guardianName', label: "Guardian's Name" },
  { key: 'guardianPayment', label: "Guardian's Payment (No & Method)" },
]

const TEACHER_FIELDS: FieldConfig[] = [
  { key: 'name', label: 'Teacher Name', isLocked: true },
  { key: 'subjects', label: 'Subjects Taught' },
  { key: 'joiningDate', label: 'Joining Date' },
  { key: 'dob', label: 'Date of Birth' },
  { key: 'bloodGroup', label: 'Blood Group' },
  { key: 'mobile', label: 'Contact Number' },
]

export default function ReportInfoClient({ students = [], teachers = [], classes = [] }: any) {
  const [reportType, setReportType] = useState<'student' | 'teacher'>('student')

  // Selected state for checkboxes (auto-selecting combined payment fields)
  const [selectedStudentFields, setSelectedStudentFields] = useState<string[]>(['name', 'roll', 'class', 'fatherName', 'fatherPayment'])
  const [selectedTeacherFields, setSelectedTeacherFields] = useState<string[]>(['name', 'subjects', 'joiningDate', 'mobile'])

  const toggleStudentField = (key: string) => {
    if (STUDENT_FIELDS.find(f => f.key === key)?.isLocked) return
    setSelectedStudentFields(prev => prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key])
  }

  const toggleTeacherField = (key: string) => {
    if (TEACHER_FIELDS.find(f => f.key === key)?.isLocked) return
    setSelectedTeacherFields(prev => prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key])
  }

  // Active fields based on current tab
  const activeFieldsConfig = reportType === 'student' ? STUDENT_FIELDS : TEACHER_FIELDS
  const activeSelectedKeys = reportType === 'student' ? selectedStudentFields : selectedTeacherFields
  
  // Columns to display
  const activeColumns = activeFieldsConfig.filter(f => activeSelectedKeys.includes(f.key))

  // Data Extraction Logic with Combo Formatter
  const getMappedData = () => {
    if (reportType === 'student') {
      return students.map((s: any) => {
        const row: Record<string, string> = {}
        if (selectedStudentFields.includes('name')) row['Name (EN/BN)'] = s.first_name || s.studentNameEn || s.nameBangla || '-'
        if (selectedStudentFields.includes('roll')) row['Roll No'] = String(s.enrollment_id || '-')
        if (selectedStudentFields.includes('class')) row['Class'] = classes.find((c: any) => c.id === s.class_id)?.name || s.class_id || '-'
        if (selectedStudentFields.includes('gender')) row['Gender'] = s.gender || '-'
        if (selectedStudentFields.includes('dob')) row['Date of Birth'] = s.date_of_birth || s.dateOfBirth || '-'
        if (selectedStudentFields.includes('bloodGroup')) row['Blood Group'] = s.blood_group || s.bloodGroup || '-'
        if (selectedStudentFields.includes('village')) row['Village / Address'] = s.village || '-'
        
        // Father Combo (Number + Method)
        if (selectedStudentFields.includes('fatherName')) row["Father's Name"] = s.father_name || s.fatherNameEn || s.fatherNameBn || '-'
        if (selectedStudentFields.includes('fatherPayment')) {
          const fMob = s.father_mobile || s.fatherMobile || ''
          const fMethod = s.father_mobile_banking || s.fatherMobileBanking || ''
          row["Father's Payment (No & Method)"] = fMob && fMethod ? `${fMob} (${fMethod})` : fMob || fMethod || '-'
        }
        
        // Mother Combo (Number + Method)
        if (selectedStudentFields.includes('motherName')) row["Mother's Name"] = s.mother_name || s.motherNameEn || s.motherNameBn || '-'
        if (selectedStudentFields.includes('motherPayment')) {
          const mMob = s.mother_mobile || s.motherMobile || ''
          const mMethod = s.mother_mobile_banking || s.motherMobileBanking || ''
          row["Mother's Payment (No & Method)"] = mMob && mMethod ? `${mMob} (${mMethod})` : mMob || mMethod || '-'
        }
        
        // Guardian Combo (Number + Method)
        if (selectedStudentFields.includes('guardianName')) row["Guardian's Name"] = s.guardian_name || s.guardianNameEn || s.guardianNameBn || '-'
        if (selectedStudentFields.includes('guardianPayment')) {
          const gMob = s.guardian_mobile || s.guardianMobile || ''
          const gMethod = s.guardian_mobile_banking || s.guardianMobileBanking || ''
          row["Guardian's Payment (No & Method)"] = gMob && gMethod ? `${gMob} (${gMethod})` : gMob || gMethod || '-'
        }

        return row
      })
    } else {
      return teachers.map((t: any) => {
        const row: Record<string, string> = {}
        if (selectedTeacherFields.includes('name')) row['Teacher Name'] = t.full_name || t.fullName || '-'
        if (selectedTeacherFields.includes('subjects')) row['Subjects Taught'] = t.subjects_taught || t.subjectsTaught || '-'
        if (selectedTeacherFields.includes('joiningDate')) row['Joining Date'] = t.joining_date || t.joiningDate || '-'
        if (selectedTeacherFields.includes('dob')) row['Date of Birth'] = t.birth_date || t.birthDate || '-'
        if (selectedTeacherFields.includes('bloodGroup')) row['Blood Group'] = t.blood_group || t.bloodGroup || '-'
        if (selectedTeacherFields.includes('mobile')) row['Contact Number'] = t.phone || t.mobile || t.fatherMobile || t.guardianMobile || '-'
        return row
      })
    }
  }

  const handleExportExcel = () => {
    const data = getMappedData()
    if (data.length === 0) return alert("No data available to export.")
    
    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report")
    XLSX.writeFile(workbook, `${reportType}_report.xlsx`)
  }

  const handlePrintPDF = () => {
    window.print()
  }

  const previewData = getMappedData()

  return (
    <main className="min-h-screen bg-[#FAFAFA] p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6 print:hidden">
        
        {/* Header */}
        <div className="bg-white p-6 md:p-8 rounded-sm shadow-sm border border-stone-200 border-t-4 border-t-[#6b4c9a]">
          <h1 className="text-2xl font-bold text-stone-900 uppercase tracking-wide">Custom Information Reports</h1>
          <p className="text-sm font-medium text-stone-500 mt-2">Select the data points you want to export as an Excel File or PDF Document.</p>
        </div>

        {/* Tab Controls */}
        <div className="flex gap-2">
          <button 
            onClick={() => setReportType('student')}
            className={`px-6 py-3.5 text-xs font-bold uppercase tracking-widest rounded-sm transition-all border ${reportType === 'student' ? 'bg-white shadow-sm border-stone-200 text-[#6b4c9a]' : 'bg-transparent border-transparent text-stone-500 hover:text-stone-800 hover:border-stone-200'}`}
          >
            Student Records
          </button>
          <button 
            onClick={() => setReportType('teacher')}
            className={`px-6 py-3.5 text-xs font-bold uppercase tracking-widest rounded-sm transition-all border ${reportType === 'teacher' ? 'bg-white shadow-sm border-stone-200 text-[#6b4c9a]' : 'bg-transparent border-transparent text-stone-500 hover:text-stone-800 hover:border-stone-200'}`}
          >
            Teacher Roster
          </button>
        </div>

        {/* Checkbox Selector Area */}
        <div className="bg-white p-6 md:p-8 rounded-sm shadow-sm border border-stone-200">
          <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-6 border-b border-stone-100 pb-3">
            Include Columns in Report
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {activeFieldsConfig.map(field => {
              const isChecked = activeSelectedKeys.includes(field.key)
              return (
                <label 
                  key={field.key} 
                  className={`flex items-center gap-3 p-4 border rounded-sm transition-all 
                    ${field.isLocked ? 'bg-stone-50 border-stone-200 opacity-80 cursor-not-allowed' : 'bg-white cursor-pointer hover:border-[#6b4c9a]'}
                    ${isChecked && !field.isLocked ? 'border-[#6b4c9a] shadow-sm bg-purple-50/20' : 'border-stone-200'}
                  `}
                >
                  <input 
                    type="checkbox" 
                    checked={isChecked}
                    disabled={field.isLocked}
                    onChange={() => reportType === 'student' ? toggleStudentField(field.key) : toggleTeacherField(field.key)}
                    className="w-5 h-5 accent-[#6b4c9a] text-[#6b4c9a] border-stone-300 rounded-sm cursor-pointer disabled:cursor-not-allowed"
                  />
                  <span className={`text-sm font-bold tracking-wide ${isChecked ? 'text-[#6b4c9a]' : 'text-stone-600'}`}>
                    {field.label}
                  </span>
                </label>
              )
            })}
          </div>

          <div className="mt-8 pt-6 border-t border-stone-200 flex flex-col sm:flex-row gap-4 justify-end">
            <button 
              onClick={handleExportExcel}
              className="bg-stone-900 text-white px-8 py-3.5 rounded-sm text-xs font-bold uppercase tracking-widest hover:bg-stone-800 transition-colors shadow-sm"
            >
              Download Excel (.XLSX)
            </button>
            <button 
              onClick={handlePrintPDF}
              className="bg-[#6b4c9a] text-white px-8 py-3.5 rounded-sm text-xs font-bold uppercase tracking-widest hover:bg-[#5a3f82] transition-colors shadow-sm"
            >
              Export as PDF
            </button>
          </div>
        </div>

        {/* Live Preview Wrapper */}
        <div className="bg-white rounded-sm shadow-sm border border-stone-200 overflow-hidden">
          <div className="bg-stone-50 p-6 border-b border-stone-200">
            <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wide">Data Preview</h3>
            <p className="text-xs text-stone-500 font-medium mt-1">First 5 rows shown for layout verification.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-white border-b border-stone-200 text-stone-500">
                <tr>
                  {activeColumns.map(col => (
                    <th key={col.key} className="p-4 font-bold uppercase tracking-widest text-[10px]">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {previewData.slice(0, 5).map((row, i) => (
                  <tr key={i} className="hover:bg-stone-50 transition-colors">
                    {activeColumns.map(col => (
                      <td key={col.key} className="p-4 text-stone-800 font-medium">
                        {row[col.label as string] || '-'}
                      </td>
                    ))}
                  </tr>
                ))}
                {previewData.length === 0 && (
                  <tr>
                    <td colSpan={activeColumns.length} className="p-8 text-center text-stone-400 italic font-medium">No records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* =========================================
          HIDDEN PRINT LAYOUT (Visible only on PDF/Print)
      ========================================= */}
      <div className="hidden print:block w-full text-black bg-white">
        <div className="mb-6 border-b-2 border-black pb-4 text-center">
          <h2 className="text-2xl font-black uppercase tracking-widest">
            {reportType === 'student' ? 'Student Information Report' : 'Teacher Information Report'}
          </h2>
          <p className="text-sm font-bold text-gray-500 mt-1">Generated via e-Biddaloy Dashboard • {new Date().toLocaleDateString()}</p>
        </div>
        
        <table className="w-full border-collapse border border-gray-400 text-sm">
          <thead className="bg-gray-100 text-gray-800">
            <tr>
              <th className="border border-gray-400 p-2 text-left font-bold uppercase text-[10px] w-12 text-center">#</th>
              {activeColumns.map(col => (
                <th key={col.key} className="border border-gray-400 p-2 text-left font-bold uppercase tracking-wider text-[10px]">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewData.map((row, i) => (
              <tr key={i}>
                <td className="border border-gray-400 p-2 text-center text-gray-600">{i + 1}</td>
                {activeColumns.map(col => (
                  <td key={col.key} className="border border-gray-400 p-2 text-gray-900 break-words">
                    {row[col.label as string] || '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </main>
  )
}