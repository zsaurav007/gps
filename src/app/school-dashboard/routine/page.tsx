"use client"

import { useMemo, useState } from 'react'
import Dropdown from '@/components/ui/dropdown' // adjust this path if your file is named differently

// ---------------------------------------------------------------------------
// Scheduling engine & Utilities
// ---------------------------------------------------------------------------
const sectionKeyOf = (classId, section) => `${classId}::${section || ''}`
const slotKeyOf = (day, period, ...rest) => [day, period, ...rest].join('::')

// Fisher-Yates shuffle to randomize placement and add variation
function shuffleArray(array) {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// Calculate subject-wise requirements and teacher capacities
function calculateDeficits(days, classes, subjects, requirements, teachers, qualifications, maxClassPeriods) {
  let totalReq = 0
  const subjectReqs = {}
  subjects.forEach(s => subjectReqs[s.id] = 0)
  requirements.forEach(r => {
    const p = Number(r.periodsPerWeek) || 0
    subjectReqs[r.subjectId] += p
    totalReq += p
  })

  let totalClassSlots = 0
  classes.forEach(c => {
    const sectionsCount = c.sections.length > 0 ? c.sections.length : 1
    totalClassSlots += c.periodsPerDay * days.length * sectionsCount
  })

  const unassignedCurriculum = Math.max(0, totalClassSlots - totalReq)
  const totalCap = teachers.reduce((sum, t) => sum + (Math.min(t.maxPeriodsPerDay, maxClassPeriods) * days.length), 0)

  // Subject-wise analysis with teacher names & qualified capacity
  const subjectStats = subjects.map(s => {
    const req = subjectReqs[s.id] || 0
    const qualifiedTeachers = qualifications
      .filter(q => q.subjectId === s.id)
      .map(q => {
        const t = teachers.find(teach => teach.id === q.teacherId)
        return t ? { id: t.id, name: t.name, maxWeekly: Math.min(t.maxPeriodsPerDay, maxClassPeriods) * days.length } : null
      })
      .filter(Boolean)

    const rawCapacity = qualifiedTeachers.reduce((sum, t) => sum + t.maxWeekly, 0)

    return {
      id: s.id,
      name: s.name,
      req,
      qualifiedTeachers,
      rawCapacity,
      isUnassigned: qualifiedTeachers.length === 0 && req > 0
    }
  })

  // Proportional capacity distribution for teachers teaching multiple subjects
  const subjectProportionalCaps = {}
  subjects.forEach(s => subjectProportionalCaps[s.id] = 0)

  teachers.forEach(t => {
    const qualSubjects = qualifications.filter(q => q.teacherId === t.id).map(q => q.subjectId)
    const teacherCap = Math.min(t.maxPeriodsPerDay, maxClassPeriods) * days.length

    let reqForTeacher = 0
    qualSubjects.forEach(sid => reqForTeacher += (subjectReqs[sid] || 0))

    if (reqForTeacher > 0) {
      qualSubjects.forEach(sid => {
        const proportion = (subjectReqs[sid] || 0) / reqForTeacher
        subjectProportionalCaps[sid] += (teacherCap * proportion)
      })
    } else if (qualSubjects.length > 0) {
      const split = teacherCap / qualSubjects.length
      qualSubjects.forEach(sid => subjectProportionalCaps[sid] += split)
    }
  })

  const detailedSubjectStats = subjectStats.map(s => {
    const effectiveCap = Math.floor(subjectProportionalCaps[s.id] || 0)
    const deficit = Math.max(0, s.req - effectiveCap)
    const balance = effectiveCap - s.req
    return {
      ...s,
      effectiveCap,
      deficit,
      balance
    }
  })

  const overallDeficit = Math.max(0, totalReq - totalCap)

  return {
    totalReq,
    totalCap,
    overallDeficit,
    subjectStats: detailedSubjectStats,
    unassignedCurriculum
  }
}

function analyzeSetup(days, classes, subjects, requirements, teachers, qualifications, deficits) {
  const warnings = []
  const subjectNameById = new Map(subjects.map((s) => [s.id, s.name]))

  for (const cls of classes) {
    const sections = cls.sections.length > 0 ? cls.sections : ['']
    for (const section of sections) {
      const reqs = requirements.filter((r) => r.classId === cls.id && (r.section || '') === section)
      const totalRequired = reqs.reduce((sum, r) => sum + Number(r.periodsPerWeek || 0), 0)
      const availableSlots = days.length * cls.periodsPerDay

      if (reqs.length === 0) {
        warnings.push(`${cls.name}${section} has no subjects assigned yet.`)
        continue
      }

      if (totalRequired !== availableSlots) {
        warnings.push(
          `${cls.name}${section} needs exactly ${availableSlots} periods/week, but currently has ${totalRequired} assigned in the matrix.`
        )
      }

      for (const req of reqs) {
        const subjectName = subjectNameById.get(req.subjectId) || 'Unknown subject'
        if (!req.periodsPerWeek || req.periodsPerWeek <= 0) {
          warnings.push(`${cls.name}${section} — ${subjectName} has 0 periods/week set.`)
          continue
        }
        if (req.periodsPerWeek > days.length) {
          warnings.push(`${cls.name}${section} — ${subjectName} is set to ${req.periodsPerWeek} periods/week (Max working days: ${days.length}). Set it to ≤ ${days.length} to avoid daily duplicate classes.`)
        }
        const qualified = qualifications.filter((q) => q.subjectId === req.subjectId)
        if (qualified.length === 0) {
          warnings.push(`${cls.name}${section} — ${subjectName}: no teacher is qualified yet.`)
        }
      }
    }
  }

  if (deficits.overallDeficit > 0) {
    warnings.push(`Overall Teacher Shortage: Your current teachers fall short by ${deficits.overallDeficit} periods/week.`)
  }
  
  const subjectsWithDeficit = deficits.subjectStats.filter(s => s.deficit > 0 && s.req > 0)
  if (subjectsWithDeficit.length > 0) {
    const names = subjectsWithDeficit.map(d => `${d.name} (${d.deficit} short)`).join(', ')
    warnings.push(`Subject-wise Deficit: More teacher availability needed for: ${names}.`)
  }

  if (subjects.length === 0) warnings.push('No subjects created yet.')
  if (days.length === 0) warnings.push('No working days available.')
  if (teachers.length === 0) warnings.push('No teachers added yet.')
  if (classes.length === 0) warnings.push('No classes added yet.')

  return warnings
}

// Multi-start randomized greedy algorithm with balanced workload
function generateRoutine(days, classes, subjects, requirements, teachers, qualifications, preferredAssignments, maxClassPeriods) {
  const start = Date.now()
  let bestResult = null
  let minUnscheduled = Infinity
  const MAX_ATTEMPTS = 150 

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const result = attemptSchedule(days, classes, subjects, requirements, teachers, qualifications, preferredAssignments, maxClassPeriods)
    
    if (result.unscheduled.length === 0) {
      bestResult = result
      break
    }
    
    if (result.unscheduled.length < minUnscheduled) {
      minUnscheduled = result.unscheduled.length
      bestResult = result
    }
  }

  if (bestResult) {
    bestResult.generationTimeMs = Date.now() - start
  }
  
  return bestResult
}

