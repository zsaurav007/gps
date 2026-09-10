'use client'

import React, { useMemo, useState } from 'react'
import Dropdown from '@/components/ui/dropdown' 
import { deleteDatabaseRecord } from '@/app/actions/routine-actions'

// ---------------------------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------------------------

export interface ClassData {
  id: string
  name: string
  periodsPerDay: number
  sections: string[]
}

export interface SubjectData {
  id: string
  name: string
}

export interface RequirementData {
  id: string
  classId: string
  section: string
  subjectId: string
  periodsPerWeek: number
}

export interface TeacherData {
  id: string
  name: string
  maxPeriodsPerDay: number
}

export interface QualificationData {
  id: string
  teacherId: string
  subjectId: string
}

export interface PreferredAssignmentData {
  id: string
  teacherId: string
  classId: string
  section: string
  subjectId: string
}

export interface RoutineEntry {
  day: string
  period: number
  classId: string
  className: string
  section: string
  subject: string
  teacherId: string | null
  teacherName: string
  isPlaceholder?: boolean
}

export interface UnscheduledLesson {
  classId: string
  className: string
  section: string
  subject: string
  reason: string
  needsTeacher: boolean
}

export interface GenerationResult {
  status: 'success' | 'success_with_warnings' | 'no_valid_solution'
  totalRequired: number
  totalScheduled: number
  unscheduled: UnscheduledLesson[]
  entries: RoutineEntry[]
  generationTimeMs?: number
}

export interface QualifiedTeacherStat {
  id: string
  name: string
  maxWeekly: number
}

export interface DeficitSubjectStat {
  id: string
  name: string
  req: number
  qualifiedTeachers: QualifiedTeacherStat[]
  rawCapacity: number
  isUnassigned: boolean
  effectiveCap: number
  deficit: number
  balance: number
}

export interface Deficits {
  totalReq: number
  totalCap: number
  overallDeficit: number
  subjectStats: DeficitSubjectStat[]
  unassignedCurriculum: number
}

// ---------------------------------------------------------------------------
// Scheduling engine & Utilities
// ---------------------------------------------------------------------------

// Utility to map english numerals to Bengali numerals globally in the UI
const engToBng = (str: string | number): string => {
  if (str === null || str === undefined) return '';
  const bngNums = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(str).replace(/[0-9]/g, w => bngNums[Number(w)]);
}

// Utility to map Bengali numerals back to English numerals for state/math
const bngToEng = (str: string | number): string => {
  if (str === null || str === undefined) return '';
  const bngNums = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(str).replace(/[০-৯]/g, w => String(bngNums.indexOf(w)));
}

