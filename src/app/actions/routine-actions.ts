// routine-actions.ts
//
// Pure, in-memory scheduling logic. No database, no server calls — every
// class, subject, teacher and assignment lives in React state in
// RoutineBuilderClient and is passed into these functions directly.
//
// generateRoutine() is the one function that matters: it takes everything
// you entered manually and produces two things at once —
//   1. a combined weekly routine per teacher (every class/section they teach)
//   2. a separate weekly routine per class/section
// from the SAME underlying placement, so the two views can never disagree.

// ---------------------------------------------------------------------------
// Shapes (plain objects, not enforced by a compiler unless you use .ts)
// ---------------------------------------------------------------------------
//
// ClassInfo:        { id, name, periodsPerDay, sections: string[] }  // sections: [] means no sections
// SubjectRequirement:{ id, classId, section, subject, periodsPerWeek }
// Teacher:          { id, name, maxPeriodsPerDay }
// Assignment:       { id, teacherId, classId, section, subject }
//
// generateRoutine(days, classes, requirements, teachers, assignments) returns:
// {
//   status: 'success' | 'success_with_warnings' | 'no_valid_solution',
//   totalRequired, totalScheduled,
//   unscheduled: [{ classId, className, section, subject, reason }],
//   entries: [{ day, period, classId, className, section, subject, teacherId, teacherName }]
// }

const sectionKey = (classId, section) => `${classId}::${section || ''}`
const slotKey = (day, period, ...rest) => [day, period, ...rest].join('::')

/**
 * Basic sanity checks before generating (missing teacher for a subject,
 * a class needing more lessons/week than it has slots for). Returns
 * human-readable warnings — nothing here blocks generation, it just helps
 * you spot gaps you might have missed while entering data manually.
 */
export function analyzeSetup(days, classes, requirements, teachers, assignments) {
  const warnings = []

  for (const cls of classes) {
    const sections = cls.sections.length > 0 ? cls.sections : ['']
    for (const section of sections) {
      const reqs = requirements.filter((r) => r.classId === cls.id && (r.section || '') === section)
      const totalRequired = reqs.reduce((sum, r) => sum + Number(r.periodsPerWeek || 0), 0)
      const availableSlots = days.length * cls.periodsPerDay

      if (reqs.length === 0) {
        warnings.push(`${cls.name}${section} has no subjects added yet.`)
        continue
      }

      if (totalRequired > availableSlots) {
        warnings.push(
          `${cls.name}${section} needs ${totalRequired} periods/week but only has ${availableSlots} slots (${cls.periodsPerDay}/day × ${days.length} days).`
        )
      }

      for (const req of reqs) {
        if (!req.periodsPerWeek || req.periodsPerWeek <= 0) {
          warnings.push(`${cls.name}${section} — ${req.subject} has 0 periods/week set.`)
          continue
        }
        const qualified = assignments.filter(
          (a) => a.classId === cls.id && (a.section || '') === section && a.subject === req.subject
        )
        if (qualified.length === 0) {
          warnings.push(`${cls.name}${section} — ${req.subject} has no teacher assigned.`)
        }
      }
    }
  }

  if (teachers.length === 0) warnings.push('No teachers added yet.')
  if (classes.length === 0) warnings.push('No classes added yet.')

  return warnings
}

/**
 * The generator. Greedy placement, scarcest lessons first, with a small
 * bounded backtrack when a placement collides with something already
 * scheduled. Not a full CSP solver — good enough for a school-sized
 * timetable, and any lesson it can't place comes back with a plain-English
 * reason instead of a silent failure.
 */