function attemptSchedule(days, classes, subjects, requirements, teachers, qualifications, preferredAssignments, maxClassPeriods) {
  const teacherById = new Map(teachers.map((t) => [t.id, t]))
  const subjectNameById = new Map(subjects.map((s) => [s.id, s.name]))
  
  const lessons = []
  for (const cls of classes) {
    const sections = cls.sections.length > 0 ? cls.sections : ['']
    for (const section of sections) {
      const reqs = requirements.filter((r) => r.classId === cls.id && (r.section || '') === section)
      for (const req of reqs) {
        if (!req.periodsPerWeek || req.periodsPerWeek <= 0) continue
        const subjectName = subjectNameById.get(req.subjectId) || 'Unknown Subject'

        const preferred = preferredAssignments.find(
          (p) => p.classId === cls.id && (p.section || '') === section && p.subjectId === req.subjectId
        )
        const candidateTeachers = preferred
          ? [preferred.teacherId]
          : qualifications.filter((q) => q.subjectId === req.subjectId).map((q) => q.teacherId)

        for (let i = 0; i < req.periodsPerWeek; i++) {
          lessons.push({
            id: `${cls.id}::${section}::${req.subjectId}::${i}`,
            classId: cls.id,
            className: cls.name,
            periodsPerDay: cls.periodsPerDay,
            section,
            subject: subjectName,
            candidateTeachers,
          })
        }
      }
    }
  }

  // Most constrained subjects scheduled first
  lessons.sort((a, b) => {
    if (a.candidateTeachers.length === b.candidateTeachers.length) return Math.random() - 0.5
    return a.candidateTeachers.length - b.candidateTeachers.length
  })

  const classSlotTaken = new Set()
  const teacherSlotTaken = new Set()
  const teacherDailyCount = new Map()
  const teacherTotalCount = new Map()
  const subjectDayUsed = new Map()
  const classDaySubjectTaken = new Set()

  const entries = []
  const unscheduled = []

  const bump = (map, k, by = 1) => map.set(k, (map.get(k) || 0) + by)

  function commit(entry) {
    entries.push(entry)
    classSlotTaken.add(slotKeyOf(entry.day, entry.period, entry.classId, entry.section))
    teacherSlotTaken.add(slotKeyOf(entry.day, entry.period, entry.teacherId))
    bump(teacherDailyCount, `${entry.teacherId}::${entry.day}`)
    bump(teacherTotalCount, entry.teacherId)
    
    const sdKey = `${entry.classId}::${entry.section}::${entry.subject}`
    if (!subjectDayUsed.has(sdKey)) subjectDayUsed.set(sdKey, new Set())
    subjectDayUsed.get(sdKey).add(entry.day)
    
    classDaySubjectTaken.add(`${entry.classId}::${entry.section}::${entry.day}::${entry.subject}`)
  }

  function release(entry) {
    const idx = entries.indexOf(entry)
    if (idx >= 0) entries.splice(idx, 1)
    classSlotTaken.delete(slotKeyOf(entry.day, entry.period, entry.classId, entry.section))
    teacherSlotTaken.delete(slotKeyOf(entry.day, entry.period, entry.teacherId))
    bump(teacherDailyCount, `${entry.teacherId}::${entry.day}`, -1)
    bump(teacherTotalCount, entry.teacherId, -1)
    
    classDaySubjectTaken.delete(`${entry.classId}::${entry.section}::${entry.day}::${entry.subject}`)
  }

  function tryPlace(lesson) {
    const sdKey = `${lesson.classId}::${lesson.section}::${lesson.subject}`
    const daysUsed = subjectDayUsed.get(sdKey) || new Set()
    
    const preferredSlots = []
    const fallbackSlots = []
    
    for (const day of days) {
      for (let period = 1; period <= lesson.periodsPerDay; period++) {
        if (!daysUsed.has(day)) preferredSlots.push({ day, period })
        else fallbackSlots.push({ day, period })
      }
    }
    
    const orderedSlots = [...shuffleArray(preferredSlots), ...shuffleArray(fallbackSlots)]

    for (const { day, period } of orderedSlots) {
      if (classSlotTaken.has(slotKeyOf(day, period, lesson.classId, lesson.section))) continue
      // Strict single occurrence per day rule
      if (classDaySubjectTaken.has(`${lesson.classId}::${lesson.section}::${day}::${lesson.subject}`)) continue

      // Workload balancing across qualified teachers
      const sortedCandidates = [...lesson.candidateTeachers].sort((a, b) => {
        const countA = teacherTotalCount.get(a) || 0
        const countB = teacherTotalCount.get(b) || 0
        return countA - countB + (Math.random() * 0.4 - 0.2)
      })

      for (const teacherId of sortedCandidates) {
        const teacher = teacherById.get(teacherId)
        if (!teacher) continue
        
        if (teacherSlotTaken.has(slotKeyOf(day, period, teacherId))) continue
        
        const dailyCount = teacherDailyCount.get(`${teacherId}::${day}`) || 0
        const effectiveMax = Math.min(teacher.maxPeriodsPerDay, maxClassPeriods)
        if (dailyCount >= effectiveMax) continue

        return {
          day,
          period,
          classId: lesson.classId,
          className: lesson.className,
          section: lesson.section,
          subject: lesson.subject,
          teacherId,
          teacherName: teacher.name,
        }
      }
    }
    return null
  }

  const placedStack = []
  const RETRY_BUDGET = 8

  for (const lesson of lessons) {
    let placed = tryPlace(lesson)
    let retries = 0

    while (!placed && retries < RETRY_BUDGET && placedStack.length > 0) {
      const idxFromEnd = [...placedStack].reverse().findIndex((p) => lesson.candidateTeachers.includes(p.teacherId))
      if (idxFromEnd === -1) break
      const realIdx = placedStack.length - 1 - idxFromEnd
      const [victim] = placedStack.splice(realIdx, 1)
      release(victim)

      placed = tryPlace(lesson)
      const victimReplaced = tryPlace({
        classId: victim.classId,
        className: victim.className,
        periodsPerDay: classes.find((c) => c.id === victim.classId)?.periodsPerDay || 6,
        section: victim.section,
        subject: victim.subject,
        candidateTeachers: [victim.teacherId],
      })
      if (victimReplaced) {
        commit(victimReplaced)
        placedStack.push(victimReplaced)
      } else {
        unscheduled.push({
          classId: victim.classId,
          className: victim.className,
          section: victim.section,
          subject: victim.subject,
          reason: `Displaced while resolving scheduling conflict for ${lesson.subject}. Check qualified teacher capacity.`,
          needsTeacher: true,
        })
      }
      retries++
    }

    if (placed) {
      commit(placed)
      placedStack.push(placed)
    } else {
      const reason = lesson.candidateTeachers.length === 0
          ? `No teacher is qualified for this subject.`
          : `Teacher availability conflict (daily period limits reached).`
      unscheduled.push({
        classId: lesson.classId,
        className: lesson.className,
        section: lesson.section,
        subject: lesson.subject,
        reason,
        needsTeacher: true,
      })
    }
  }

  return {
    status: unscheduled.length === 0 ? 'success' : entries.length === 0 ? 'no_valid_solution' : 'success_with_warnings',
    totalRequired: lessons.length,
    totalScheduled: entries.length,
    unscheduled,
    entries,
  }
}

function buildTeacherRoutines(entries, teachers) {
  const byTeacher = new Map(teachers.map((t) => [t.id, []]))
  for (const e of entries) {
    if (!byTeacher.has(e.teacherId)) byTeacher.set(e.teacherId, [])
    byTeacher.get(e.teacherId).push(e)
  }
  return byTeacher
}

function buildClassRoutines(days, classes, entries, unscheduled) {
  const byClass = new Map()
  for (const cls of classes) {
    const sections = cls.sections.length > 0 ? cls.sections : ['']
    for (const section of sections) byClass.set(sectionKeyOf(cls.id, section), [])
  }
  for (const e of entries) {
    const k = sectionKeyOf(e.classId, e.section)
    if (!byClass.has(k)) byClass.set(k, [])
    byClass.get(k).push(e)
  }

  const neededMap = new Map()
  for (const u of unscheduled) {
    const k = sectionKeyOf(u.classId, u.section)
    if (!neededMap.has(k)) neededMap.set(k, new Map())
    const m = neededMap.get(k)
    m.set(u.subject, (m.get(u.subject) || 0) + 1)
  }

  for (const cls of classes) {
    const sections = cls.sections.length > 0 ? cls.sections : ['']
    for (const section of sections) {
      const k = sectionKeyOf(cls.id, section)
      const needed = neededMap.get(k)
      if (!needed) continue

      const list = byClass.get(k) || []
      const occupied = new Set(list.map((e) => `${e.day}::${e.period}`))
      const freeSlots = []
      
      for (const day of days) {
        for (let period = 1; period <= cls.periodsPerDay; period++) {
          const sk = `${day}::${period}`
          if (!occupied.has(sk)) freeSlots.push({ day, period })
        }
      }

      let slotIdx = 0
      for (const [subject, count] of needed.entries()) {
        for (let i = 0; i < count && slotIdx < freeSlots.length; i++, slotIdx++) {
          const slot = freeSlots[slotIdx]
          list.push({
            day: slot.day,
            period: slot.period,
            classId: cls.id,
            className: cls.name,
            section,
            subject,
            teacherId: null,
            teacherName: 'Teacher needed',
            isPlaceholder: true,
          })
          occupied.add(`${slot.day}::${slot.period}`)
        }
      }
      byClass.set(k, list)
    }
  }

  return byClass
}

// ---------------------------------------------------------------------------
// Week / holiday configuration (Bangladesh Format)
// ---------------------------------------------------------------------------
const ALL_DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

const WEEK_TYPE_OPTIONS = [
  { label: '5-Day Week (Sun – Thu)', value: '5' },
  { label: '6-Day Week (Sat – Thu)', value: '6' },
  { label: '7-Day Week (Sat – Fri)', value: '7' },
]

const WEEK_TYPE_DAYS = {
  '5': ALL_DAYS.slice(1, 6), // Sunday - Thursday
  '6': ALL_DAYS.slice(0, 6), // Saturday - Thursday
  '7': ALL_DAYS.slice(0, 7), // Saturday - Friday
}

// ---------------------------------------------------------------------------
// UI component
// ---------------------------------------------------------------------------
const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)

