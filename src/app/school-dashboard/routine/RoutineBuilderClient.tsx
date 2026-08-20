"use client"

import { useState } from 'react'
import { addRoutineSlot, deleteRoutineSlot, autoGenerateRoutine } from '@/app/actions/routine-actions'

// ---------------------------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------------------------

export interface RoutineSlot {
  id?: string | number;
  class_name: string;
  teacher_name: string;
  day_of_week: string;
  subject: string;
}

export interface TeacherData {
  id: string | number;
  name: string;
  max_periods_per_week?: number;
}

export interface ClassData {
  id: string | number;
  name: string;
  section_count?: number;
}

export interface SubjectData {
  id: string | number;
  name: string;
}

export interface RoutineConfig {
  schoolId: string | number;
  periodsPerDay: number;
  daysOfWeek: string[];
}

export interface RoutineBuilderClientProps {
  initialSlots: RoutineSlot[];
  teachers: TeacherData[];
  classes: ClassData[];
  subjects: SubjectData[];
  config: RoutineConfig;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RoutineBuilderClient({ 
  initialSlots, 
  teachers, 
  classes, 
  subjects, // Passed in but currently unused in the UI
  config 
}: RoutineBuilderClientProps) {
  const [activeTab, setActiveTab] = useState<string>('manual')
  const [viewMode, setViewMode] = useState<string>('student') // 'student' | 'teacher'
  const [selectedClass, setSelectedClass] = useState<string>(classes[0]?.name || '')
  const [selectedTeacher, setSelectedTeacher] = useState<string>(teachers[0]?.name || '')

  // --- GAP ANALYSIS CALCULATION ---
  const totalClasses = classes.reduce((acc, curr) => acc + (curr.section_count || 1), 0)
  const totalRequiredPeriods = totalClasses * config.periodsPerDay * config.daysOfWeek.length
  const totalTeacherCapacity = teachers.reduce((acc, curr) => acc + (curr.max_periods_per_week || 30), 0)
  const gap = totalTeacherCapacity - totalRequiredPeriods

  // --- FILTERING FOR VIEWS ---
  const filteredSlots = initialSlots.filter((slot) => {
    if (viewMode === 'student') return slot.class_name === selectedClass
    if (viewMode === 'teacher') return slot.teacher_name === selectedTeacher
    return true
  })

  return (
    <div className="space-y-6">
      {/* Navigation Tabs (Hidden during printing) */}
      <div className="flex gap-4 border-b pb-2 print:hidden">
        {['manual', 'auto', 'view'].map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium capitalize ${activeTab === tab ? 'text-blue-700 border-b-2 border-blue-700' : 'text-gray-500 hover:text-gray-900'}`}
          >
            {tab === 'view' ? 'Print / View Routines' : `${tab} Entry`}
          </button>
        ))}
      </div>

      {/* TAB 1: MANUAL ENTRY */}
      {activeTab === 'manual' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="bg-white rounded-lg shadow-sm p-6 lg:col-span-1 border-t-4 border-blue-900">
            <h2 className="text-lg font-semibold mb-4">Manual Slot Entry</h2>
            {/* Note: Server Actions (addRoutineSlot) naturally expect FormData when passed to the action prop */}
            <form action={addRoutineSlot} className="flex flex-col gap-4">
              <input type="hidden" name="schoolId" value={config.schoolId} />
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700">Class Name</label>
                  <select name="className" className="mt-1 w-full p-2 border rounded text-sm">
                    {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Section</label>
                  <input type="text" name="section" defaultValue="A" required className="mt-1 w-full p-2 border rounded text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">Day of Week</label>
                <select name="dayOfWeek" className="mt-1 w-full p-2 border rounded text-sm">
                  {config.daysOfWeek.map(day => <option key={day} value={day}>{day}</option>)}
                </select>
              </div>

              {/* Other manual inputs (Time, Subject, Teacher) go here... */}
              
              <button type="submit" className="mt-2 w-full bg-blue-900 text-white p-2 rounded hover:bg-blue-800 text-sm font-medium">
                + Add to Routine
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: AUTO GENERATOR & GAP ANALYSIS */}
      {activeTab === 'auto' && (
        <div className="bg-white rounded-lg shadow-sm p-6 max-w-2xl">
          <h2 className="text-xl font-bold mb-4">Automated Routine Generator</h2>
          
          <div className="bg-gray-50 p-4 rounded-md mb-6 border">
            <h3 className="font-semibold text-gray-700 mb-2">Gap & Capacity Analysis</h3>
            <ul className="space-y-2 text-sm">
              <li>Total Periods Required Weekly: <strong>{totalRequiredPeriods}</strong></li>
              <li>Total Teacher Capacity Weekly: <strong>{totalTeacherCapacity}</strong></li>
              <li className={gap < 0 ? "text-red-600 font-bold" : "text-green-600 font-bold"}>
                Status: {gap < 0 
                  ? `Shortage of ${Math.abs(gap)} periods. You need more teachers or fewer classes.` 
                  : `Surplus capacity of ${gap} periods. Ready to generate.`}
              </li>
            </ul>
          </div>

          <form action={autoGenerateRoutine}>
            <input type="hidden" name="schoolId" value={config.schoolId} />
            <button 
              type="submit" 
              disabled={gap < 0}
              className="w-full bg-green-700 text-white p-3 rounded-md font-bold hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Generate Weekly Routine
            </button>
            {gap < 0 && <p className="text-xs text-red-500 mt-2 text-center">Resolve capacity gaps before auto-generating.</p>}
          </form>
        </div>
      )}

      {/* TAB 3: PRINTABLE VIEWS */}
      {activeTab === 'view' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-6 print:hidden">
            <div className="flex gap-4 items-center">
              <select 
                value={viewMode} 
                onChange={(e) => setViewMode(e.target.value)}
                className="p-2 border rounded font-medium"
              >
                <option value="student">Student / Class View</option>
                <option value="teacher">Teacher Master View</option>
              </select>

              {viewMode === 'student' ? (
                <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="p-2 border rounded">
                  {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              ) : (
                <select value={selectedTeacher} onChange={(e) => setSelectedTeacher(e.target.value)} className="p-2 border rounded">
                  {teachers.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
              )}
            </div>
            
            <button onClick={() => window.print()} className="bg-gray-800 text-white px-4 py-2 rounded shadow hover:bg-gray-700">
              🖨️ Print / Save as PDF
            </button>
          </div>

          {/* Printable Timetable Layout */}
          <div className="print:block" id="printable-routine">
            <h2 className="text-2xl font-bold text-center mb-4 hidden print:block">
              {viewMode === 'student' ? `Class Routine: ${selectedClass}` : `Teacher Routine: ${selectedTeacher}`}
            </h2>
            
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 text-sm text-center">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border p-2">Day</th>
                    <th className="border p-2">Period 1</th>
                    <th className="border p-2">Period 2</th>
                    <th className="border p-2">Period 3</th>
                    {/* Expand based on config.periodsPerDay */}
                  </tr>
                </thead>
                <tbody>
                  {config.daysOfWeek.map(day => {
                    const daySlots = filteredSlots.filter(s => s.day_of_week === day);
                    return (
                      <tr key={day}>
                        <td className="border p-2 font-bold">{day}</td>
                        {/* Map through periods to place subjects correctly */}
                        <td className="border p-2">
                           {daySlots[0] ? `${daySlots[0].subject} (${daySlots[0].teacher_name})` : '-'}
                        </td>
                         <td className="border p-2">
                           {daySlots[1] ? `${daySlots[1].subject} (${daySlots[1].teacher_name})` : '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}