const sectionKeyOf = (classId: string, section?: string): string => `${classId}::${section || ''}`
const slotKeyOf = (day: string, period: number, ...rest: (string | undefined)[]): string => [day, period, ...rest].join('::')

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function calculateDeficits(
  days: string[],
  classes: ClassData[],
  subjects: SubjectData[],
  requirements: RequirementData[],
  teachers: TeacherData[],
  qualifications: QualificationData[],
  maxClassPeriods: number
): Deficits {
  let totalReq = 0
  const subjectReqs: Record<string, number> = {}
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

  const subjectStats: Omit<DeficitSubjectStat, 'effectiveCap' | 'deficit' | 'balance'>[] = subjects.map(s => {
    const req = subjectReqs[s.id] || 0
    const qualifiedTeachers = qualifications
      .filter(q => q.subjectId === s.id)
      .map(q => {
        const t = teachers.find(teach => teach.id === q.teacherId)
        return t ? { id: t.id, name: t.name, maxWeekly: Math.min(t.maxPeriodsPerDay, maxClassPeriods) * days.length } : null
      })
      .filter((t): t is QualifiedTeacherStat => t !== null)

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

  const subjectProportionalCaps: Record<string, number> = {}
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

  const detailedSubjectStats: DeficitSubjectStat[] = subjectStats.map(s => {
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

function analyzeSetup(
  days: string[],
  classes: ClassData[],
  subjects: SubjectData[],
  requirements: RequirementData[],
  teachers: TeacherData[],
  qualifications: QualificationData[],
  deficits: Deficits
): string[] {
  const warnings: string[] = []
  const subjectNameById = new Map<string, string>(subjects.map((s) => [s.id, s.name]))

  for (const cls of classes) {
    const sections = cls.sections.length > 0 ? cls.sections : ['']
    for (const section of sections) {
      const reqs = requirements.filter((r) => r.classId === cls.id && (r.section || '') === section)
      const totalRequired = reqs.reduce((sum, r) => sum + Number(r.periodsPerWeek || 0), 0)
      const availableSlots = days.length * cls.periodsPerDay

      if (reqs.length === 0) {
        warnings.push(`${cls.name}${section}-এ এখনো কোনো বিষয় দেওয়া হয়নি।`)
        continue
      }

      if (totalRequired !== availableSlots) {
        warnings.push(
          `শ্রেণি ${cls.name}${section} - এ ঠিক ${engToBng(availableSlots)} পিরিয়ড/সপ্তাহ প্রয়োজন, কিন্তু বর্তমানে ${engToBng(totalRequired)} দেওয়া আছে।`
        )
      }

      for (const req of reqs) {
        const subjectName = subjectNameById.get(req.subjectId) || 'অজানা বিষয়'
        if (!req.periodsPerWeek || req.periodsPerWeek <= 0) {
          warnings.push(`${cls.name}${section} — ${subjectName}-এ ০ পিরিয়ড/সপ্তাহ সেট করা আছে।`)
          continue
        }
        if (req.periodsPerWeek > days.length) {
          warnings.push(`${cls.name}${section} — ${subjectName} সপ্তাহে ${engToBng(req.periodsPerWeek)} পিরিয়ড দেওয়া আছে (সর্বোচ্চ কর্মদিবস: ${engToBng(days.length)})। দৈনিক ডুপ্লিকেট ক্লাস এড়াতে এটি ≤ ${engToBng(days.length)} করুন।`)
        }
        const qualified = qualifications.filter((q) => q.subjectId === req.subjectId)
        if (qualified.length === 0) {
          warnings.push(`${cls.name}${section} — ${subjectName}: এর জন্য কোনো যোগ্য শিক্ষক নেই।`)
        }
      }
    }
  }

  if (deficits.overallDeficit > 0) {
    warnings.push(`সার্বিক শিক্ষক ঘাটতি: আপনার বর্তমান শিক্ষকদের সাপ্তাহিক পিরিয়ড সংখ্যা মোট চাহিদার চেয়ে ${engToBng(deficits.overallDeficit)} কম আছে।`)
  }
  
  const subjectsWithDeficit = deficits.subjectStats.filter(s => s.deficit > 0 && s.req > 0)
  if (subjectsWithDeficit.length > 0) {
    const names = subjectsWithDeficit.map(d => `${d.name} (${engToBng(d.deficit)} ঘাটতি)`).join(', ')
    warnings.push(`বিষয়ভিত্তিক ঘাটতি: যে বিষয়গুলোতে আরও শিক্ষক প্রয়োজন: ${names}।`)
  }

  if (subjects.length === 0) warnings.push('কোনো বিষয় উপলব্ধ নেই।')
  if (days.length === 0) warnings.push('কোনো কর্মদিবস নেই।')
  if (teachers.length === 0) warnings.push('কোনো শিক্ষক নেই।')
  if (classes.length === 0) warnings.push('কোনো ক্লাস নেই।')

  return warnings
}

function generateRoutine(
  days: string[],
  classes: ClassData[],
  subjects: SubjectData[],
  requirements: RequirementData[],
  teachers: TeacherData[],
  qualifications: QualificationData[],
  preferredAssignments: PreferredAssignmentData[],
  maxClassPeriods: number
): GenerationResult | null {
  const start = Date.now()
  let bestResult: GenerationResult | null = null
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

interface InternalLesson {
  id: string
  classId: string
  className: string
  periodsPerDay: number
  section: string
  subject: string
  candidateTeachers: string[]
}

function attemptSchedule(
  days: string[],
  classes: ClassData[],
  subjects: SubjectData[],
  requirements: RequirementData[],
  teachers: TeacherData[],
  qualifications: QualificationData[],
  preferredAssignments: PreferredAssignmentData[],
  maxClassPeriods: number
): GenerationResult {
  const teacherById = new Map<string, TeacherData>(teachers.map((t) => [t.id, t]))
  const subjectNameById = new Map<string, string>(subjects.map((s) => [s.id, s.name]))
  
  const lessons: InternalLesson[] = []
  for (const cls of classes) {
    const sections = cls.sections.length > 0 ? cls.sections : ['']
    for (const section of sections) {
      const reqs = requirements.filter((r) => r.classId === cls.id && (r.section || '') === section)
      for (const req of reqs) {
        if (!req.periodsPerWeek || req.periodsPerWeek <= 0) continue
        const subjectName = subjectNameById.get(req.subjectId) || 'অজানা বিষয়'

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

  lessons.sort((a, b) => {
    if (a.candidateTeachers.length === b.candidateTeachers.length) return Math.random() - 0.5
    return a.candidateTeachers.length - b.candidateTeachers.length
  })

  const classSlotTaken = new Set<string>()
  const teacherSlotTaken = new Set<string>()
  const teacherDailyCount = new Map<string, number>()
  const teacherTotalCount = new Map<string, number>()
  const subjectDayUsed = new Map<string, Set<string>>()
  const classDaySubjectTaken = new Set<string>()

  const entries: RoutineEntry[] = []
  const unscheduled: UnscheduledLesson[] = []

  const bump = (map: Map<string, number>, k: string, by = 1) => map.set(k, (map.get(k) || 0) + by)

  function commit(entry: RoutineEntry) {
    entries.push(entry)
    classSlotTaken.add(slotKeyOf(entry.day, entry.period, entry.classId, entry.section))
    if (entry.teacherId) {
      teacherSlotTaken.add(slotKeyOf(entry.day, entry.period, entry.teacherId))
      bump(teacherDailyCount, `${entry.teacherId}::${entry.day}`)
      bump(teacherTotalCount, entry.teacherId)
    }
    
    const sdKey = `${entry.classId}::${entry.section}::${entry.subject}`
    if (!subjectDayUsed.has(sdKey)) subjectDayUsed.set(sdKey, new Set())
    subjectDayUsed.get(sdKey)!.add(entry.day)
    
    classDaySubjectTaken.add(`${entry.classId}::${entry.section}::${entry.day}::${entry.subject}`)
  }

  function release(entry: RoutineEntry) {
    const idx = entries.indexOf(entry)
    if (idx >= 0) entries.splice(idx, 1)
    classSlotTaken.delete(slotKeyOf(entry.day, entry.period, entry.classId, entry.section))
    if (entry.teacherId) {
      teacherSlotTaken.delete(slotKeyOf(entry.day, entry.period, entry.teacherId))
      bump(teacherDailyCount, `${entry.teacherId}::${entry.day}`, -1)
      bump(teacherTotalCount, entry.teacherId, -1)
    }
    
    classDaySubjectTaken.delete(`${entry.classId}::${entry.section}::${entry.day}::${entry.subject}`)
  }

  function tryPlace(lesson: Omit<InternalLesson, 'id'>): RoutineEntry | null {
    const sdKey = `${lesson.classId}::${lesson.section}::${lesson.subject}`
    const daysUsed = subjectDayUsed.get(sdKey) || new Set<string>()
    
    const preferredSlots: { day: string, period: number }[] = []
    const fallbackSlots: { day: string, period: number }[] = []
    
    for (const day of days) {
      for (let period = 1; period <= lesson.periodsPerDay; period++) {
        if (!daysUsed.has(day)) preferredSlots.push({ day, period })
        else fallbackSlots.push({ day, period })
      }
    }
    
    const orderedSlots = [...shuffleArray(preferredSlots), ...shuffleArray(fallbackSlots)]

    for (const { day, period } of orderedSlots) {
      if (classSlotTaken.has(slotKeyOf(day, period, lesson.classId, lesson.section))) continue
      if (classDaySubjectTaken.has(`${lesson.classId}::${lesson.section}::${day}::${lesson.subject}`)) continue

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

  const placedStack: RoutineEntry[] = []
  const RETRY_BUDGET = 8

  for (const lesson of lessons) {
    let placed = tryPlace(lesson)
    let retries = 0

    while (!placed && retries < RETRY_BUDGET && placedStack.length > 0) {
      const idxFromEnd = [...placedStack].reverse().findIndex((p) => p.teacherId && lesson.candidateTeachers.includes(p.teacherId))
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
        candidateTeachers: victim.teacherId ? [victim.teacherId] : [],
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
          reason: `শিডিউল কনফ্লিক্ট সমাধানের সময় বাদ পড়েছে। যোগ্য শিক্ষকের ধারণক্ষমতা চেক করুন।`,
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
          ? `এই বিষয়ের জন্য কোনো শিক্ষক যোগ্য নয়।`
          : `শিক্ষক উপলব্ধ নেই (দৈনিক পিরিয়ড সীমা পূর্ণ)।`
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

function buildTeacherRoutines(entries: RoutineEntry[], teachers: TeacherData[]): Map<string, RoutineEntry[]> {
  const byTeacher = new Map<string, RoutineEntry[]>(teachers.map((t) => [t.id, []]))
  for (const e of entries) {
    if (e.teacherId && !byTeacher.has(e.teacherId)) byTeacher.set(e.teacherId, [])
    if (e.teacherId) {
      byTeacher.get(e.teacherId)!.push(e)
    }
  }
  return byTeacher
}

function buildClassRoutines(
  days: string[],
  classes: ClassData[],
  entries: RoutineEntry[],
  unscheduled: UnscheduledLesson[]
): Map<string, RoutineEntry[]> {
  const byClass = new Map<string, RoutineEntry[]>()
  for (const cls of classes) {
    const sections = cls.sections.length > 0 ? cls.sections : ['']
    for (const section of sections) byClass.set(sectionKeyOf(cls.id, section), [])
  }
  for (const e of entries) {
    const k = sectionKeyOf(e.classId, e.section)
    if (!byClass.has(k)) byClass.set(k, [])
    byClass.get(k)!.push(e)
  }

  const neededMap = new Map<string, Map<string, number>>()
  for (const u of unscheduled) {
    const k = sectionKeyOf(u.classId, u.section)
    if (!neededMap.has(k)) neededMap.set(k, new Map())
    const m = neededMap.get(k)!
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
      const freeSlots: { day: string, period: number }[] = []
      
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
            teacherName: 'শিক্ষক প্রয়োজন',
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
  { label: '৫-দিনের সপ্তাহ (রবি – বৃহঃ)', value: '5' },
  { label: '৬-দিনের সপ্তাহ (শনি – বৃহঃ)', value: '6' },
  { label: '৭-দিনের সপ্তাহ (শনি – শুক্র)', value: '7' },
]

const WEEK_TYPE_DAYS: Record<string, string[]> = {
  '5': ALL_DAYS.slice(1, 6), 
  '6': ALL_DAYS.slice(0, 6), 
  '7': ALL_DAYS.slice(0, 7), 
}

// Bengali mapped strings for display
const DAY_FULL_BN: Record<string, string> = { 'Saturday': 'শনিবার', 'Sunday': 'রবিবার', 'Monday': 'সোমবার', 'Tuesday': 'মঙ্গলবার', 'Wednesday': 'বুধবার', 'Thursday': 'বৃহস্পতিবার', 'Friday': 'শুক্রবার' }
const DAY_SHORT_BN: Record<string, string> = { 'Saturday': 'শনি', 'Sunday': 'রবি', 'Monday': 'সোম', 'Tuesday': 'মঙ্গল', 'Wednesday': 'বুধ', 'Thursday': 'বৃহঃ', 'Friday': 'শুক্র' }

const uid = (): string => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)

// ---------------------------------------------------------------------------
// UI component
// ---------------------------------------------------------------------------
export default function RoutineBuilderClient({
  dbClasses = [],
  dbSubjects = [],
  dbClassSubjects = [],
  dbRequirements = [],
  dbTeachers = [],
  dbQualifications = [],
  dbPreferredAssignments = [],
  dbHolidays = []
}: any) {
  const [activeTab, setActiveTab] = useState<string>('setup')

  const [weekType, setWeekType] = useState<string>('7')
  
  // Initialize holidays from database
  const [holidays, setHolidays] = useState<string[]>(() => {
    if (dbHolidays && Array.isArray(dbHolidays) && dbHolidays.length > 0) return dbHolidays;
    return ['Friday'];
  })
  
  // Initialize classes from database
  const [classes, setClasses] = useState<ClassData[]>(() => 
    dbClasses.map((c: any) => ({
      id: c.id,
      name: c.name,
      periodsPerDay: c.periodsPerDay || c.periods_per_day || 6,
      sections: c.sections || []
    }))
  )
  
  const [subjects, setSubjects] = useState<SubjectData[]>(() => 
    dbSubjects.map((s: any) => ({
      id: s.id,
      name: s.name
    }))
  ) 
  
  const [requirements, setRequirements] = useState<RequirementData[]>(() => {
    if (dbRequirements && dbRequirements.length > 0) return dbRequirements;
    const initialReqs: RequirementData[] = [];
    
    dbClassSubjects.forEach((cs: any) => {
      const cls = dbClasses.find((c: any) => c.id === cs.class_id);
      if (cls) {
        const sections = cls.sections && cls.sections.length > 0 ? cls.sections : [''];
        sections.forEach((sec: string) => {
          initialReqs.push({
            id: `${cs.class_id}-${sec}-${cs.subject_id}`,
            classId: cs.class_id,
            section: sec,
            subjectId: cs.subject_id,
            periodsPerWeek: 1
          });
        });
      }
    });
    return initialReqs;
  });
  
  const [teachers, setTeachers] = useState<TeacherData[]>(() => 
    dbTeachers.map((t: any) => ({
      id: t.id,
      name: t.name || t.full_name || 'Unknown',
      maxPeriodsPerDay: t.maxPeriodsPerDay || t.max_periods_per_day || 6
    }))
  ) 
  
  // Dynamically initialize qualifications by mapping subjects_taught back to database subjects
  const [qualifications, setQualifications] = useState<QualificationData[]>(() => {
    if (dbQualifications && dbQualifications.length > 0) return dbQualifications;
    
    const initialQuals: QualificationData[] = [];
    dbTeachers.forEach((t: any) => {
      if (t.subjects_taught) {
        const taughtArray = t.subjects_taught.split(',').map((s: string) => s.trim().toLowerCase());
        dbSubjects.forEach((sub: any) => {
          if (taughtArray.includes(sub.name.toLowerCase())) {
            initialQuals.push({
              id: uid(),
              teacherId: t.id,
              subjectId: sub.id
            });
          }
        });
      }
    });
    return initialQuals;
  });

  const [preferredAssignments, setPreferredAssignments] = useState<PreferredAssignmentData[]>(dbPreferredAssignments || [])

  const [result, setResult] = useState<GenerationResult | null>(null)

  const weekDays = WEEK_TYPE_DAYS[weekType]
  const days = useMemo(() => weekDays.filter((d) => !holidays.includes(d)), [weekDays, holidays])
  
  const maxClassPeriods = useMemo(() => classes.length > 0 ? Math.max(...classes.map(c => c.periodsPerDay)) : 6, [classes])

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
            <h1 className="text-2xl md:text-3xl font-semibold text-stone-900 uppercase tracking-wide">রুটিন বিল্ডার</h1>
            <p className="text-base font-medium text-stone-600 mt-1">আপনার ডেটাবেস সেটআপ কনফিগার করুন, কাস্টম ওভাররাইড যোগ করুন এবং রুটিন তৈরি করুন।</p>
          </div>
        </div>
        
        <div className="space-y-6 font-sans text-stone-900">
          <div className="flex gap-2 border-b border-stone-200 print:hidden">
            {[
              { id: 'setup', label: 'সেটআপ ও কারিকুলাম' },
              { id: 'view', label: 'রুটিন তৈরি ও প্রদর্শন' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 text-sm font-bold uppercase tracking-widest transition-colors border-b-2 -mb-px ${
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
// SETUP TAB COMPONENTS
// ---------------------------------------------------------------------------

interface SetupTabProps {
  weekType: string
  setWeekType: React.Dispatch<React.SetStateAction<string>>
  weekDays: string[]
  holidays: string[]
  setHolidays: React.Dispatch<React.SetStateAction<string[]>>
  days: string[]
  classes: ClassData[]
  setClasses: React.Dispatch<React.SetStateAction<ClassData[]>>
  maxClassPeriods: number
  subjects: SubjectData[]
  setSubjects: React.Dispatch<React.SetStateAction<SubjectData[]>>
  requirements: RequirementData[]
  setRequirements: React.Dispatch<React.SetStateAction<RequirementData[]>>
  teachers: TeacherData[]
  setTeachers: React.Dispatch<React.SetStateAction<TeacherData[]>>
  qualifications: QualificationData[]
  setQualifications: React.Dispatch<React.SetStateAction<QualificationData[]>>
  preferredAssignments: PreferredAssignmentData[]
  setPreferredAssignments: React.Dispatch<React.SetStateAction<PreferredAssignmentData[]>>
  warnings: string[]
  deficits: Deficits
  onGenerate: () => void
}

function SetupTab({
  weekType, setWeekType, weekDays, holidays, setHolidays, days,
  classes, setClasses, maxClassPeriods,
  subjects, setSubjects,
  requirements, setRequirements,
  teachers, setTeachers,
  qualifications, setQualifications,
  preferredAssignments, setPreferredAssignments,
  warnings, deficits, onGenerate,
}: SetupTabProps) {
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
        <h2 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide mb-1">রুটিন তৈরির জন্য প্রস্তুত</h2>
        <p className="text-base font-medium text-stone-600 mb-5">
          সাপ্তাহিক রুটিন তৈরি করুন। শিক্ষকদের স্বয়ংক্রিয়ভাবে ব্যালেন্স করা হবে এবং প্রতিদিনের সময়সূচীতে বৈচিত্র্য আনতে বিষয়গুলো সাফল করা হবে।
        </p>

        {warnings.length > 0 ? (
          <div className="mb-6 p-5 bg-[#fbf9fc] border border-[#dad3e3] rounded-sm">
            <p className="text-sm font-bold uppercase tracking-wider text-[#b4483e] mb-2">তৈরি করার আগে সতর্কবার্তাগুলো যাচাই করুন:</p>
            <ul className="text-sm font-medium text-[#b4483e] space-y-1.5 list-disc list-inside">
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        ) : (
          <div className="mb-6 p-5 bg-[#f2f7ee] border border-[#d9e6cd] rounded-sm">
            <p className="text-sm font-bold uppercase tracking-wider text-[#4a6b3a]">সেটআপ সম্পূর্ণ এবং সুন্দরভাবে ব্যালেন্সড দেখাচ্ছে।</p>
          </div>
        )}

        <button
          onClick={onGenerate}
          className="w-full sm:w-auto bg-[#6b4c9a] text-white px-8 py-3.5 rounded-sm text-sm uppercase tracking-widest font-bold hover:bg-[#5a3f82] transition-colors shadow-sm"
        >
          সাপ্তাহিক রুটিন তৈরি করুন
        </button>
      </section>
    </div>
  )
}

interface WeekAndHolidaysProps {
  weekType: string
  setWeekType: React.Dispatch<React.SetStateAction<string>>
  weekDays: string[]
  holidays: string[]
  setHolidays: React.Dispatch<React.SetStateAction<string[]>>
  days: string[]
}

function WeekAndHolidays({ weekType, setWeekType, weekDays, holidays, setHolidays, days }: WeekAndHolidaysProps) {
  function toggleHoliday(day: string) {
    setHolidays(holidays.includes(day) ? holidays.filter((d) => d !== day) : [...holidays, day])
  }

  function handleWeekTypeChange(value: string) {
    const nextDays = WEEK_TYPE_DAYS[value] || []
    setHolidays(holidays.filter((d) => nextDays.includes(d)))
    setWeekType(value)
  }

  return (
    <section className="bg-white rounded-sm shadow-sm border border-stone-200 p-6 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5 mb-8">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">১. সপ্তাহ ও ছুটির দিন</h2>
          <p className="text-base font-medium text-stone-600 mt-2">ডেটাবেস থেকে প্রাপ্ত ছুটির দিনগুলো নিচে আগে থেকেই টিক দেওয়া আছে। লোকালি প্রয়োগ করতে এডিট করুন।</p>
        </div>

        <div className="w-full md:w-72 shrink-0">
          <label className="block text-sm font-bold uppercase tracking-wider text-stone-700 mb-2">স্কুল সপ্তাহ</label>
          <Dropdown
            options={WEEK_TYPE_OPTIONS}
            value={weekType}
            onChange={(v) => handleWeekTypeChange(String(v))}
          />
        </div>
      </div>

      <label className="block text-sm font-bold uppercase tracking-wider text-stone-700 mb-3">ছুটির দিন চিহ্নিত করুন</label>
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
            <span className="text-base font-bold text-stone-800 uppercase tracking-wider mt-2 group-hover:text-[#b4483e]">{DAY_SHORT_BN[day]}</span>
            <span className="text-sm font-medium text-stone-500 mt-1">{DAY_FULL_BN[day]}</span>
          </label>
        ))}
      </div>

      <div className="p-5 bg-[#fbf9fc] border border-[#dad3e3] rounded-sm flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm">
        <span className="text-sm font-bold text-[#6b4c9a] uppercase tracking-wider shrink-0">কর্মদিবস ({engToBng(days.length)}):</span>
        {days.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {days.map((day) => (
              <span key={day} className="bg-white border border-stone-200 text-stone-800 px-4 py-1.5 rounded-sm text-sm font-bold uppercase tracking-wider shadow-sm">
                {DAY_FULL_BN[day]}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-base font-medium text-stone-500 italic">প্রতিদিন ছুটির দিন।</span>
        )}
      </div>
    </section>
  )
}

interface ClassesSectionProps {
  classes: ClassData[]
  setClasses: React.Dispatch<React.SetStateAction<ClassData[]>>
  days: string[]
  requirements: RequirementData[]
  setRequirements: React.Dispatch<React.SetStateAction<RequirementData[]>>
  preferredAssignments: PreferredAssignmentData[]
  setPreferredAssignments: React.Dispatch<React.SetStateAction<PreferredAssignmentData[]>>
}

function ClassesSection({ classes, setClasses, days, requirements, setRequirements, preferredAssignments, setPreferredAssignments }: ClassesSectionProps) {
  const [globalPeriods, setGlobalPeriods] = useState<string>('6')
  const [customName, setCustomName] = useState<string>('')
  const [sectionInput, setSectionInput] = useState<Record<string, string>>({})

  function handleGlobalPeriodsChange(val: string) {
    setGlobalPeriods(val)
    const num = val === '' ? 0 : Number(val)
    setClasses(classes.map(c => ({ ...c, periodsPerDay: num })))
  }

  function handleClassPeriodChange(classId: string, val: string) {
    const num = val === '' ? 0 : Number(val)
    setClasses(classes.map(c => c.id === classId ? { ...c, periodsPerDay: num } : c))
  }

  function handleClassNameChange(classId: string, val: string) {
    setClasses(classes.map(c => c.id === classId ? { ...c, name: val } : c))
  }

  function addCustomClass() {
    if (!customName.trim()) return
    if (classes.some(c => c.name.toLowerCase() === customName.trim().toLowerCase())) return
    setClasses([...classes, { id: uid(), name: customName.trim(), periodsPerDay: Number(globalPeriods) || 6, sections: [] }])
    setCustomName('')
  }

  async function removeClass(id: string) {
    if (id.includes('-') && id.length === 36) {
       if (!window.confirm("সতর্কতা: এটি ডেটাবেস থেকে ক্লাসটি স্থায়ীভাবে মুছে ফেলবে! চালিয়ে যাবেন?")) return;
       const res = await deleteDatabaseRecord('classes', id);
       if (!res.success) {
          alert(res.error);
          return;
       }
    }
    setClasses(classes.filter((c) => c.id !== id))
    setRequirements(requirements.filter((r) => r.classId !== id))
    setPreferredAssignments(preferredAssignments.filter((p) => p.classId !== id))
  }

  function addSection(classId: string) {
    const section = (sectionInput[classId] || '').trim()
    if (!section) return
    setClasses(classes.map((c) => (c.id === classId ? { ...c, sections: [...c.sections, section] } : c)))
    setSectionInput({ ...sectionInput, [classId]: '' })
  }

  function removeSection(classId: string, section: string) {
    setClasses(classes.map((c) => (c.id === classId ? { ...c, sections: c.sections.filter((s) => s !== section) } : c)))
    setRequirements(requirements.filter((r) => !(r.classId === classId && r.section === section)))
    setPreferredAssignments(preferredAssignments.filter((p) => !(p.classId === classId && p.section === section)))
  }

  return (
    <section className="bg-white rounded-sm shadow-sm border border-stone-200 p-6 md:p-8">
      <h2 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">২. ক্লাস ও সেকশন</h2>
      <p className="text-base font-medium text-stone-600 mt-2 mb-6">আপনার ডেটাবেসের ক্লাসগুলো নিচে দেখানো হলো। আপনি এগুলোর নাম, পিরিয়ড এডিট করতে পারেন বা কাস্টম ক্লাস যোগ করতে পারেন।</p>

      <div className="bg-[#fbf9fc] p-6 rounded-sm border border-[#dad3e3] mb-8 shadow-sm flex flex-col md:flex-row gap-5 items-end justify-between">
        <div className="w-full md:w-auto">
          <label className="block text-sm font-bold uppercase tracking-wider text-stone-700 mb-3">গ্লোবাল পিরিয়ড/দিন</label>
          <input
            type="text"
            inputMode="numeric"
            value={engToBng(globalPeriods)}
            onChange={(e) => handleGlobalPeriodsChange(bngToEng(e.target.value))}
            className="w-full md:w-64 p-3.5 bg-white border border-stone-300 rounded-sm text-base font-medium text-stone-900 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all"
          />
        </div>
        <div className="w-full md:w-auto flex gap-3">
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomClass() } }}
            placeholder="নতুন ক্লাসের নাম..."
            className="flex-1 md:w-64 p-3.5 bg-white border border-stone-300 rounded-sm text-base font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all"
          />
          <button onClick={addCustomClass} className="bg-stone-900 text-white px-6 py-3.5 rounded-sm text-sm uppercase tracking-widest font-bold hover:bg-stone-800 transition-colors shadow-sm shrink-0">
            + ক্লাস যোগ করুন
          </button>
        </div>
      </div>

      {classes.length > 0 && (
        <div className="overflow-x-auto border border-stone-200 rounded-sm">
          <table className="w-full text-left">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="py-3 px-4 text-base font-bold uppercase tracking-wider text-stone-500">ক্লাসের নাম (এডিটেবল)</th>
                <th className="py-3 px-4 text-base font-bold uppercase tracking-wider text-stone-500 w-32">পিরিয়ড/দিন</th>
                <th className="py-3 px-4 text-base font-bold uppercase tracking-wider text-stone-500 w-40 text-center">মোট সাপ্তাহিক পিরিয়ড</th>
                <th className="py-3 px-4 text-base font-bold uppercase tracking-wider text-stone-500">সেকশন </th>
                <th className="py-3 px-4 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {classes.map((c) => {
                const totalWeekly = c.periodsPerDay * days.length
                return (
                  <tr key={c.id} className="hover:bg-stone-50/50 transition-colors align-top">
                    <td className="py-4 px-4 font-bold text-stone-800">
                      <input
                        value={c.name}
                        onChange={(e) => handleClassNameChange(c.id, e.target.value)}
                        className="w-full p-2 bg-transparent border border-transparent hover:border-stone-300 focus:bg-white focus:border-[#6b4c9a] rounded-sm text-base font-bold text-stone-900 focus:outline-none transition-all"
                      />
                    </td>
                    <td className="py-4 px-4">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={c.periodsPerDay ? engToBng(c.periodsPerDay) : ''}
                        onChange={(e) => handleClassPeriodChange(c.id, bngToEng(e.target.value))}
                        className="w-full p-2 bg-white border border-stone-300 rounded-sm text-base font-medium text-stone-900 focus:outline-none focus:border-[#6b4c9a] transition-all text-center"
                      />
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="inline-block bg-[#fbf9fc] text-[#6b4c9a] font-bold border border-[#dad3e3] px-3 py-1.5 rounded-sm shadow-sm text-sm tracking-wider">
                        {engToBng(totalWeekly)}
                      </span>
                    </td>
                    <td className="py-4 px-4 space-y-3">
                      <div className="flex flex-wrap gap-1.5">
                        {c.sections.map((s) => (
                          <span key={s} className="inline-flex items-center gap-1.5 bg-white text-stone-800 text-sm font-bold px-2 py-1.5 rounded-sm border border-stone-200 shadow-sm">
                            {s}
                            <button onClick={() => removeSection(c.id, s)} className="text-stone-400 hover:text-[#b4483e] transition-colors"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          value={sectionInput[c.id] || ''}
                          onChange={(e) => setSectionInput({ ...sectionInput, [c.id]: e.target.value })}
                          placeholder="উদাঃ শাখা ক"
                          className="w-32 p-2 bg-white border border-stone-300 rounded-sm text-sm font-medium focus:outline-none focus:border-[#6b4c9a] transition-all"
                        />
                        <button onClick={() => addSection(c.id)} className="bg-white border border-stone-300 text-stone-700 px-4 py-2 rounded-sm text-xs uppercase font-bold hover:text-[#6b4c9a] hover:border-[#6b4c9a] transition-colors shadow-sm">যোগ</button>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button onClick={() => removeClass(c.id)} className="text-sm font-bold uppercase tracking-wider text-[#b4483e] hover:underline">মুছুন</button>
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

interface SubjectsSectionProps {
  subjects: SubjectData[]
  setSubjects: React.Dispatch<React.SetStateAction<SubjectData[]>>
  requirements: RequirementData[]
  setRequirements: React.Dispatch<React.SetStateAction<RequirementData[]>>
  qualifications: QualificationData[]
  setQualifications: React.Dispatch<React.SetStateAction<QualificationData[]>>
  preferredAssignments: PreferredAssignmentData[]
  setPreferredAssignments: React.Dispatch<React.SetStateAction<PreferredAssignmentData[]>>
}

function SubjectsSection({ subjects, setSubjects, requirements, setRequirements, qualifications, setQualifications, preferredAssignments, setPreferredAssignments }: SubjectsSectionProps) {
  const [name, setName] = useState<string>('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState<string>('')

  function addSubject() {
    if (!name.trim()) return
    if (subjects.some((s) => s.name.toLowerCase() === name.trim().toLowerCase())) {
      alert('এই নামের একটি বিষয় আগে থেকেই আছে।')
      return
    }
    setSubjects([...subjects, { id: uid(), name: name.trim() }])
    setName('')
  }

  function startEdit(s: SubjectData) {
    setEditingId(s.id)
    setEditName(s.name)
  }

  function saveEdit() {
    if (!editName.trim()) return
    if (subjects.some((s) => s.id !== editingId && s.name.toLowerCase() === editName.trim().toLowerCase())) {
      alert('এই নামের একটি বিষয় আগে থেকেই আছে।')
      return
    }
    setSubjects(subjects.map(s => s.id === editingId ? { ...s, name: editName.trim() } : s))
    setEditingId(null)
  }

  async function removeSubject(id: string) {
    if (id.includes('-') && id.length === 36) {
       if (!window.confirm("সতর্কতা: এটি ডেটাবেস থেকে বিষয়টি স্থায়ীভাবে মুছে ফেলবে! চালিয়ে যাবেন?")) return;
       const res = await deleteDatabaseRecord('subjects', id);
       if (!res.success) {
          alert(res.error);
          return;
       }
    }
    setSubjects(subjects.filter((s) => s.id !== id))
    setRequirements(requirements.filter((r) => r.subjectId !== id))
    setQualifications(qualifications.filter((q) => q.subjectId !== id))
    setPreferredAssignments(preferredAssignments.filter((p) => p.subjectId !== id))
  }

  return (
    <section className="bg-white rounded-sm shadow-sm border border-stone-200 p-6 md:p-8">
      <h2 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">৩. বিষয়সমূহ</h2>
      <p className="text-base font-medium text-stone-600 mt-2 mb-6">আপনার ডেটাবেসের বিষয়গুলো এখানে সম্পূর্ণ এডিটযোগ্য।</p>
      
      <div className="flex gap-3 mt-4 mb-8">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubject() } }}
          placeholder="উদাঃ উচ্চতর গণিত"
          className="flex-1 max-w-sm p-3.5 bg-white border border-stone-300 rounded-sm text-base font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm"
        />
        <button onClick={addSubject} className="bg-[#6b4c9a] text-white px-8 py-3.5 rounded-sm text-sm uppercase tracking-widest font-bold hover:bg-[#5a3f82] transition-colors shadow-sm shrink-0">
          + বিষয় যোগ করুন
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        {subjects.map((s) => {
          if (editingId === s.id) {
            return (
              <div key={s.id} className="flex items-center gap-2 bg-stone-50 border border-[#6b4c9a] p-1.5 rounded-sm shadow-sm">
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveEdit() }}
                  className="p-1.5 border border-stone-300 bg-white rounded-sm text-sm font-bold w-40 focus:outline-none focus:border-[#6b4c9a]"
                />
                <button onClick={saveEdit} className="text-xs uppercase font-bold bg-[#6b4c9a] text-white px-3 py-1.5 rounded-sm hover:bg-[#5a3f82]">সংরক্ষণ</button>
                <button onClick={() => setEditingId(null)} className="text-xs uppercase font-bold text-stone-600 bg-white border border-stone-300 px-3 py-1.5 rounded-sm hover:bg-stone-50">বাতিল</button>
              </div>
            )
          }
          return (
            <div key={s.id} className="group flex items-center gap-2 bg-white text-stone-800 border border-stone-300 text-sm font-bold px-4 py-2.5 rounded-sm tracking-wide shadow-sm hover:border-stone-400 transition-colors">
              <span>{s.name}</span>
              <div className="hidden group-hover:flex items-center gap-1.5 ml-2 border-l border-stone-200 pl-2">
                <button onClick={() => startEdit(s)} className="text-stone-400 hover:text-[#6b4c9a] transition-colors" title="Edit">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                </button>
                <button onClick={() => removeSubject(s.id)} className="text-stone-400 hover:text-[#b4483e] transition-colors" title="Delete">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
            </div>
          )
        })}
        {subjects.length === 0 && <p className="text-base font-medium text-stone-400 italic">কোনো বিষয় নেই।</p>}
      </div>
    </section>
  )
}

interface ClassCurriculumMatrixProps {
  classes: ClassData[]
  subjects: SubjectData[]
  requirements: RequirementData[]
  setRequirements: React.Dispatch<React.SetStateAction<RequirementData[]>>
  days: string[]
}

function ClassCurriculumMatrix({ classes, subjects, requirements, setRequirements, days }: ClassCurriculumMatrixProps) {
  const columns = useMemo(() => {
    return classes.flatMap(c => 
      c.sections.length > 0 
        ? c.sections.map(s => ({ classId: c.id, section: s, name: `${c.name} ${s}`, limit: c.periodsPerDay * days.length }))
        : [{ classId: c.id, section: '', name: c.name, limit: c.periodsPerDay * days.length }]
    )
  }, [classes, days.length])

  function toggleRequirement(classId: string, section: string, subjectId: string, checked: boolean) {
    if (checked) {
      setRequirements([...requirements, { id: uid(), classId, section, subjectId, periodsPerWeek: 1 }])
    } else {
      setRequirements(requirements.filter(r => !(r.classId === classId && (r.section || '') === section && r.subjectId === subjectId)))
    }
  }

  function updateRequirementPeriods(classId: string, section: string, subjectId: string, periods: string) {
    let num = periods === '' ? 0 : Number(periods)
    if (num > days.length) num = days.length 
    
    setRequirements(requirements.map(r => 
      (r.classId === classId && (r.section || '') === section && r.subjectId === subjectId)
        ? { ...r, periodsPerWeek: num }
        : r
    ))
  }

  return (
    <section className="bg-white rounded-sm shadow-sm border border-stone-200 p-6 md:p-8">
      <h2 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">৪. ক্লাস কারিকুলাম</h2>
      <p className="text-base font-medium text-stone-600 mt-2 mb-6">
        ডেটাবেস ম্যাপিং অনুযায়ী বিষয় ও সাপ্তাহিক পিরিয়ড সেট করুন।
        <strong className="text-[#b4483e] ml-1">ফাঁকা পিরিয়ড এড়াতে মোট পিরিয়ড অবশ্যই প্রদর্শিত সীমার সমান হতে হবে। প্রতি বিষয়ে সপ্তাহে সর্বোচ্চ {engToBng(days.length)} পিরিয়ড।</strong>
      </p>

      {columns.length === 0 || subjects.length === 0 ? (
        <div className="p-6 rounded-sm border border-dashed border-stone-300 bg-stone-50 text-center text-base font-medium text-stone-500">
          কারিকুলাম তৈরির জন্য ডেটাবেস থেকে ক্লাস এবং বিষয় আনা হচ্ছে...
        </div>
      ) : (
        <div className="overflow-x-auto border border-stone-200 rounded-sm shadow-sm">
          <table className="w-full text-base border-collapse min-w-max bg-white">
            <thead className="bg-stone-50 border-b border-stone-200 sticky top-0 z-10">
              <tr>
                <th className="py-4 px-4 text-left text-base font-bold uppercase tracking-wider text-stone-500 border-r border-stone-200">
                  বিষয়সমূহ
                </th>
                {columns.map(col => {
                  const currentSum = requirements
                    .filter(r => r.classId === col.classId && (r.section || '') === col.section)
                    .reduce((sum, r) => sum + (r.periodsPerWeek || 0), 0)
                  
                  const isPerfect = currentSum === col.limit

                  return (
                    <th key={`${col.classId}-${col.section}`} className="py-3 px-4 text-center border-r border-stone-200 last:border-0 min-w-[140px]">
                      <div className="font-bold text-stone-800 text-base mb-1">{col.name}</div>
                      <div className={`text-[11px] font-bold uppercase tracking-widest px-2 py-1 rounded-sm border inline-block ${isPerfect ? 'bg-[#f2f7ee] text-[#4a6b3a] border-[#d9e6cd]' : 'bg-[#fcf2f1] text-[#b4483e] border-[#f2d5d2]'}`}>
                        {engToBng(currentSum)} / {engToBng(col.limit)} স্লট
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {subjects.map((subj) => (
                <tr key={subj.id} className="hover:bg-stone-50/50 transition-colors">
                  <td className="py-3 px-4 font-bold text-stone-800 border-r border-stone-100 sticky left-0 bg-white">
                    {subj.name}
                  </td>
                  {columns.map(col => {
                    const req = requirements.find(r => r.classId === col.classId && (r.section || '') === col.section && r.subjectId === subj.id)
                    const isChecked = !!req

                    return (
                      <td key={`${col.classId}-${col.section}`} className="py-3 px-4 text-center border-r border-stone-100 last:border-0 align-middle">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => toggleRequirement(col.classId, col.section, subj.id, e.target.checked)}
                            className="w-5 h-5 text-[#6b4c9a] bg-white border-stone-300 rounded-sm focus:ring-[#6b4c9a] cursor-pointer accent-[#6b4c9a]"
                          />
                          {isChecked && req && (
                            <input
                              type="text"
                              inputMode="numeric"
                              value={req.periodsPerWeek ? engToBng(req.periodsPerWeek) : ''}
                              onChange={(e) => updateRequirementPeriods(col.classId, col.section, subj.id, bngToEng(e.target.value))}
                              className="w-16 p-1.5 text-center border border-stone-300 bg-white rounded-sm text-sm font-bold focus:outline-none focus:border-[#6b4c9a]"
                              title={`সপ্তাহে সর্বোচ্চ ${engToBng(days.length)} পিরিয়ড`}
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

interface TeachersSectionProps {
  teachers: TeacherData[]
  setTeachers: React.Dispatch<React.SetStateAction<TeacherData[]>>
  maxClassPeriods: number
  qualifications: QualificationData[]
  setQualifications: React.Dispatch<React.SetStateAction<QualificationData[]>>
  preferredAssignments: PreferredAssignmentData[]
  setPreferredAssignments: React.Dispatch<React.SetStateAction<PreferredAssignmentData[]>>
}

function TeachersSection({ teachers, setTeachers, maxClassPeriods, qualifications, setQualifications, preferredAssignments, setPreferredAssignments }: TeachersSectionProps) {
  const [name, setName] = useState<string>('')
  const [maxPeriodsPerDay, setMaxPeriodsPerDay] = useState<string>('')
  
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState<string>('')
  const [editPeriods, setEditPeriods] = useState<string>('')

  function addTeacher() {
    const p = Number(maxPeriodsPerDay)
    if (!name.trim() || !p || p <= 0) return
    
    if (teachers.some(t => t.name.toLowerCase() === name.trim().toLowerCase())) {
      alert('এই নামের একজন শিক্ষক আগে থেকেই আছেন।')
      return
    }

    if (p > maxClassPeriods) {
      alert(`একজন শিক্ষক দিনে ${engToBng(maxClassPeriods)} পিরিয়ডের বেশি ক্লাস নিতে পারবেন না।`)
      return
    }
    setTeachers([...teachers, { id: uid(), name: name.trim(), maxPeriodsPerDay: p }])
    setName('')
    setMaxPeriodsPerDay('')
  }

  function startEdit(t: TeacherData) {
    setEditingId(t.id)
    setEditName(t.name)
    setEditPeriods(String(Math.min(t.maxPeriodsPerDay, maxClassPeriods)))
  }

  function saveEdit() {
    const p = Number(editPeriods)
    if (!editName.trim() || !p || p <= 0) return

    if (teachers.some((t) => t.id !== editingId && t.name.toLowerCase() === editName.trim().toLowerCase())) {
      alert('এই নামের একজন শিক্ষক আগে থেকেই আছেন।')
      return
    }

    if (p > maxClassPeriods) {
      alert(`সর্বোচ্চ পিরিয়ডের বেশি দেওয়া যাবে না (${engToBng(maxClassPeriods)})`)
      return
    }

    setTeachers(teachers.map(t => t.id === editingId ? { ...t, name: editName.trim(), maxPeriodsPerDay: p } : t))
    setEditingId(null)
  }

  async function removeTeacher(id: string) {
    if (id.includes('-') && id.length === 36) {
       if (!window.confirm("সতর্কতা: এটি ডেটাবেস থেকে শিক্ষককে স্থায়ীভাবে মুছে ফেলবে! চালিয়ে যাবেন?")) return;
       const res = await deleteDatabaseRecord('teachers', id);
       if (!res.success) {
          alert(res.error);
          return;
       }
    }
    setTeachers(teachers.filter((t) => t.id !== id))
    setQualifications(qualifications.filter((q) => q.teacherId !== id))
    setPreferredAssignments(preferredAssignments.filter((p) => p.teacherId !== id))
  }

  return (
    <section className="bg-white rounded-sm shadow-sm border border-stone-200 p-6 md:p-8">
      <h2 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">৫. শিক্ষকবৃন্দ</h2>
      <p className="text-base font-medium text-stone-600 mt-2 mb-6">ডেটাবেসের শিক্ষকরা এখানে সম্পূর্ণ এডিটযোগ্য। প্রতিদিনের সর্বোচ্চ পিরিয়ড আপনার দীর্ঘতম ক্লাসের সর্বোচ্চ পিরিয়ডের চেয়ে বেশি হতে পারবে না (<strong className="text-stone-800">{engToBng(maxClassPeriods)}</strong>)।</p>

      <div className="bg-[#fbf9fc] p-6 rounded-sm border border-[#dad3e3] mb-8 grid grid-cols-1 md:grid-cols-12 gap-5 items-end shadow-sm">
        <div className="md:col-span-6">
          <label className="block text-sm font-bold uppercase tracking-wider text-stone-700 mb-2">শিক্ষকের নাম</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="পুরো নাম" className="w-full p-3.5 bg-white border border-stone-300 rounded-sm text-base font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm" />
        </div>
        <div className="md:col-span-3">
          <label className="block text-sm font-bold uppercase tracking-wider text-stone-700 mb-2">সর্বোচ্চ পিরিয়ড/দিন</label>
          <input type="text" inputMode="numeric" value={engToBng(maxPeriodsPerDay)} onChange={(e) => setMaxPeriodsPerDay(bngToEng(e.target.value))} placeholder={`সর্বোচ্চ ${engToBng(maxClassPeriods)}`} className="w-full p-3.5 bg-white border border-stone-300 rounded-sm text-base font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all shadow-sm text-center" />
        </div>
        <div className="md:col-span-3">
          <button onClick={addTeacher} className="w-full bg-[#6b4c9a] text-white px-5 py-3.5 rounded-sm text-sm uppercase tracking-widest font-bold hover:bg-[#5a3f82] transition-colors shadow-sm">+ শিক্ষক যোগ করুন</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {teachers.map((t) => {
          if (editingId === t.id) {
            return (
              <div key={t.id} className="flex flex-col gap-3 bg-white shadow-sm border border-[#6b4c9a] p-4 rounded-sm">
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="নাম"
                  className="w-full p-2 border border-stone-300 rounded-sm text-base font-bold focus:outline-none focus:border-[#6b4c9a]"
                />
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-stone-500 uppercase tracking-widest">সর্বোচ্চ/দিন</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={engToBng(editPeriods)}
                    onChange={(e) => setEditPeriods(bngToEng(e.target.value))}
                    className="flex-1 p-2 border border-stone-300 rounded-sm text-base font-bold text-center focus:outline-none focus:border-[#6b4c9a]"
                  />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <button onClick={saveEdit} className="flex-1 text-xs bg-[#6b4c9a] text-white uppercase font-bold px-3 py-2.5 rounded-sm hover:bg-[#5a3f82]">সংরক্ষণ</button>
                  <button onClick={() => setEditingId(null)} className="flex-1 text-xs border border-stone-300 bg-white text-stone-700 uppercase font-bold px-3 py-2.5 rounded-sm hover:bg-stone-50">বাতিল</button>
                </div>
              </div>
            )
          }

          const effectiveMax = Math.min(t.maxPeriodsPerDay, maxClassPeriods)

          return (
            <div key={t.id} className="group bg-white flex flex-col justify-between border border-stone-200 p-4 rounded-sm shadow-sm hover:border-[#dad3e3] transition-colors">
              <div>
                <h4 className="font-bold text-stone-900 text-base mb-1">{t.name}</h4>
                <p className={`text-sm font-semibold ${effectiveMax < t.maxPeriodsPerDay ? 'text-[#b4483e]' : 'text-stone-500'}`}>
                  সীমা: {engToBng(effectiveMax)} পিরিয়ড/দিন
                </p>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-stone-100">
                <button onClick={() => startEdit(t)} className="flex-1 bg-[#fbf9fc] text-[#6b4c9a] text-xs font-bold uppercase tracking-widest py-2 rounded-sm hover:bg-[#f3eff8] transition-colors">এডিট</button>
                <button onClick={() => removeTeacher(t.id)} className="flex-1 bg-[#fcf8f8] text-[#b4483e] text-xs font-bold uppercase tracking-widest py-2 rounded-sm hover:bg-red-50 transition-colors">মুছুন</button>
              </div>
            </div>
          )
        })}
        {teachers.length === 0 && <p className="text-base font-medium text-stone-400 italic p-4">কোনো শিক্ষক নেই।</p>}
      </div>
    </section>
  )
}

interface TeacherSubjectCheckmarksProps {
  teachers: TeacherData[]
  subjects: SubjectData[]
  qualifications: QualificationData[]
  setQualifications: React.Dispatch<React.SetStateAction<QualificationData[]>>
}

function TeacherSubjectCheckmarks({ teachers, subjects, qualifications, setQualifications }: TeacherSubjectCheckmarksProps) {
  function toggleQual(teacherId: string, subjectId: string) {
    const exists = qualifications.find(q => q.teacherId === teacherId && q.subjectId === subjectId)
    if (exists) {
      setQualifications(qualifications.filter(q => q.id !== exists.id))
    } else {
      setQualifications([...qualifications, { id: uid(), teacherId, subjectId }])
    }
  }

  return (
    <section className="bg-white rounded-sm shadow-sm border border-stone-200 p-6 md:p-8">
      <h2 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">৬. শিক্ষকবৃন্দ যে যে বিষয় পড়াবেন</h2>
      <p className="text-base font-medium text-stone-600 mt-2 mb-6">কোন শিক্ষক কোন বিষয় পড়াবেন তা চিহ্নিত করুন।</p>

      {teachers.length === 0 || subjects.length === 0 ? (
        <div className="p-6 rounded-sm border border-dashed border-stone-300 bg-stone-50 text-center text-base font-medium text-stone-500">
          উপরে শিক্ষক এবং বিষয় যোগ করুন।
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {teachers.map(t => (
            <div key={t.id} className="border border-stone-200 bg-white rounded-sm p-5 shadow-sm hover:border-[#dad3e3] transition-colors">
              <h3 className="font-bold text-stone-900 uppercase tracking-wider mb-4 border-b border-stone-100 pb-3 text-base">{t.name}</h3>
              <div className="flex flex-col gap-3">
                {subjects.map(s => {
                  const isQual = qualifications.some(q => q.teacherId === t.id && q.subjectId === s.id)
                  return (
                    <label key={s.id} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={isQual}
                        onChange={() => toggleQual(t.id, s.id)}
                        className="w-5 h-5 text-[#6b4c9a] bg-stone-50 border-stone-300 rounded-sm focus:ring-[#6b4c9a] cursor-pointer accent-[#6b4c9a]"
                      />
                      <span className={`text-base select-none transition-colors ${isQual ? 'text-stone-900 font-bold' : 'text-stone-500 font-medium group-hover:text-stone-800'}`}>
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

interface TeacherCapacityDashboardProps {
  maxClassPeriods: number
  deficits: Deficits
  days: string[]
}

function TeacherCapacityDashboard({ maxClassPeriods, deficits }: TeacherCapacityDashboardProps) {
  const [calcPeriodsPerDay, setCalcPeriodsPerDay] = useState<string>('')

  const { totalReq, totalCap, overallDeficit, subjectStats, unassignedCurriculum } = deficits

  const val = Number(calcPeriodsPerDay)
  const effectiveCalcPeriods = val > 0 ? Math.min(val, maxClassPeriods) : 0
  const totalNewTeachersNeeded = effectiveCalcPeriods > 0 
    ? Math.ceil(overallDeficit / (effectiveCalcPeriods * 5)) 
    : '—'

  return (
    <section className="bg-white rounded-sm shadow-sm border border-stone-200 p-6 md:p-8">
      <h2 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide border-b border-stone-200 pb-4 mb-6">৭. শিক্ষক প্রয়োজন ও ঘাটতি</h2>
      
      {unassignedCurriculum > 0 && (
        <div className="mb-6 p-4 bg-[#fcf2f1] border border-[#f2d5d2] rounded-sm">
          <p className="text-base font-bold text-[#b4483e]">অসম্পূর্ণ কারিকুলাম!</p>
          <p className="text-sm font-medium text-[#b4483e] mt-1">আপনার কারিকুলামে {engToBng(unassignedCurriculum)}টি ক্লাস পিরিয়ডে কোনো বিষয় অ্যাসাইন করা নেই। সম্পূর্ণ শিডিউলের জন্য সেকশন ৪ পূরণ করুন।</p>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-stone-50 p-5 rounded-sm border border-stone-200 text-center shadow-sm">
          <p className="text-sm font-bold uppercase tracking-wider text-stone-500 mb-1">মোট কারিকুলাম প্রয়োজন</p>
          <p className="text-3xl font-black text-stone-900">{engToBng(totalReq)} <span className="text-sm font-bold uppercase text-stone-400">পিরিয়ড/সপ্তাহ</span></p>
        </div>
        <div className="bg-stone-50 p-5 rounded-sm border border-stone-200 text-center shadow-sm">
          <p className="text-sm font-bold uppercase tracking-wider text-stone-500 mb-1">মোট শিক্ষক ধারণক্ষমতা</p>
          <p className="text-3xl font-black text-[#4a6b3a]">{engToBng(totalCap)} <span className="text-sm font-bold uppercase text-[#4a6b3a]/70">পিরিয়ড/সপ্তাহ</span></p>
        </div>
        <div className={`${overallDeficit > 0 ? 'bg-[#fcf2f1] border-[#f2d5d2]' : 'bg-[#f2f7ee] border-[#d9e6cd]'} shadow-sm p-5 rounded-sm border text-center`}>
          <p className={`text-sm font-bold uppercase tracking-wider mb-1 ${overallDeficit > 0 ? 'text-[#b4483e]' : 'text-[#4a6b3a]'}`}>সার্বিক ঘাটতি</p>
          <p className={`text-3xl font-black ${overallDeficit > 0 ? 'text-[#b4483e]' : 'text-[#4a6b3a]'}`}>{engToBng(overallDeficit)}</p>
        </div>
      </div>

      {/* Detailed Subject-wise Requirements & Teacher Capacity Table */}
      <div className="bg-white border border-stone-200 shadow-sm rounded-sm mb-8 overflow-hidden">
        <div className="bg-[#fbf9fc] px-6 py-4 border-b border-[#dad3e3] flex justify-between items-center">
          <h3 className="text-base font-bold uppercase tracking-wider text-stone-800">বিষয়ভিত্তিক প্রয়োজন ও যোগ্য ধারণক্ষমতা</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-base text-left">
            <thead className="border-b border-stone-200 bg-stone-50">
              <tr>
                <th className="py-3 px-6 text-base font-bold uppercase tracking-wider text-stone-500">বিষয়</th>
                <th className="py-3 px-6 text-base font-bold uppercase tracking-wider text-stone-500">প্রয়োজন / সপ্তাহ</th>
                <th className="py-3 px-6 text-base font-bold uppercase tracking-wider text-stone-500">যোগ্য শিক্ষক</th>
                <th className="py-3 px-6 text-base font-bold uppercase tracking-wider text-stone-500">যোগ্য ধারণক্ষমতা</th>
                <th className="py-3 px-6 text-base font-bold uppercase tracking-wider text-stone-500">অবস্থা</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {subjectStats.map(s => {
                const hasDeficit = s.deficit > 0 && s.req > 0
                const isNoTeacher = s.qualifiedTeachers.length === 0 && s.req > 0

                return (
                  <tr key={s.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="py-4 px-6 font-bold text-stone-900 text-base">{s.name}</td>
                    <td className="py-4 px-6 font-black text-stone-800 text-base">{engToBng(s.req)} <span className="text-xs text-stone-400 font-bold uppercase">পিরিয়ড</span></td>
                    <td className="py-4 px-6">
                      {s.qualifiedTeachers.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {s.qualifiedTeachers.map(t => (
                            <span key={t.id} className="inline-block bg-white shadow-sm border border-stone-200 text-stone-800 font-bold text-sm uppercase tracking-wider px-2 py-1 rounded-sm">
                              {t.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm font-bold text-[#b4483e] italic">কোনো শিক্ষক দেওয়া হয়নি</span>
                      )}
                    </td>
                    <td className="py-4 px-6 font-bold text-stone-700 text-base">
                      {engToBng(s.rawCapacity)} <span className="text-xs text-stone-400 font-bold uppercase">পিরিয়ড/সপ্তাহ</span>
                    </td>
                    <td className="py-4 px-6">
                      {isNoTeacher ? (
                        <span className="inline-block bg-[#fcf2f1] text-[#b4483e] border border-[#f2d5d2] shadow-sm text-sm font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-sm">
                          শিক্ষক প্রয়োজন
                        </span>
                      ) : hasDeficit ? (
                        <span className="inline-block bg-[#fdf6ec] text-[#9a6a1f] border border-[#f0dfc0] shadow-sm text-sm font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-sm">
                          ঘাটতি {engToBng(s.deficit)}
                        </span>
                      ) : (
                        <span className="inline-block bg-[#f2f7ee] text-[#4a6b3a] border border-[#d9e6cd] shadow-sm text-sm font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-sm">
                          পর্যাপ্ত {s.balance > 0 && `(+${engToBng(s.balance)})`}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {subjectStats.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-stone-400 italic font-medium">এখনো কোনো বিষয় যোগ করা হয়নি।</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Teacher Calculator */}
      <div className="bg-[#fbf9fc] p-6 md:p-8 rounded-sm border border-[#dad3e3] shadow-sm">
        <h3 className="text-base font-bold uppercase tracking-wider text-[#6b4c9a] mb-5">শিক্ষক প্রয়োজন ক্যালকুলেটর</h3>
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="shrink-0 w-full md:w-auto">
            <label className="block text-sm font-bold uppercase tracking-wider text-stone-700 mb-2">যদি একজন নতুন শিক্ষক কাজ করেন:</label>
            <div className="flex items-center gap-3">
              <input
                type="text"
                inputMode="numeric"
                value={engToBng(calcPeriodsPerDay)}
                onChange={(e) => setCalcPeriodsPerDay(bngToEng(e.target.value))}
                placeholder={`১ থেকে ${engToBng(maxClassPeriods)}`}
                className="w-24 p-3 bg-white border border-[#dad3e3] shadow-inner rounded-sm text-base font-bold focus:outline-none focus:border-[#6b4c9a] text-center"
              />
              <span className="text-sm font-bold uppercase text-stone-500">পিরিয়ড/দিন (সর্বোচ্চ {engToBng(maxClassPeriods)})</span>
            </div>
          </div>
          
          <div className="hidden md:block w-px h-12 bg-[#dad3e3]"></div>

          <div className="flex-1 w-full border-t border-[#dad3e3] pt-5 md:border-t-0 md:pt-0">
            <p className="text-sm font-bold uppercase tracking-wider text-stone-700 mb-2">আনুমানিক শিক্ষক প্রয়োজন:</p>
            <p className="text-2xl font-black text-[#6b4c9a]">
              {totalNewTeachersNeeded === '—' ? '—' : engToBng(totalNewTeachersNeeded)} <span className="text-lg">অতিরিক্ত শিক্ষক</span>
              <span className="text-xs font-bold uppercase tracking-wider text-[#6b4c9a]/70 ml-2 block sm:inline mt-1 sm:mt-0">স্কুলের সার্বিক চাহিদা পূরণে।</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

interface PreferredTeacherSectionProps {
  classes: ClassData[]
  subjects: SubjectData[]
  requirements: RequirementData[]
  teachers: TeacherData[]
  qualifications: QualificationData[]
  preferredAssignments: PreferredAssignmentData[]
  setPreferredAssignments: React.Dispatch<React.SetStateAction<PreferredAssignmentData[]>>
}

function PreferredTeacherSection({ classes, subjects, requirements, teachers, qualifications, preferredAssignments, setPreferredAssignments }: PreferredTeacherSectionProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [classId, setClassId] = useState<string>('')
  const [section, setSection] = useState<string>('')
  const [subjectId, setSubjectId] = useState<string>('')
  const [teacherId, setTeacherId] = useState<string>('')

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

  function removePreferred(id: string) {
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
            <h2 className="text-xl md:text-2xl font-semibold text-stone-900 uppercase tracking-wide">৮. ক্লাস অনুযায়ী পছন্দের শিক্ষক</h2>
            <span className="text-xs font-bold uppercase tracking-widest text-[#6b4c9a] bg-[#fbf9fc] border border-[#dad3e3] px-2.5 py-1 rounded-sm shadow-sm">ঐচ্ছিক</span>
          </div>
          <p className="text-base font-medium text-stone-600 mt-1">
            অটো-অ্যাসাইনমেন্ট বাতিল করে নির্দিষ্ট বিষয় ও ক্লাসের জন্য নির্দিষ্ট শিক্ষক নির্ধারণ করুন।
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
                <label className="block text-sm font-bold uppercase tracking-wider text-stone-700 mb-2">ক্লাস</label>
                <Dropdown
                  options={classes.map((c) => ({ label: c.name, value: c.id }))}
                  value={classId || null}
                  onChange={(v) => { setClassId(String(v)); setSection(''); setSubjectId(''); setTeacherId('') }}
                  placeholder="ক্লাস নির্বাচন করুন"
                />
              </div>
              <div>
                <label className="block text-sm font-bold uppercase tracking-wider text-stone-700 mb-2">শাখা</label>
                {sectionOptions.length > 0 ? (
                  <Dropdown
                    options={sectionOptions.map((s) => ({ label: s, value: s }))}
                    value={section || null}
                    onChange={(v) => { setSection(String(v)); setSubjectId(''); setTeacherId('') }}
                    placeholder="শাখা নির্বাচন করুন"
                  />
                ) : (
                  <div className="p-3.5 text-base font-medium text-stone-400 italic">কোনো শাখা নেই</div>
                )}
              </div>
              <div>
                <label className="block text-sm font-bold uppercase tracking-wider text-stone-700 mb-2">বিষয়</label>
                {subjectOptions.length > 0 ? (
                  <Dropdown
                    options={subjectOptions.map((s) => ({ label: s.name, value: s.id }))}
                    value={subjectId || null}
                    onChange={(v) => { setSubjectId(String(v)); setTeacherId('') }}
                    placeholder="বিষয় নির্বাচন করুন"
                  />
                ) : (
                  <div className="p-3.5 text-base font-medium text-stone-400 italic">আগে কারিকুলাম দিন</div>
                )}
              </div>
              <div>
                <label className="block text-sm font-bold uppercase tracking-wider text-stone-700 mb-2">শিক্ষক</label>
                {teacherOptions.length > 0 ? (
                  <Dropdown
                    options={teacherOptions.map((t) => ({ label: t.name, value: t.id }))}
                    value={teacherId || null}
                    onChange={(v) => setTeacherId(String(v))}
                    placeholder="শিক্ষক নির্বাচন করুন"
                    hasSearch
                  />
                ) : (
                  <div className="p-3.5 text-base font-medium text-stone-400 italic">কোনো যোগ্য শিক্ষক নেই</div>
                )}
              </div>
              <button onClick={addPreferred} className="bg-[#6b4c9a] text-white px-5 py-3.5 rounded-sm text-sm uppercase tracking-widest font-bold hover:bg-[#5a3f82] transition-colors shadow-sm">
                + পিন করুন
              </button>
            </div>

            <div className="overflow-x-auto border border-stone-200 rounded-sm shadow-sm">
              <table className="w-full text-base text-left">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr>
                    <th className="py-3 px-4 text-sm font-bold uppercase tracking-wider text-stone-500">ক্লাস</th>
                    <th className="py-3 px-4 text-sm font-bold uppercase tracking-wider text-stone-500">বিষয়</th>
                    <th className="py-3 px-4 text-sm font-bold uppercase tracking-wider text-stone-500">শিক্ষক</th>
                    <th className="py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {preferredAssignments.map((p) => {
                    const c = classes.find((x) => x.id === p.classId)
                    const s = subjects.find((x) => x.id === p.subjectId)
                    const t = teachers.find((x) => x.id === p.teacherId)
                    return (
                      <tr key={p.id} className="hover:bg-stone-50 transition-colors">
                        <td className="py-4 px-4 font-bold text-stone-800">{c?.name}{p.section}</td>
                        <td className="py-4 px-4 font-semibold text-stone-800">{s?.name || 'অজানা বিষয়'}</td>
                        <td className="py-4 px-4 font-semibold text-[#6b4c9a]">{t?.name || 'অজানা শিক্ষক'}</td>
                        <td className="py-4 px-4 text-right"><button onClick={() => removePreferred(p.id)} className="text-sm font-bold uppercase tracking-wider text-[#b4483e] hover:underline">মুছুন</button></td>
                      </tr>
                    )
                  })}
                  {preferredAssignments.length === 0 && (
                    <tr><td colSpan={4} className="py-10 text-center text-base font-medium text-stone-400 italic">কোনো ওভাররাইড সেট করা নেই।</td></tr>
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
// VIEW TAB COMPONENTS
// ---------------------------------------------------------------------------

interface ViewTabProps {
  days: string[]
  classes: ClassData[]
  teachers: TeacherData[]
  result: GenerationResult | null
  onGenerate: () => void
  maxClassPeriods: number
}

function ViewTab({ days, classes, teachers, result, onGenerate, maxClassPeriods }: ViewTabProps) {
  const [mode, setMode] = useState<string>('all_teachers')
  const [selectedTeacher, setSelectedTeacher] = useState<string>('')
  const [selectedClassSection, setSelectedClassSection] = useState<string>('')

  if (!result) return null

  const teacherRoutines = useMemo(() => buildTeacherRoutines(result.entries, teachers), [result, teachers])
  const classRoutines = useMemo(() => buildClassRoutines(days, classes, result.entries, result.unscheduled), [days, classes, result])

  const classSectionOptions = classes.flatMap((c) => (c.sections.length > 0 ? c.sections.map((s) => ({ key: `${c.id}::${s}`, label: `${c.name} ${s}`, periodsPerDay: c.periodsPerDay })) : [{ key: `${c.id}::`, label: c.name, periodsPerDay: c.periodsPerDay }]))

  const activeTeacher = selectedTeacher || teachers[0]?.id || ''
  const activeClassSection = selectedClassSection || classSectionOptions[0]?.key || ''

  const statusStyles: Record<string, string> = {
    success: 'bg-[#f2f7ee] text-[#4a6b3a] border border-[#d9e6cd]',
    success_with_warnings: 'bg-[#fdf6ec] text-[#9a6a1f] border border-[#f0dfc0]',
    no_valid_solution: 'bg-[#fcf2f1] text-[#b4483e] border border-[#f2d5d2]',
  }
  const statusLabel: Record<string, string> = {
    success: 'সফলভাবে তৈরি হয়েছে',
    success_with_warnings: 'তৈরি হয়েছে — কিছু পিরিয়ডে এখনো শিক্ষক প্রয়োজন',
    no_valid_solution: 'কিছুই শিডিউল করা যায়নি',
  }

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-sm shadow-sm border border-stone-200 p-6 md:p-8 print:hidden">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div className="flex gap-3 flex-wrap items-center">
            <span className={`text-sm font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm ${statusStyles[result.status]}`}>
              {statusLabel[result.status]}
            </span>
            <span className="text-base font-medium text-stone-500">{engToBng(result.totalRequired)} টির মধ্যে {engToBng(result.totalScheduled)} টি লেসন বসানো হয়েছে</span>
          </div>
          <button onClick={onGenerate} className="bg-white border border-stone-300 text-stone-800 px-6 py-3 rounded-sm text-sm uppercase tracking-widest font-bold hover:bg-stone-50 transition-colors shadow-sm">
            পুনরায় তৈরি ও সাফল করুন
          </button>
        </div>

        {result.unscheduled.length > 0 && (
          <div className="mt-6 p-5 bg-[#fcf2f1] border border-[#f2d5d2] rounded-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#b4483e] mb-3">শিডিউল না হওয়া পিরিয়ড (শিক্ষক নেই)</h3>
            <ul className="text-base font-medium text-[#8f3a32] space-y-2 max-h-40 overflow-y-auto">
              {result.unscheduled.map((u, i) => (
                <li key={i} className="flex flex-wrap items-start gap-2">
                  <span className="shrink-0 bg-white border border-[#f2d5d2] text-[#b4483e] text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm shadow-sm">নেই</span>
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
              <label className="block text-sm font-bold uppercase tracking-wider text-stone-700 mb-2">ভিউ</label>
              <Dropdown
                options={[
                  { label: 'একযোগে সব শিক্ষক', value: 'all_teachers' },
                  { label: 'নির্দিষ্ট শিক্ষক', value: 'teacher' },
                  { label: 'নির্দিষ্ট ক্লাস / শাখা', value: 'class' },
                ]}
                value={mode}
                onChange={(v) => setMode(String(v))}
              />
            </div>

            {mode === 'teacher' && (
              <div className="w-64">
                <label className="block text-sm font-bold uppercase tracking-wider text-stone-700 mb-2">শিক্ষক</label>
                <Dropdown
                  options={teachers.map((t) => ({ label: t.name, value: t.id }))}
                  value={activeTeacher || null}
                  onChange={(v) => setSelectedTeacher(String(v))}
                  placeholder="শিক্ষক নির্বাচন করুন"
                  hasSearch
                />
              </div>
            )}
            
            {mode === 'class' && (
              <div className="w-64">
                <label className="block text-sm font-bold uppercase tracking-wider text-stone-700 mb-2">ক্লাস / শাখা</label>
                <Dropdown
                  options={classSectionOptions.map((o) => ({ label: o.label, value: o.key }))}
                  value={activeClassSection || null}
                  onChange={(v) => setSelectedClassSection(String(v))}
                  placeholder="ক্লাস নির্বাচন করুন"
                  hasSearch
                />
              </div>
            )}
          </div>
          <button onClick={() => window.print()} className="bg-stone-900 text-white px-6 py-3.5 rounded-sm text-sm uppercase tracking-widest font-bold hover:bg-stone-800 transition-colors shadow-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            পিডিএফ ডাউনলোড / প্রিন্ট করুন
          </button>
        </div>

        <div id="printable-routine" className="space-y-12">
          {mode === 'all_teachers' && (
            <>
              <h2 className="text-xl font-black text-center uppercase tracking-wide mb-2 text-stone-900 border-b border-stone-200 pb-4">মাস্টার শিক্ষক রুটিন</h2>
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

interface TeacherWorkloadSummaryProps {
  entries: RoutineEntry[]
  teachers: TeacherData[]
  days: string[]
  maxClassPeriods: number
}

function TeacherWorkloadSummary({ entries, teachers, days, maxClassPeriods }: TeacherWorkloadSummaryProps) {
  const stats = useMemo(() => {
    const counts = new Map<string, number>()
    entries.forEach(e => {
      if (e.teacherId) counts.set(e.teacherId, (counts.get(e.teacherId) || 0) + 1)
    })
    
    return teachers.map(t => {
      const assigned = counts.get(t.id) || 0
      const maxCap = Math.min(t.maxPeriodsPerDay, maxClassPeriods) * days.length
      const utilization = maxCap > 0 ? Math.round((assigned / maxCap) * 100) : 0
      return { ...t, assigned, maxCap, utilization }
    }).sort((a, b) => b.utilization - a.utilization)
  }, [entries, teachers, days, maxClassPeriods])

  return (
    <section className="bg-white rounded-sm shadow-sm border border-stone-200 p-6 md:p-8 print:hidden">
      <h2 className="text-xl font-semibold text-stone-900 uppercase tracking-wide mb-4">শিক্ষকদের কাজের চাপের সারসংক্ষেপ</h2>
      <div className="overflow-x-auto border border-stone-200 shadow-sm rounded-sm">
        <table className="w-full text-base text-left">
          <thead className="border-b border-stone-200 bg-stone-50">
            <tr>
              <th className="py-3 px-6 text-sm font-bold uppercase tracking-wider text-stone-500">শিক্ষক</th>
              <th className="py-3 px-6 text-sm font-bold uppercase tracking-wider text-stone-500">অ্যাসাইনকৃত পিরিয়ড</th>
              <th className="py-3 px-6 text-sm font-bold uppercase tracking-wider text-stone-500">সর্বোচ্চ ধারণক্ষমতা</th>
              <th className="py-3 px-6 text-sm font-bold uppercase tracking-wider text-stone-500">ব্যবহার</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {stats.map(s => (
              <tr key={s.id} className="hover:bg-stone-50/50 transition-colors">
                <td className="py-4 px-6 font-bold text-stone-800">{s.name}</td>
                <td className="py-4 px-6 font-black text-stone-900">{engToBng(s.assigned)}</td>
                <td className="py-4 px-6 font-bold text-stone-600">{engToBng(s.maxCap)}</td>
                <td className="py-4 px-6">
                  <div className="flex items-center gap-3">
                    <div className="w-full bg-stone-200 rounded-full h-2.5 max-w-[120px] shadow-inner">
                      <div className="bg-[#6b4c9a] h-2.5 rounded-full" style={{ width: `${s.utilization}%` }}></div>
                    </div>
                    <span className="text-sm font-black text-stone-600">{engToBng(s.utilization)}%</span>
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

interface TeacherGridProps {
  days: string[]
  periods: number
  entries: RoutineEntry[]
  title: string
  compact?: boolean
}

function TeacherGrid({ days, periods, entries, title, compact = false }: TeacherGridProps) {
  const periodList = Array.from({ length: periods }, (_, i) => i + 1)
  const at = (day: string, period: number) => entries.find((e) => e.day === day && e.period === period)

  return (
    <div className={`break-inside-avoid ${compact ? 'mb-8' : ''}`}>
      <h3 className={`${compact ? 'text-lg mb-3 text-left border-b border-stone-200 pb-2' : 'text-2xl text-center mb-6'} font-black uppercase tracking-wide text-stone-900`}>
        {title}
      </h3>
      <div className="overflow-x-auto rounded-sm border border-stone-200 shadow-sm print:border-stone-400">
        <table className="w-full border-collapse text-base text-center table-fixed min-w-[600px]">
          <thead className="bg-stone-100 print:bg-stone-100">
            <tr>
              <th className="border border-stone-200 print:border-stone-400 p-2.5 text-xs font-bold uppercase tracking-widest text-stone-600 print:text-stone-700 w-24">দিন</th>
              {periodList.map((p) => <th key={p} className="border border-stone-200 print:border-stone-400 p-2.5 text-xs font-bold uppercase tracking-widest text-stone-600 print:text-stone-700">পিরিয়ড {engToBng(p)}</th>)}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day} className="hover:bg-stone-50/50 print:bg-white transition-colors">
                <td className="border border-stone-200 print:border-stone-400 p-3 font-bold text-stone-800 text-sm uppercase tracking-widest bg-stone-50 print:bg-stone-50">{DAY_SHORT_BN[day]}</td>
                {periodList.map((p) => {
                  const e = at(day, p)
                  return (
                    <td key={p} className="border border-stone-200 print:border-stone-400 p-2 break-words bg-white align-middle">
                      {e ? (
                        <div className="px-1 flex flex-col items-center justify-center gap-1">
                          <div className="font-bold text-stone-900 text-sm leading-tight print:text-black">{e.subject}</div>
                          <div className="text-xs uppercase tracking-widest text-white bg-[#6b4c9a] print:bg-transparent print:text-stone-600 font-bold px-1.5 py-0.5 rounded-sm print:border print:border-stone-300 inline-block shadow-sm print:shadow-none">{e.className}{e.section}</div>
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

interface ClassGridProps {
  days: string[]
  periods: number
  entries: RoutineEntry[]
  title: string
}

function ClassGrid({ days, periods, entries, title }: ClassGridProps) {
  const periodList = Array.from({ length: periods }, (_, i) => i + 1)
  const at = (day: string, period: number) => entries.find((e) => e.day === day && e.period === period)

  return (
    <div className="break-inside-avoid">
      <h2 className="text-2xl font-black text-center uppercase tracking-wide mb-6 text-stone-900">{title} — সাপ্তাহিক রুটিন</h2>
      <div className="overflow-x-auto rounded-sm border border-stone-200 shadow-sm print:border-stone-400">
        <table className="w-full border-collapse text-base text-center table-fixed min-w-[600px]">
          <thead className="bg-stone-100 print:bg-stone-100">
            <tr>
              <th className="border border-stone-200 print:border-stone-400 p-3 text-xs font-bold uppercase tracking-widest text-stone-600 print:text-stone-700 w-24">দিন</th>
              {periodList.map((p) => <th key={p} className="border border-stone-200 print:border-stone-400 p-3 text-xs font-bold uppercase tracking-widest text-stone-600 print:text-stone-700">পিরিয়ড {engToBng(p)}</th>)}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day} className="hover:bg-stone-50/50 print:bg-white transition-colors">
                <td className="border border-stone-200 print:border-stone-400 p-3 font-bold text-stone-800 uppercase tracking-widest bg-stone-50 print:bg-stone-50 text-sm">{DAY_SHORT_BN[day]}</td>
                {periodList.map((p) => {
                  const e = at(day, p)
                  return (
                    <td key={p} className="border border-stone-200 print:border-stone-400 p-2 break-words bg-white align-middle">
                      {e ? (
                        e.isPlaceholder ? (
                          <div className="bg-[#fcf2f1] print:bg-stone-100 border border-[#f2d5d2] print:border-stone-300 rounded-sm py-1.5 px-1 mx-auto w-full max-w-[120px] shadow-sm print:shadow-none">
                            <div className="font-bold text-[#b4483e] print:text-stone-500 text-xs uppercase tracking-widest leading-none mb-1">নেই</div>
                            <div className="text-sm text-[#8f3a32] print:text-stone-700 font-bold">{e.subject}</div>
                          </div>
                        ) : (
                          <div className="px-1 flex flex-col items-center justify-center gap-1">
                            <div className="font-bold text-stone-900 text-sm leading-tight print:text-black">{e.subject}</div>
                            <div className="text-[11px] text-[#6b4c9a] print:text-stone-600 font-bold leading-tight uppercase tracking-wider">{e.teacherName}</div>
                          </div>
                        )
                      ) : (
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-stone-300 print:text-stone-300 font-medium">—</span>
                          <span className="text-xs text-stone-400 font-bold uppercase tracking-widest mt-1 print:hidden">ফাঁকা পিরিয়ড</span>
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