export default function RoutineBuilderClient() {
  const [activeTab, setActiveTab] = useState('setup')

  const [weekType, setWeekType] = useState('7')
  // Default to Friday as holiday in BD format
  const [holidays, setHolidays] = useState(['Friday'])
  
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([]) 
  const [requirements, setRequirements] = useState([]) 
  const [teachers, setTeachers] = useState([]) 
  const [qualifications, setQualifications] = useState([]) 
  const [preferredAssignments, setPreferredAssignments] = useState([])

  const [result, setResult] = useState(null)

  const weekDays = WEEK_TYPE_DAYS[weekType]
  const days = useMemo(() => weekDays.filter((d) => !holidays.includes(d)), [weekDays, holidays])
  
  const maxClassPeriods = useMemo(() => classes.length > 0 ? Math.max(...classes.map(c => c.periodsPerDay)) : 6, [classes])

  // Compute subject-wise and global deficits
  const deficits = useMemo(
    () => calculateDeficits(days, classes, subjects, requirements, teachers, qualifications, maxClassPeriods),
    [days, classes, subjects, requirements, teachers, qualifications, maxClassPeriods]
  )

  const warnings = useMemo(
    () => analyzeSetup(days, classes, subjects, requirements, teachers, qualifications, deficits),
    [days, classes, subjects, requirements, teachers, qualifications, deficits]
  )

  function handleGenerate() {
    const r = generateRoutine(days, classes, subjects, requirements, teachers, qualifications, preferredAssignments, maxClassPeriods)
    setResult(r)
    setActiveTab('view')
  }

  return (
    <main className="min-h-screen bg-stone-50 p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 print:hidden">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-stone-900 uppercase tracking-wide">Routine Builder</h1>
            <p className="text-sm font-medium text-stone-600 mt-1">Set up your school week, subjects, classes, and teachers, then generate the timetable.</p>
          </div>
        </div>
        
        <div className="space-y-6 font-sans text-stone-900">
          <div className="flex gap-2 border-b border-stone-200 print:hidden">
            {[
              { id: 'setup', label: 'Setup (Manual Entry)' },
              { id: 'view', label: 'Generate & View Routines' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 -mb-px ${
                  activeTab === tab.id ? 'text-[#6b4c9a] border-[#6b4c9a]' : 'text-stone-500 border-transparent hover:text-stone-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'setup' && (
            <SetupTab
              weekType={weekType} setWeekType={setWeekType}
              weekDays={weekDays} holidays={holidays} setHolidays={setHolidays} days={days}
              classes={classes} setClasses={setClasses} maxClassPeriods={maxClassPeriods}
              subjects={subjects} setSubjects={setSubjects}
              requirements={requirements} setRequirements={setRequirements}
              teachers={teachers} setTeachers={setTeachers}
              qualifications={qualifications} setQualifications={setQualifications}
              preferredAssignments={preferredAssignments} setPreferredAssignments={setPreferredAssignments}
              warnings={warnings}
              deficits={deficits}
              onGenerate={handleGenerate}
            />
          )}

          {activeTab === 'view' && (
            <ViewTab days={days} classes={classes} teachers={teachers} result={result} onGenerate={handleGenerate} maxClassPeriods={maxClassPeriods} />
          )}
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { margin: 1cm; size: landscape; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white; }
          .print\\:hidden { display: none !important; }
          .break-inside-avoid { break-inside: avoid; }
        }
      `}} />
    </main>
  )
}

// ---------------------------------------------------------------------------
// SETUP TAB
// ---------------------------------------------------------------------------
function SetupTab({
  weekType, setWeekType, weekDays, holidays, setHolidays, days,
  classes, setClasses, maxClassPeriods,
  subjects, setSubjects,
  requirements, setRequirements,
  teachers, setTeachers,
  qualifications, setQualifications,
  preferredAssignments, setPreferredAssignments,
  warnings, deficits, onGenerate,
}) {
  return (
    <div className="space-y-10">
      <WeekAndHolidays weekType={weekType} setWeekType={setWeekType} weekDays={weekDays} holidays={holidays} setHolidays={setHolidays} days={days} />
      
      <ClassesSection classes={classes} setClasses={setClasses} days={days} requirements={requirements} setRequirements={setRequirements} preferredAssignments={preferredAssignments} setPreferredAssignments={setPreferredAssignments} />
      
      <SubjectsSection subjects={subjects} setSubjects={setSubjects} requirements={requirements} setRequirements={setRequirements} qualifications={qualifications} setQualifications={setQualifications} preferredAssignments={preferredAssignments} setPreferredAssignments={setPreferredAssignments} />
      
      <ClassCurriculumMatrix classes={classes} subjects={subjects} requirements={requirements} setRequirements={setRequirements} days={days} />
      
      <TeachersSection teachers={teachers} setTeachers={setTeachers} maxClassPeriods={maxClassPeriods} qualifications={qualifications} setQualifications={setQualifications} preferredAssignments={preferredAssignments} setPreferredAssignments={setPreferredAssignments} />
      
      <TeacherSubjectCheckmarks teachers={teachers} subjects={subjects} qualifications={qualifications} setQualifications={setQualifications} />
      
      <TeacherCapacityDashboard days={days} maxClassPeriods={maxClassPeriods} deficits={deficits} />

      <PreferredTeacherSection classes={classes} subjects={subjects} requirements={requirements} teachers={teachers} qualifications={qualifications} preferredAssignments={preferredAssignments} setPreferredAssignments={setPreferredAssignments} />

      <section className="bg-white rounded-sm shadow-sm border border-stone-200 p-6 md:p-8">
        <h2 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide mb-1">Ready to Generate</h2>
        <p className="text-sm font-medium text-stone-600 mb-5">
          Build the weekly routine. Teachers are balanced automatically, and subjects are shuffled to vary the timetable daily.
        </p>

        {warnings.length > 0 ? (
          <div className="mb-6 p-5 bg-[#fbf9fc] border border-[#dad3e3] rounded-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-[#b4483e] mb-2">Review Warnings Before Generating:</p>
            <ul className="text-xs font-medium text-[#b4483e] space-y-1.5 list-disc list-inside">
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        ) : (
          <div className="mb-6 p-5 bg-[#f2f7ee] border border-[#d9e6cd] rounded-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-[#4a6b3a]">Setup looks complete and perfectly balanced.</p>
          </div>
        )}

        <button
          onClick={onGenerate}
          className="w-full sm:w-auto bg-[#6b4c9a] text-white px-8 py-3.5 rounded-sm text-xs uppercase tracking-widest font-bold hover:bg-[#5a3f82] transition-colors shadow-sm"
        >
          Generate Weekly Routine
        </button>
      </section>
    </div>
  )
}

function WeekAndHolidays({ weekType, setWeekType, weekDays, holidays, setHolidays, days }) {
  function toggleHoliday(day) {
    setHolidays(holidays.includes(day) ? holidays.filter((d) => d !== day) : [...holidays, day])
  }

  function handleWeekTypeChange(value) {
    const nextDays = WEEK_TYPE_DAYS[value]
    setHolidays(holidays.filter((d) => nextDays.includes(d)))
    setWeekType(value)
  }

  return (
    <section className="bg-white rounded-sm shadow-sm border border-stone-200 p-6 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5 mb-8">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">1. Week & Holidays</h2>
          <p className="text-sm font-medium text-stone-600 mt-2">Choose your school week, then mark days off (Friday is set by default).</p>
        </div>

        <div className="w-full md:w-72 shrink-0">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">School Week</label>
          <Dropdown
            options={WEEK_TYPE_OPTIONS}
            value={weekType}
            onChange={(v) => handleWeekTypeChange(String(v))}
          />
        </div>
      </div>

      <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-3">Mark Holidays</label>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
        {weekDays.map((day) => (
          <label
            key={day}
            className="group relative flex flex-col items-center justify-center p-5 bg-stone-50 border border-stone-200 rounded-sm cursor-pointer hover:bg-[#fbf9fc] hover:border-[#dad3e3] transition-all has-[:checked]:bg-[#fbf9fc] has-[:checked]:border-[#b4483e] has-[:checked]:shadow-sm"
          >
            <input
              type="checkbox"
              checked={holidays.includes(day)}
              onChange={() => toggleHoliday(day)}
              className="absolute top-3 right-3 w-4 h-4 text-[#b4483e] bg-white border-stone-300 rounded-sm focus:ring-[#b4483e] cursor-pointer accent-[#b4483e]"
            />
            <span className="text-sm font-bold text-stone-800 uppercase tracking-wider mt-2 group-hover:text-[#b4483e]">{day.slice(0, 3)}</span>
            <span className="text-xs font-medium text-stone-500 mt-1">{day}</span>
          </label>
        ))}
      </div>

      <div className="p-5 bg-[#fbf9fc] border border-[#dad3e3] rounded-sm flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm">
        <span className="text-xs font-bold text-[#6b4c9a] uppercase tracking-wider shrink-0">Working Days ({days.length}):</span>
        {days.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {days.map((day) => (
              <span key={day} className="bg-white border border-stone-200 text-stone-800 px-4 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider shadow-sm">
                {day}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-sm font-medium text-stone-500 italic">Every day is a holiday.</span>
        )}
      </div>
    </section>
  )
}

function ClassesSection({ classes, setClasses, days, requirements, setRequirements, preferredAssignments, setPreferredAssignments }) {
  const PREDEFINED = ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5'];
  const [globalPeriods, setGlobalPeriods] = useState('6')
  const [customName, setCustomName] = useState('')
  const [sectionInput, setSectionInput] = useState({})

  function handleGlobalPeriodsChange(val) {
    setGlobalPeriods(val)
    const num = Number(val) || 6
    setClasses(classes.map(c => ({ ...c, periodsPerDay: num })))
  }

  function handleClassPeriodChange(classId, val) {
    const num = Number(val) || 1
    setClasses(classes.map(c => c.id === classId ? { ...c, periodsPerDay: num } : c))
  }

  function toggleClass(name) {
    const exists = classes.find(c => c.name === name)
    if (exists) {
      removeClass(exists.id)
    } else {
      setClasses([...classes, { id: uid(), name, periodsPerDay: Number(globalPeriods) || 6, sections: [] }])
    }
  }

  function addCustomClass() {
    if (!customName.trim()) return
    if (classes.some(c => c.name.toLowerCase() === customName.trim().toLowerCase())) return
    setClasses([...classes, { id: uid(), name: customName.trim(), periodsPerDay: Number(globalPeriods) || 6, sections: [] }])
    setCustomName('')
  }

  function removeClass(id) {
    setClasses(classes.filter((c) => c.id !== id))
    setRequirements(requirements.filter((r) => r.classId !== id))
    setPreferredAssignments(preferredAssignments.filter((p) => p.classId !== id))
  }

  function addSection(classId) {
    const section = (sectionInput[classId] || '').trim()
    if (!section) return
    setClasses(classes.map((c) => (c.id === classId ? { ...c, sections: [...c.sections, section] } : c)))
    setSectionInput({ ...sectionInput, [classId]: '' })
  }

  function removeSection(classId, section) {
    setClasses(classes.map((c) => (c.id === classId ? { ...c, sections: c.sections.filter((s) => s !== section) } : c)))
    setRequirements(requirements.filter((r) => !(r.classId === classId && r.section === section)))
    setPreferredAssignments(preferredAssignments.filter((p) => !(p.classId === classId && p.section === section)))
  }

  return (
    <section className="bg-white rounded-sm shadow-sm border border-stone-200 p-6 md:p-8">
      <h2 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">2. Class Creator</h2>
      <p className="text-sm font-medium text-stone-600 mt-2 mb-6">Select classes and set periods per day.</p>

      <div className="bg-[#fbf9fc] p-6 rounded-sm border border-[#dad3e3] mb-8 shadow-sm">
        <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-3">Global Periods per Day</label>
        <input
          type="number"
          min="1"
          value={globalPeriods}
          onChange={(e) => handleGlobalPeriodsChange(e.target.value)}
          className="w-full max-w-xs p-3.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all"
        />
      </div>

      <div className="mb-8">
        <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-3">Select Classes</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {PREDEFINED.map((name) => {
            const isSelected = classes.some(c => c.name === name)
            return (
              <label
                key={name}
                className="group relative flex items-center justify-center p-4 bg-stone-50 border border-stone-200 rounded-sm cursor-pointer hover:bg-[#fbf9fc] hover:border-[#dad3e3] transition-all has-[:checked]:bg-[#fbf9fc] has-[:checked]:border-[#6b4c9a] has-[:checked]:shadow-sm"
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleClass(name)}
                  className="absolute top-2 left-2 w-4 h-4 text-[#6b4c9a] bg-white border-stone-300 rounded-sm focus:ring-[#6b4c9a] cursor-pointer accent-[#6b4c9a]"
                />
                <span className="text-sm font-bold text-stone-800 uppercase tracking-wider group-hover:text-[#6b4c9a] ml-4">{name}</span>
              </label>
            )
          })}
        </div>
      </div>

      <div className="flex gap-3 mb-8">
        <input
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomClass() } }}
          placeholder="Custom Class Name..."
          className="flex-1 max-w-sm p-3.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all"
        />
        <button onClick={addCustomClass} className="bg-white border border-stone-300 text-stone-800 px-6 py-3.5 rounded-sm text-xs uppercase tracking-widest font-bold hover:text-[#6b4c9a] hover:border-[#6b4c9a] transition-colors shadow-sm shrink-0">
          + Add Custom
        </button>
      </div>

      {classes.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-stone-200">
                <th className="py-3 px-2 text-xs font-bold uppercase tracking-wider text-stone-500">Class Name</th>
                <th className="py-3 px-2 text-xs font-bold uppercase tracking-wider text-stone-500">Periods / Day</th>
                <th className="py-3 px-2 text-xs font-bold uppercase tracking-wider text-stone-500">Total Weekly Periods</th>
                <th className="py-3 px-2 text-xs font-bold uppercase tracking-wider text-stone-500">Sections (Optional)</th>
                <th className="py-3 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => {
                const totalWeekly = c.periodsPerDay * days.length
                return (
                  <tr key={c.id} className="border-b border-stone-100 last:border-0 align-top">
                    <td className="py-4 px-2 font-bold text-stone-800">{c.name}</td>
                    <td className="py-4 px-2">
                      <input
                        type="number"
                        min="1"
                        value={c.periodsPerDay}
                        onChange={(e) => handleClassPeriodChange(c.id, e.target.value)}
                        className="w-20 p-2 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 focus:outline-none focus:border-[#6b4c9a] transition-all"
                      />
                    </td>
                    <td className="py-4 px-2">
                      <span className="inline-block bg-[#fbf9fc] text-[#6b4c9a] font-bold border border-[#dad3e3] px-3 py-1.5 rounded-sm shadow-sm text-xs tracking-wider">
                        {totalWeekly}
                      </span>
                    </td>
                    <td className="py-4 px-2 space-y-2">
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {c.sections.map((s) => (
                          <span key={s} className="inline-flex items-center gap-1.5 bg-stone-100 text-stone-800 text-xs font-semibold px-2 py-1 rounded-sm border border-stone-200">
                            {s}
                            <button onClick={() => removeSection(c.id, s)} className="text-stone-400 hover:text-[#b4483e] transition-colors"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          value={sectionInput[c.id] || ''}
                          onChange={(e) => setSectionInput({ ...sectionInput, [c.id]: e.target.value })}
                          placeholder="e.g. A"
                          className="w-24 p-2 border border-stone-300 rounded-sm text-xs font-medium focus:outline-none focus:border-[#6b4c9a] transition-all"
                        />
                        <button onClick={() => addSection(c.id)} className="bg-white border border-stone-300 text-stone-600 px-3 py-2 rounded-sm text-[10px] uppercase font-bold hover:text-[#6b4c9a] transition-colors">Add</button>
                      </div>
                    </td>
                    <td className="py-4 px-2 text-right">
                      <button onClick={() => removeClass(c.id)} className="text-xs font-bold uppercase tracking-wider text-[#b4483e] hover:underline">Remove</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function SubjectsSection({ subjects, setSubjects, requirements, setRequirements, qualifications, setQualifications, preferredAssignments, setPreferredAssignments }) {
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')

  function addSubject() {
    if (!name.trim()) return
    if (subjects.some((s) => s.name.toLowerCase() === name.trim().toLowerCase())) {
      alert('A subject with this name already exists.')
      return
    }
    setSubjects([...subjects, { id: uid(), name: name.trim() }])
    setName('')
  }

  function startEdit(s) {
    setEditingId(s.id)
    setEditName(s.name)
  }

  function saveEdit() {
    if (!editName.trim()) return
    if (subjects.some((s) => s.id !== editingId && s.name.toLowerCase() === editName.trim().toLowerCase())) {
      alert('A subject with this name already exists.')
      return
    }
    setSubjects(subjects.map(s => s.id === editingId ? { ...s, name: editName.trim() } : s))
    setEditingId(null)
  }

  function removeSubject(id) {
    setSubjects(subjects.filter((s) => s.id !== id))
    setRequirements(requirements.filter((r) => r.subjectId !== id))
    setQualifications(qualifications.filter((q) => q.subjectId !== id))
    setPreferredAssignments(preferredAssignments.filter((p) => p.subjectId !== id))
  }

  return (
    <section className="bg-white rounded-sm shadow-sm border border-stone-200 p-6 md:p-8">
      <h2 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">3. Subjects</h2>
      <div className="flex gap-3 mt-4 mb-6">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubject() } }}
          placeholder="e.g. Mathematics"
          className="flex-1 max-w-sm p-3.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all"
        />
        <button onClick={addSubject} className="bg-[#6b4c9a] text-white px-6 py-3.5 rounded-sm text-xs uppercase tracking-widest font-bold hover:bg-[#5a3f82] transition-colors shadow-sm shrink-0">
          + Add Subject
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        {subjects.map((s) => {
          if (editingId === s.id) {
            return (
              <div key={s.id} className="flex items-center gap-2 bg-stone-50 border border-stone-300 p-1.5 rounded-sm">
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveEdit() }}
                  className="p-1 border border-stone-300 rounded-sm text-xs font-semibold w-32 focus:outline-none focus:border-[#6b4c9a]"
                />
                <button onClick={saveEdit} className="text-[10px] uppercase font-bold text-[#4a6b3a] hover:underline px-1">Save</button>
                <button onClick={() => setEditingId(null)} className="text-[10px] uppercase font-bold text-stone-500 hover:underline px-1">Cancel</button>
              </div>
            )
          }
          return (
            <div key={s.id} className="group flex items-center gap-2 bg-white text-stone-800 border border-stone-300 text-xs font-semibold px-3 py-2 rounded-sm tracking-wide">
              <span>{s.name}</span>
              <div className="hidden group-hover:flex items-center gap-1.5 ml-2 border-l border-stone-200 pl-2">
                <button onClick={() => startEdit(s)} className="text-stone-400 hover:text-[#6b4c9a] transition-colors" title="Edit">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                </button>
                <button onClick={() => removeSubject(s.id)} className="text-stone-400 hover:text-[#b4483e] transition-colors" title="Remove">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
            </div>
          )
        })}
        {subjects.length === 0 && <p className="text-sm font-medium text-stone-400 italic">No subjects created yet.</p>}
      </div>
    </section>
  )
}

function ClassCurriculumMatrix({ classes, subjects, requirements, setRequirements, days }) {
  const columns = useMemo(() => {
    return classes.flatMap(c => 
      c.sections.length > 0 
        ? c.sections.map(s => ({ classId: c.id, section: s, name: `${c.name} ${s}`, limit: c.periodsPerDay * days.length }))
        : [{ classId: c.id, section: '', name: c.name, limit: c.periodsPerDay * days.length }]
    )
  }, [classes, days.length])

  function toggleRequirement(classId, section, subjectId, checked) {
    if (checked) {
      setRequirements([...requirements, { id: uid(), classId, section, subjectId, periodsPerWeek: 1 }])
    } else {
      setRequirements(requirements.filter(r => !(r.classId === classId && (r.section || '') === section && r.subjectId === subjectId)))
    }
  }

  function updateRequirementPeriods(classId, section, subjectId, periods) {
    let num = Number(periods)
    if (num > days.length) num = days.length // Strictly capped to prevent duplicate subject in same day
    
    setRequirements(requirements.map(r => 
      (r.classId === classId && (r.section || '') === section && r.subjectId === subjectId)
        ? { ...r, periodsPerWeek: num }
        : r
    ))
  }

  return (
    <section className="bg-white rounded-sm shadow-sm border border-stone-200 p-6 md:p-8">
      <h2 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">4. Class Curriculum Matrix</h2>
      <p className="text-sm font-medium text-stone-600 mt-2 mb-6">
        Set subjects and periods per week. 
        <strong className="text-[#b4483e] ml-1">Sum must exactly match the limits shown to avoid empty Free Periods. Max {days.length} periods/wk per subject.</strong>
      </p>

      {columns.length === 0 || subjects.length === 0 ? (
        <div className="p-6 rounded-sm border border-dashed border-stone-300 bg-stone-50 text-center text-sm font-medium text-stone-500">
          Create classes and subjects above to build the curriculum matrix.
        </div>
      ) : (
        <div className="overflow-x-auto border border-stone-200 rounded-sm">
          <table className="w-full text-sm border-collapse min-w-max bg-white">
            <thead className="bg-stone-50 border-b border-stone-200 sticky top-0 z-10">
              <tr>
                <th className="py-4 px-4 text-left text-xs font-bold uppercase tracking-wider text-stone-500 border-r border-stone-200">
                  Subjects
                </th>
                {columns.map(col => {
                  const currentSum = requirements
                    .filter(r => r.classId === col.classId && (r.section || '') === col.section)
                    .reduce((sum, r) => sum + (r.periodsPerWeek || 0), 0)
                  
                  const isPerfect = currentSum === col.limit

                  return (
                    <th key={`${col.classId}-${col.section}`} className="py-3 px-4 text-center border-r border-stone-200 last:border-0 min-w-[140px]">
                      <div className="font-bold text-stone-800 text-sm mb-1">{col.name}</div>
                      <div className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-sm border inline-block ${isPerfect ? 'bg-[#f2f7ee] text-[#4a6b3a] border-[#d9e6cd]' : 'bg-[#fcf2f1] text-[#b4483e] border-[#f2d5d2]'}`}>
                        {currentSum} / {col.limit} slots
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {subjects.map((subj) => (
                <tr key={subj.id} className="border-b border-stone-100 hover:bg-stone-50/50 transition-colors">
                  <td className="py-3 px-4 font-semibold text-stone-800 border-r border-stone-200 sticky left-0 bg-white">
                    {subj.name}
                  </td>
                  {columns.map(col => {
                    const req = requirements.find(r => r.classId === col.classId && (r.section || '') === col.section && r.subjectId === subj.id)
                    const isChecked = !!req

                    return (
                      <td key={`${col.classId}-${col.section}`} className="py-3 px-4 text-center border-r border-stone-200 last:border-0 align-middle">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => toggleRequirement(col.classId, col.section, subj.id, e.target.checked)}
                            className="w-4 h-4 text-[#6b4c9a] bg-white border-stone-300 rounded-sm focus:ring-[#6b4c9a] cursor-pointer accent-[#6b4c9a]"
                          />
                          {isChecked && (
                            <input
                              type="number"
                              min="1"
                              max={days.length}
                              value={req.periodsPerWeek}
                              onChange={(e) => updateRequirementPeriods(col.classId, col.section, subj.id, e.target.value)}
                              className="w-16 p-1 text-center border border-stone-300 rounded-sm text-xs font-medium focus:outline-none focus:border-[#6b4c9a]"
                              title={`Max ${days.length} periods per week`}
                            />
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function TeachersSection({ teachers, setTeachers, maxClassPeriods, qualifications, setQualifications, preferredAssignments, setPreferredAssignments }) {
  const [name, setName] = useState('')
  const [maxPeriodsPerDay, setMaxPeriodsPerDay] = useState('')
  
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editPeriods, setEditPeriods] = useState('')

  function addTeacher() {
    const p = Number(maxPeriodsPerDay)
    if (!name.trim() || !p || p <= 0) return
    
    if (teachers.some(t => t.name.toLowerCase() === name.trim().toLowerCase())) {
      alert('A teacher with this name already exists.')
      return
    }

    if (p > maxClassPeriods) {
      alert(`A teacher cannot take more than ${maxClassPeriods} periods per day based on current max class setups.`)
      return
    }
    setTeachers([...teachers, { id: uid(), name: name.trim(), maxPeriodsPerDay: p }])
    setName('')
    setMaxPeriodsPerDay('')
  }

  function startEdit(t) {
    setEditingId(t.id)
    setEditName(t.name)
    setEditPeriods(String(Math.min(t.maxPeriodsPerDay, maxClassPeriods)))
  }

  function saveEdit() {
    const p = Number(editPeriods)
    if (!editName.trim() || !p || p <= 0) return

    if (teachers.some((t) => t.id !== editingId && t.name.toLowerCase() === editName.trim().toLowerCase())) {
      alert('A teacher with this name already exists.')
      return
    }

    if (p > maxClassPeriods) {
      alert(`Cannot exceed max class periods (${maxClassPeriods})`)
      return
    }

    setTeachers(teachers.map(t => t.id === editingId ? { ...t, name: editName.trim(), maxPeriodsPerDay: p } : t))
    setEditingId(null)
  }

  function removeTeacher(id) {
    setTeachers(teachers.filter((t) => t.id !== id))
    setQualifications(qualifications.filter((q) => q.teacherId !== id))
    setPreferredAssignments(preferredAssignments.filter((p) => p.teacherId !== id))
  }

  return (
    <section className="bg-white rounded-sm shadow-sm border border-stone-200 p-6 md:p-8">
      <h2 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">5. Teachers</h2>
      <p className="text-sm font-medium text-stone-600 mt-2 mb-6">Max periods per day cannot exceed the max periods of your longest class (<strong className="text-stone-800">{maxClassPeriods}</strong>).</p>

      <div className="bg-[#fbf9fc] p-6 rounded-sm border border-[#dad3e3] mb-8 grid grid-cols-1 lg:grid-cols-12 gap-5 items-end shadow-sm">
        <div className="lg:col-span-6">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">Teacher Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="w-full p-3.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all" />
        </div>
        <div className="lg:col-span-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">Max Periods/Day</label>
          <input type="number" min="1" max={maxClassPeriods} value={maxPeriodsPerDay} onChange={(e) => setMaxPeriodsPerDay(e.target.value)} placeholder={`Max ${maxClassPeriods}`} className="w-full p-3.5 bg-white border border-stone-300 rounded-sm text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all" />
        </div>
        <div className="lg:col-span-3">
          <button onClick={addTeacher} className="w-full bg-[#6b4c9a] text-white px-5 py-3.5 rounded-sm text-xs uppercase tracking-widest font-bold hover:bg-[#5a3f82] transition-colors shadow-sm">+ Add Teacher</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {teachers.map((t) => {
          if (editingId === t.id) {
            return (
              <div key={t.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 bg-stone-50 border border-stone-300 p-2 rounded-sm w-full max-w-lg">
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Name"
                  className="flex-1 p-1.5 border border-stone-300 rounded-sm text-xs font-semibold focus:outline-none focus:border-[#6b4c9a]"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-500">Max</span>
                  <input
                    type="number"
                    min="1"
                    max={maxClassPeriods}
                    value={editPeriods}
                    onChange={(e) => setEditPeriods(e.target.value)}
                    className="w-16 p-1.5 border border-stone-300 rounded-sm text-xs font-semibold text-center focus:outline-none focus:border-[#6b4c9a]"
                  />
                  <span className="text-xs text-stone-500">/day</span>
                </div>
                <div className="flex items-center gap-2 mt-2 sm:mt-0">
                  <button onClick={saveEdit} className="text-[10px] bg-[#6b4c9a] text-white uppercase font-bold px-3 py-1.5 rounded-sm hover:bg-[#5a3f82]">Save</button>
                  <button onClick={() => setEditingId(null)} className="text-[10px] border border-stone-300 text-stone-600 uppercase font-bold px-3 py-1.5 rounded-sm hover:bg-stone-100">Cancel</button>
                </div>
              </div>
            )
          }

          const effectiveMax = Math.min(t.maxPeriodsPerDay, maxClassPeriods)

          return (
            <div key={t.id} className="group flex items-center gap-2 bg-white text-stone-800 border border-stone-300 text-xs font-semibold px-3 py-2 rounded-sm tracking-wide">
              <span>{t.name}</span>
              <span className={`font-medium ml-1 ${effectiveMax < t.maxPeriodsPerDay ? 'text-[#b4483e] font-bold' : 'text-stone-400'}`}>
                · max {effectiveMax}/day
              </span>
              <div className="hidden group-hover:flex items-center gap-1.5 ml-2 border-l border-stone-200 pl-2">
                <button onClick={() => startEdit(t)} className="text-stone-400 hover:text-[#6b4c9a] transition-colors" title="Edit">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                </button>
                <button onClick={() => removeTeacher(t.id)} className="text-stone-400 hover:text-[#b4483e] transition-colors" title="Remove">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
            </div>
          )
        })}
        {teachers.length === 0 && <p className="text-sm font-medium text-stone-400 italic">No teachers added yet.</p>}
      </div>
    </section>
  )
}

function TeacherSubjectCheckmarks({ teachers, subjects, qualifications, setQualifications }) {
  function toggleQual(teacherId, subjectId) {
    const exists = qualifications.find(q => q.teacherId === teacherId && q.subjectId === subjectId)
    if (exists) {
      setQualifications(qualifications.filter(q => q.id !== exists.id))
    } else {
      setQualifications([...qualifications, { id: uid(), teacherId, subjectId }])
    }
  }

  return (
    <section className="bg-white rounded-sm shadow-sm border border-stone-200 p-6 md:p-8">
      <h2 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">6. Qualifications</h2>
      <p className="text-sm font-medium text-stone-600 mt-2 mb-6">Mark which subjects each teacher is qualified to teach.</p>

      {teachers.length === 0 || subjects.length === 0 ? (
        <div className="p-6 rounded-sm border border-dashed border-stone-300 bg-stone-50 text-center text-sm font-medium text-stone-500">
          Add teachers and subjects above.
        </div>
      ) : (
        <div className="space-y-6">
          {teachers.map(t => (
            <div key={t.id} className="border border-stone-200 rounded-sm p-5 hover:border-[#dad3e3] transition-colors bg-stone-50/30">
              <h3 className="font-bold text-stone-800 uppercase tracking-wider mb-4 border-b border-stone-200 pb-2">{t.name}</h3>
              <div className="flex flex-wrap gap-4">
                {subjects.map(s => {
                  const isQual = qualifications.some(q => q.teacherId === t.id && q.subjectId === s.id)
                  return (
                    <label key={s.id} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={isQual}
                        onChange={() => toggleQual(t.id, s.id)}
                        className="w-4 h-4 text-[#6b4c9a] bg-white border-stone-300 rounded-sm focus:ring-[#6b4c9a] cursor-pointer accent-[#6b4c9a]"
                      />
                      <span className={`text-sm font-medium select-none transition-colors ${isQual ? 'text-stone-900 font-bold' : 'text-stone-600 group-hover:text-stone-900'}`}>
                        {s.name}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function TeacherCapacityDashboard({ maxClassPeriods, deficits }) {
  const [calcPeriodsPerDay, setCalcPeriodsPerDay] = useState('')

  const { totalReq, totalCap, overallDeficit, subjectStats, unassignedCurriculum } = deficits

  const val = Number(calcPeriodsPerDay)
  const effectiveCalcPeriods = val > 0 ? Math.min(val, maxClassPeriods) : 0
  const totalNewTeachersNeeded = effectiveCalcPeriods > 0 
    ? Math.ceil(overallDeficit / (effectiveCalcPeriods * 5)) 
    : '—'

  return (
    <section className="bg-white rounded-sm shadow-sm border border-stone-200 p-6 md:p-8">
      <h2 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide border-b border-stone-200 pb-4 mb-6">7. Teacher Requirements & Deficits</h2>
      
      {unassignedCurriculum > 0 && (
        <div className="mb-6 p-4 bg-[#fcf2f1] border border-[#f2d5d2] rounded-sm">
          <p className="text-sm font-bold text-[#b4483e]">Incomplete Curriculum Matrix!</p>
          <p className="text-xs font-medium text-[#b4483e] mt-1">You have {unassignedCurriculum} class periods without any assigned subject in the matrix. Complete Section 4 so all classes have full schedules.</p>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-stone-50 p-5 rounded-sm border border-stone-200 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">Total Curriculum Required</p>
          <p className="text-3xl font-bold text-stone-900">{totalReq} <span className="text-sm font-medium text-stone-500">periods/wk</span></p>
        </div>
        <div className="bg-stone-50 p-5 rounded-sm border border-stone-200 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">Total Teacher Capacity</p>
          <p className="text-3xl font-bold text-[#4a6b3a]">{totalCap} <span className="text-sm font-medium text-stone-500">periods/wk</span></p>
        </div>
        <div className={`${overallDeficit > 0 ? 'bg-[#fcf2f1] border-[#f2d5d2]' : 'bg-[#f2f7ee] border-[#d9e6cd]'} p-5 rounded-sm border text-center`}>
          <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${overallDeficit > 0 ? 'text-[#b4483e]' : 'text-[#4a6b3a]'}`}>Overall Deficit</p>
          <p className={`text-3xl font-bold ${overallDeficit > 0 ? 'text-[#b4483e]' : 'text-[#4a6b3a]'}`}>{overallDeficit}</p>
        </div>
      </div>

      {/* Detailed Subject-wise Requirements & Teacher Capacity Table */}
      <div className="bg-white border border-stone-200 rounded-sm mb-8 overflow-hidden">
        <div className="bg-stone-50 px-5 py-3 border-b border-stone-200 flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800">Subject-wise Requirements & Qualified Capacity</h3>
          <span className="text-[11px] font-semibold text-stone-500">All subjects breakdown</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="border-b border-stone-200 bg-stone-50/50">
              <tr>
                <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-stone-500">Subject</th>
                <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-stone-500">Needed / Week</th>
                <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-stone-500">Qualified Teachers</th>
                <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-stone-500">Qualified Capacity</th>
                <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-stone-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {subjectStats.map(s => {
                const hasDeficit = s.deficit > 0 && s.req > 0
                const isNoTeacher = s.qualifiedTeachers.length === 0 && s.req > 0

                return (
                  <tr key={s.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-stone-800">{s.name}</td>
                    <td className="py-3 px-4 font-bold text-stone-900">{s.req} periods</td>
                    <td className="py-3 px-4">
                      {s.qualifiedTeachers.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {s.qualifiedTeachers.map(t => (
                            <span key={t.id} className="inline-block bg-stone-100 border border-stone-200 text-stone-700 text-[11px] px-2 py-0.5 rounded-sm">
                              {t.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-[#b4483e] italic">No teacher assigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-medium text-stone-700">
                      {s.rawCapacity} periods/wk
                    </td>
                    <td className="py-3 px-4">
                      {isNoTeacher ? (
                        <span className="inline-block bg-[#fcf2f1] text-[#b4483e] border border-[#f2d5d2] text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-sm">
                          Teacher Needed
                        </span>
                      ) : hasDeficit ? (
                        <span className="inline-block bg-[#fdf6ec] text-[#9a6a1f] border border-[#f0dfc0] text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-sm">
                          Short by {s.deficit}
                        </span>
                      ) : (
                        <span className="inline-block bg-[#f2f7ee] text-[#4a6b3a] border border-[#d9e6cd] text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-sm">
                          Sufficient {s.balance > 0 && `(+${s.balance})`}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {subjectStats.length === 0 && (
                <tr><td colSpan={5} className="py-5 text-center text-stone-400 italic">No subjects added yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Teacher Calculator */}
      <div className="bg-[#fbf9fc] p-6 rounded-sm border border-[#dad3e3] shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#6b4c9a] mb-4">Teacher Needed Calculator</h3>
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="shrink-0">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">If a new teacher works:</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max={maxClassPeriods}
                value={calcPeriodsPerDay}
                onChange={(e) => setCalcPeriodsPerDay(e.target.value)}
                placeholder={`1 to ${maxClassPeriods}`}
                className="w-24 p-2.5 bg-white border border-stone-300 rounded-sm text-sm font-medium focus:outline-none focus:border-[#6b4c9a]"
              />
              <span className="text-sm font-semibold text-stone-600">periods/day (Max {maxClassPeriods})</span>
            </div>
          </div>
          
          <div className="hidden sm:block w-px h-12 bg-[#dad3e3]"></div>

          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">Estimated Teachers Needed:</p>
            <p className="text-xl font-bold text-[#6b4c9a]">
              {totalNewTeachersNeeded} additional teacher(s) 
              <span className="text-sm font-medium text-stone-500 ml-2">to satisfy overall school demand.</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function PreferredTeacherSection({ classes, subjects, requirements, teachers, qualifications, preferredAssignments, setPreferredAssignments }) {
  const [isOpen, setIsOpen] = useState(false)
  const [classId, setClassId] = useState('')
  const [section, setSection] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [teacherId, setTeacherId] = useState('')

  const selectedClass = classes.find((c) => c.id === classId)
  const sectionOptions = selectedClass?.sections || []

  const curriculumSubjectIds = useMemo(
    () => [...new Set(requirements.filter((r) => r.classId === classId && (r.section || '') === (sectionOptions.length > 0 ? section : '')).map((r) => r.subjectId))],
    [requirements, classId, section, sectionOptions.length]
  )
  const subjectOptions = subjects.filter((s) => curriculumSubjectIds.includes(s.id))

  const qualifiedTeacherIds = qualifications.filter((q) => q.subjectId === subjectId).map((q) => q.teacherId)
  const teacherOptions = teachers.filter((t) => qualifiedTeacherIds.includes(t.id))

  function addPreferred() {
    if (!classId || !subjectId || !teacherId) return
    const finalSection = sectionOptions.length > 0 ? section : ''
    const withoutExisting = preferredAssignments.filter(
      (p) => !(p.classId === classId && (p.section || '') === finalSection && p.subjectId === subjectId)
    )
    setPreferredAssignments([...withoutExisting, { id: uid(), teacherId, classId, section: finalSection, subjectId }])
    setTeacherId('')
  }

  function removePreferred(id) {
    setPreferredAssignments(preferredAssignments.filter((p) => p.id !== id))
  }

  return (
    <section className="bg-white rounded-sm shadow-sm border border-stone-200 overflow-hidden transition-all">
      <div 
        onClick={() => setIsOpen(!isOpen)} 
        className="p-6 md:p-8 cursor-pointer flex justify-between items-center bg-stone-50 hover:bg-stone-100 transition-colors select-none"
      >
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">8. Preferred Teacher per Class</h2>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#6b4c9a] bg-[#fbf9fc] border border-[#dad3e3] px-2.5 py-1 rounded-sm">Optional</span>
          </div>
          <p className="text-sm font-medium text-stone-600 mt-1">
            Override auto-assignment to pin a specific teacher to a class's subject.
          </p>
        </div>
        <div className={`transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
          <svg className="w-6 h-6 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </div>
      </div>

      <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="p-6 md:p-8 border-t border-stone-200">
            <div className="bg-[#fbf9fc] p-6 rounded-sm border border-[#dad3e3] mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5 items-end shadow-sm">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">Class</label>
                <Dropdown
                  options={classes.map((c) => ({ label: c.name, value: c.id }))}
                  value={classId || null}
                  onChange={(v) => { setClassId(String(v)); setSection(''); setSubjectId(''); setTeacherId('') }}
                  placeholder="Select class"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">Section</label>
                {sectionOptions.length > 0 ? (
                  <Dropdown
                    options={sectionOptions.map((s) => ({ label: s, value: s }))}
                    value={section || null}
                    onChange={(v) => { setSection(String(v)); setSubjectId(''); setTeacherId('') }}
                    placeholder="Select section"
                  />
                ) : (
                  <div className="p-3.5 text-xs font-medium text-stone-400 italic">No sections</div>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">Subject</label>
                {subjectOptions.length > 0 ? (
                  <Dropdown
                    options={subjectOptions.map((s) => ({ label: s.name, value: s.id }))}
                    value={subjectId || null}
                    onChange={(v) => { setSubjectId(String(v)); setTeacherId('') }}
                    placeholder="Select subject"
                  />
                ) : (
                  <div className="p-3.5 text-xs font-medium text-stone-400 italic">Assign curriculum first</div>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">Teacher</label>
                {teacherOptions.length > 0 ? (
                  <Dropdown
                    options={teacherOptions.map((t) => ({ label: t.name, value: t.id }))}
                    value={teacherId || null}
                    onChange={(v) => setTeacherId(String(v))}
                    placeholder="Select teacher"
                    hasSearch
                  />
                ) : (
                  <div className="p-3.5 text-xs font-medium text-stone-400 italic">No qualified teacher yet</div>
                )}
              </div>
              <button onClick={addPreferred} className="bg-[#6b4c9a] text-white px-5 py-3.5 rounded-sm text-xs uppercase tracking-widest font-bold hover:bg-[#5a3f82] transition-colors shadow-sm">
                + Pin
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-stone-200">
                    <th className="py-2 text-xs font-bold uppercase tracking-wider text-stone-500">Class</th>
                    <th className="py-2 text-xs font-bold uppercase tracking-wider text-stone-500">Subject</th>
                    <th className="py-2 text-xs font-bold uppercase tracking-wider text-stone-500">Teacher</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {preferredAssignments.map((p) => {
                    const c = classes.find((x) => x.id === p.classId)
                    const s = subjects.find((x) => x.id === p.subjectId)
                    const t = teachers.find((x) => x.id === p.teacherId)
                    return (
                      <tr key={p.id} className="border-b border-stone-100 last:border-0">
                        <td className="py-3 font-medium text-stone-800">{c?.name}{p.section}</td>
                        <td className="py-3 font-medium text-stone-800">{s?.name || 'Unknown subject'}</td>
                        <td className="py-3 font-medium text-stone-800">{t?.name || 'Unknown teacher'}</td>
                        <td className="py-3 text-right"><button onClick={() => removePreferred(p.id)} className="text-xs font-bold uppercase tracking-wider text-[#b4483e] hover:underline">Remove</button></td>
                      </tr>
                    )
                  })}
                  {preferredAssignments.length === 0 && (
                    <tr><td colSpan={4} className="py-10 text-center text-sm font-medium text-stone-400 italic">No overrides set.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// VIEW TAB
// ---------------------------------------------------------------------------
function ViewTab({ days, classes, teachers, result, onGenerate, maxClassPeriods }) {
  const [mode, setMode] = useState('all_teachers')
  const [selectedTeacher, setSelectedTeacher] = useState('')
  const [selectedClassSection, setSelectedClassSection] = useState('')

  if (!result) return null

  const teacherRoutines = useMemo(() => buildTeacherRoutines(result.entries, teachers), [result, teachers])
  const classRoutines = useMemo(() => buildClassRoutines(days, classes, result.entries, result.unscheduled), [days, classes, result])

  const classSectionOptions = classes.flatMap((c) => (c.sections.length > 0 ? c.sections.map((s) => ({ key: `${c.id}::${s}`, label: `${c.name} ${s}`, periodsPerDay: c.periodsPerDay })) : [{ key: `${c.id}::`, label: c.name, periodsPerDay: c.periodsPerDay }]))

  const activeTeacher = selectedTeacher || teachers[0]?.id || ''
  const activeClassSection = selectedClassSection || classSectionOptions[0]?.key || ''

  const statusStyles = {
    success: 'bg-[#f2f7ee] text-[#4a6b3a] border border-[#d9e6cd]',
    success_with_warnings: 'bg-[#fdf6ec] text-[#9a6a1f] border border-[#f0dfc0]',
    no_valid_solution: 'bg-[#fcf2f1] text-[#b4483e] border border-[#f2d5d2]',
  }
  const statusLabel = {
    success: 'Generated successfully',
    success_with_warnings: 'Generated — some periods still need a teacher',
    no_valid_solution: 'Could not schedule anything',
  }

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-sm shadow-sm border border-stone-200 p-6 md:p-8 print:hidden">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div className="flex gap-3 flex-wrap items-center">
            <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm ${statusStyles[result.status]}`}>
              {statusLabel[result.status]}
            </span>
            <span className="text-sm font-medium text-stone-500">{result.totalScheduled}/{result.totalRequired} lessons placed</span>
          </div>
          <button onClick={onGenerate} className="bg-white border border-stone-300 text-stone-800 px-6 py-3 rounded-sm text-xs uppercase tracking-widest font-bold hover:bg-stone-50 transition-colors shadow-sm">
            Re-generate & Shuffle
          </button>
        </div>

        {result.unscheduled.length > 0 && (
          <div className="mt-6 p-5 bg-[#fcf2f1] border border-[#f2d5d2] rounded-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#b4483e] mb-3">Unscheduled Periods (Missing Teachers)</h3>
            <ul className="text-xs font-medium text-[#8f3a32] space-y-2 max-h-40 overflow-y-auto">
              {result.unscheduled.map((u, i) => (
                <li key={i} className="flex flex-wrap items-start gap-2">
                  <span className="shrink-0 bg-white border border-[#f2d5d2] text-[#b4483e] text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm">Missing</span>
                  <span><strong>{u.className}{u.section} — {u.subject}:</strong> {u.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Teacher Workload Summary */}
      <TeacherWorkloadSummary entries={result.entries} teachers={teachers} days={days} maxClassPeriods={maxClassPeriods} />

      <section className="bg-white rounded-sm shadow-sm border border-stone-200 p-6 md:p-8">
        <div className="flex flex-wrap justify-between items-end gap-4 mb-8 print:hidden">
          <div className="flex gap-4 items-end flex-wrap">
            <div className="w-64">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">View</label>
              <Dropdown
                options={[
                  { label: 'All Teachers at Once', value: 'all_teachers' },
                  { label: 'Individual Teacher', value: 'teacher' },
                  { label: 'Individual Class / Section', value: 'class' },
                ]}
                value={mode}
                onChange={(v) => setMode(String(v))}
              />
            </div>

            {mode === 'teacher' && (
              <div className="w-64">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">Teacher</label>
                <Dropdown
                  options={teachers.map((t) => ({ label: t.name, value: t.id }))}
                  value={activeTeacher || null}
                  onChange={(v) => setSelectedTeacher(String(v))}
                  placeholder="Select teacher"
                  hasSearch
                />
              </div>
            )}
            
            {mode === 'class' && (
              <div className="w-64">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">Class / Section</label>
                <Dropdown
                  options={classSectionOptions.map((o) => ({ label: o.label, value: o.key }))}
                  value={activeClassSection || null}
                  onChange={(v) => setSelectedClassSection(String(v))}
                  placeholder="Select class"
                  hasSearch
                />
              </div>
            )}
          </div>
          <button onClick={() => window.print()} className="bg-stone-900 text-white px-6 py-3 rounded-sm text-xs uppercase tracking-widest font-bold hover:bg-stone-800 transition-colors shadow-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            Download PDF / Print
          </button>
        </div>

        <div id="printable-routine" className="space-y-12">
          {mode === 'all_teachers' && (
            <>
              <h2 className="text-xl font-semibold text-center uppercase tracking-wide mb-2 text-stone-900">Master Teacher Routine</h2>
              {teachers.map(t => (
                <TeacherGrid
                  key={t.id}
                  days={days}
                  periods={maxClassPeriods}
                  entries={teacherRoutines.get(t.id) || []}
                  title={t.name}
                  compact={true}
                />
              ))}
            </>
          )}

          {mode === 'teacher' && (
            <TeacherGrid
              days={days}
              periods={maxClassPeriods}
              entries={teacherRoutines.get(activeTeacher) || []}
              title={teachers.find((t) => t.id === activeTeacher)?.name || ''}
            />
          )}
          
          {mode === 'class' && (
            <ClassGrid
              days={days}
              periods={classSectionOptions.find((o) => o.key === activeClassSection)?.periodsPerDay || 6}
              entries={classRoutines.get(activeClassSection) || []}
              title={classSectionOptions.find((o) => o.key === activeClassSection)?.label || ''}
            />
          )}
        </div>
      </section>
    </div>
  )
}

function TeacherWorkloadSummary({ entries, teachers, days, maxClassPeriods }) {
  const stats = useMemo(() => {
    const counts = new Map()
    entries.forEach(e => counts.set(e.teacherId, (counts.get(e.teacherId) || 0) + 1))
    
    return teachers.map(t => {
      const assigned = counts.get(t.id) || 0
      const maxCap = Math.min(t.maxPeriodsPerDay, maxClassPeriods) * days.length
      const utilization = maxCap > 0 ? Math.round((assigned / maxCap) * 100) : 0
      return { ...t, assigned, maxCap, utilization }
    }).sort((a, b) => b.utilization - a.utilization)
  }, [entries, teachers, days, maxClassPeriods])

  return (
    <section className="bg-white rounded-sm shadow-sm border border-stone-200 p-6 md:p-8 print:hidden">
      <h2 className="text-lg font-semibold text-stone-900 uppercase tracking-wide mb-4">Teacher Workload Summary</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="border-b border-stone-200 bg-stone-50">
            <tr>
              <th className="py-2 px-4 text-xs font-bold uppercase tracking-wider text-stone-500">Teacher</th>
              <th className="py-2 px-4 text-xs font-bold uppercase tracking-wider text-stone-500">Assigned Periods</th>
              <th className="py-2 px-4 text-xs font-bold uppercase tracking-wider text-stone-500">Max Capacity</th>
              <th className="py-2 px-4 text-xs font-bold uppercase tracking-wider text-stone-500">Utilization</th>
            </tr>
          </thead>
          <tbody>
            {stats.map(s => (
              <tr key={s.id} className="border-b border-stone-100 last:border-0">
                <td className="py-3 px-4 font-semibold text-stone-800">{s.name}</td>
                <td className="py-3 px-4">{s.assigned}</td>
                <td className="py-3 px-4">{s.maxCap}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-full bg-stone-200 rounded-full h-2.5 max-w-[100px]">
                      <div className="bg-[#6b4c9a] h-2.5 rounded-full" style={{ width: `${s.utilization}%` }}></div>
                    </div>
                    <span className="text-xs font-medium text-stone-600">{s.utilization}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function TeacherGrid({ days, periods, entries, title, compact = false }) {
  const periodList = Array.from({ length: periods }, (_, i) => i + 1)
  const at = (day, period) => entries.find((e) => e.day === day && e.period === period)

  return (
    <div className={`break-inside-avoid ${compact ? 'mb-8' : ''}`}>
      <h3 className={`${compact ? 'text-md mb-3 text-left border-b border-stone-200 pb-2' : 'text-lg text-center mb-5'} font-semibold uppercase tracking-wide text-stone-900`}>
        {title}
      </h3>
      <div className="overflow-x-auto rounded-sm border border-stone-200 print:border-stone-400">
        <table className="w-full border-collapse text-sm text-center table-fixed min-w-[600px]">
          <thead className="bg-stone-50 print:bg-stone-100">
            <tr>
              <th className="border border-stone-200 print:border-stone-400 p-2 text-xs font-bold uppercase tracking-wider text-stone-500 print:text-stone-700 w-24">Day</th>
              {periodList.map((p) => <th key={p} className="border border-stone-200 print:border-stone-400 p-2 text-xs font-bold uppercase tracking-wider text-stone-500 print:text-stone-700">Period {p}</th>)}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day}>
                <td className="border border-stone-200 print:border-stone-400 p-2 font-bold text-stone-800 text-xs uppercase tracking-wider">{day.slice(0,3)}</td>
                {periodList.map((p) => {
                  const e = at(day, p)
                  return (
                    <td key={p} className="border border-stone-200 print:border-stone-400 p-2 break-words">
                      {e ? (
                        <div className="px-1">
                          <div className="font-semibold text-stone-800 leading-tight print:text-black">{e.subject}</div>
                          <div className="text-[10px] uppercase tracking-widest text-[#6b4c9a] print:text-stone-600 font-bold mt-1">{e.className}{e.section}</div>
                        </div>
                      ) : (
                        <span className="text-stone-300 print:text-stone-300 font-medium">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ClassGrid({ days, periods, entries, title }) {
  const periodList = Array.from({ length: periods }, (_, i) => i + 1)
  const at = (day, period) => entries.find((e) => e.day === day && e.period === period)

  return (
    <div className="break-inside-avoid">
      <h2 className="text-lg font-semibold text-center uppercase tracking-wide mb-5 text-stone-900">{title} — Weekly Routine</h2>
      <div className="overflow-x-auto rounded-sm border border-stone-200 print:border-stone-400">
        <table className="w-full border-collapse text-sm text-center table-fixed min-w-[600px]">
          <thead className="bg-stone-50 print:bg-stone-100">
            <tr>
              <th className="border border-stone-200 print:border-stone-400 p-3 text-xs font-bold uppercase tracking-wider text-stone-500 print:text-stone-700 w-24">Day</th>
              {periodList.map((p) => <th key={p} className="border border-stone-200 print:border-stone-400 p-3 text-xs font-bold uppercase tracking-wider text-stone-500 print:text-stone-700">Period {p}</th>)}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day}>
                <td className="border border-stone-200 print:border-stone-400 p-3 font-bold text-stone-800 uppercase tracking-wider">{day.slice(0,3)}</td>
                {periodList.map((p) => {
                  const e = at(day, p)
                  return (
                    <td key={p} className="border border-stone-200 print:border-stone-400 p-3 break-words">
                      {e ? (
                        e.isPlaceholder ? (
                          <div className="bg-[#fcf2f1] print:bg-stone-100 border border-[#f2d5d2] print:border-stone-300 rounded-sm py-1.5 px-1 mx-auto w-full max-w-[120px]">
                            <div className="font-bold text-[#b4483e] print:text-stone-500 text-[10px] uppercase tracking-widest leading-none mb-1">Missing</div>
                            <div className="text-xs text-[#8f3a32] print:text-stone-700 font-semibold">{e.subject}</div>
                          </div>
                        ) : (
                          <div className="px-1">
                            <div className="font-semibold text-stone-800 leading-tight print:text-black">{e.subject}</div>
                            <div className="text-xs text-[#6b4c9a] print:text-stone-600 font-medium mt-0.5 leading-tight">{e.teacherName}</div>
                          </div>
                        )
                      ) : (
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-stone-300 print:text-stone-300 font-medium">—</span>
                          <span className="text-[10px] text-stone-400 font-semibold uppercase tracking-wider mt-1 print:hidden">Free Period</span>
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}