export function generateRoutine(days, classes, requirements, teachers, assignments) {
  const start = Date.now()
  const teacherById = new Map(teachers.map((t) => [t.id, t]))

  // Build the flat list of individual lessons that need a slot
  const lessons = []
  for (const cls of classes) {
    const sections = cls.sections.length > 0 ? cls.sections : ['']
    for (const section of sections) {
      const reqs = requirements.filter((r) => r.classId === cls.id && (r.section || '') === section)
      for (const req of reqs) {
        if (!req.periodsPerWeek || req.periodsPerWeek <= 0) continue
        const candidateTeachers = assignments
          .filter((a) => a.classId === cls.id && (a.section || '') === section && a.subject === req.subject)
          .map((a) => a.teacherId)
        for (let i = 0; i < req.periodsPerWeek; i++) {
          lessons.push({
            classId: cls.id,
            className: cls.name,
            periodsPerDay: cls.periodsPerDay,
            section,
            subject: req.subject,
            candidateTeachers,
          })
        }
      }
    }
  }

  // Scarcest lessons (fewest possible teachers) placed first
  lessons.sort((a, b) => a.candidateTeachers.length - b.candidateTeachers.length)

  const classSlotTaken = new Set() // day::period::classId::section
  const teacherSlotTaken = new Set() // day::period::teacherId
  const teacherDailyCount = new Map() // teacherId::day -> count
  const subjectDayUsed = new Map() // classId::section::subject -> Set(days used)

  const bump = (map, k, by = 1) => map.set(k, (map.get(k) || 0) + by)

  const entries = []
  const unscheduled = []

  function commit(entry) {
    entries.push(entry)
    classSlotTaken.add(slotKey(entry.day, entry.period, entry.classId, entry.section))
    teacherSlotTaken.add(slotKey(entry.day, entry.period, entry.teacherId))
    bump(teacherDailyCount, `${entry.teacherId}::${entry.day}`)
    const sdKey = `${entry.classId}::${entry.section}::${entry.subject}`
    if (!subjectDayUsed.has(sdKey)) subjectDayUsed.set(sdKey, new Set())
    subjectDayUsed.get(sdKey).add(entry.day)
  }

  function release(entry) {
    const idx = entries.indexOf(entry)
    if (idx >= 0) entries.splice(idx, 1)
    classSlotTaken.delete(slotKey(entry.day, entry.period, entry.classId, entry.section))
    teacherSlotTaken.delete(slotKey(entry.day, entry.period, entry.teacherId))
    bump(teacherDailyCount, `${entry.teacherId}::${entry.day}`, -1)
  }

  function tryPlace(lesson) {
    const sdKey = `${lesson.classId}::${lesson.section}::${lesson.subject}`
    const daysUsed = subjectDayUsed.get(sdKey) || new Set()

    // Prefer days this subject hasn't used yet, to spread it across the week
    const orderedDays = [...days].sort((a, b) => (daysUsed.has(a) ? 1 : 0) - (daysUsed.has(b) ? 1 : 0))

    for (const day of orderedDays) {
      for (let period = 1; period <= lesson.periodsPerDay; period++) {
        if (classSlotTaken.has(slotKey(day, period, lesson.classId, lesson.section))) continue

        for (const teacherId of lesson.candidateTeachers) {
          const teacher = teacherById.get(teacherId)
          if (!teacher) continue
          if (teacherSlotTaken.has(slotKey(day, period, teacherId))) continue
          const dailyCount = teacherDailyCount.get(`${teacherId}::${day}`) || 0
          if (dailyCount >= (teacher.maxPeriodsPerDay || 8)) continue

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
    }
    return null
  }

  const placedStack = []
  const RETRY_BUDGET = 2

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
          reason: `Displaced while placing ${lesson.subject} for ${lesson.className}${lesson.section}; no other free slot was found for ${victim.teacherName}.`,
        })
      }
      retries++
    }

    if (placed) {
      commit(placed)
      placedStack.push(placed)
    } else {
      const reason =
        lesson.candidateTeachers.length === 0
          ? `No teacher is assigned to teach ${lesson.subject} for ${lesson.className}${lesson.section}.`
          : `Every qualified teacher (${lesson.candidateTeachers
              .map((id) => teacherById.get(id)?.name || id)
              .join(', ')}) is already booked at every remaining slot for ${lesson.className}${lesson.section}.`
      unscheduled.push({
        classId: lesson.classId,
        className: lesson.className,
        section: lesson.section,
        subject: lesson.subject,
        reason,
      })
    }
  }

  const totalRequired = lessons.length
  const totalScheduled = entries.length
  const status = unscheduled.length === 0 ? 'success' : totalScheduled === 0 ? 'no_valid_solution' : 'success_with_warnings'

  return {
    status,
    totalRequired,
    totalScheduled,
    unscheduled,
    entries,
    generationTimeMs: Date.now() - start,
  }
}

/** Groups generated entries into one weekly grid per teacher (combined across all their classes/sections). */
export function buildTeacherRoutines(entries, teachers) {
  const byTeacher = new Map(teachers.map((t) => [t.id, []]))
  for (const e of entries) {
    if (!byTeacher.has(e.teacherId)) byTeacher.set(e.teacherId, [])
    byTeacher.get(e.teacherId).push(e)
  }
  return byTeacher
}

/** Groups generated entries into one weekly grid per class/section. */
export function buildClassRoutines(entries, classes) {
  const byClass = new Map()
  for (const cls of classes) {
    const sections = cls.sections.length > 0 ? cls.sections : ['']
    for (const section of sections) {
      byClass.set(sectionKey(cls.id, section), [])
    }
  }
  for (const e of entries) {
    const k = sectionKey(e.classId, e.section)
    if (!byClass.has(k)) byClass.set(k, [])
    byClass.get(k).push(e)
  }
  return byClass
}