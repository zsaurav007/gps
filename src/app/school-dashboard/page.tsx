import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { decrypt } from '@/lib/auth/jwt'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/LogoutButton'
import GlobalBroadcastBanner from '@/components/GlobalBroadcastBanner'

export const dynamic = 'force-dynamic'

// Minimalist, premium single-color SVG icons (Lightweight stroke)
const Icons = {
  Setup: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>,
  Teachers: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>,
  Routine: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>,
  Students: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.5" d="M12 14l9-5-9-5-9 5 9 5z"></path><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.5" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"></path><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.5" d="M12 14v7"></path></svg>,
  Exams: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>,
  Marks: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>,
  Reports: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>,
  Blood: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>,
  Lifecycle: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m-8 7v6m-4-3h8"></path></svg>
}

export default async function SchoolDashboardPage() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('school_session')?.value

  if (!sessionCookie) redirect('/login')

  const sessionData = await decrypt(sessionCookie)
  if (!sessionData) redirect('/login')

  const supabase = await createClient()

  // 1. Fetch Head Teacher
  const { data: currentUser } = await supabase
    .schema('gps')
    .from('school_users')
    .select('*')
    .eq('id', sessionData.userId)
    .single()

  if (!currentUser || !currentUser.is_active) redirect('/login?error=suspended')

  // 2. Fetch All Required Dashboard Data
  const [
    { data: school },
    { data: classes },
    { data: teachers },
    { data: students }
  ] = await Promise.all([
    supabase.schema('gps').from('schools').select('name').eq('id', sessionData.schoolId).single(),
    supabase.schema('gps').from('classes').select('id, name').eq('school_id', sessionData.schoolId).order('name'),
    supabase.schema('gps').from('teachers').select('id, full_name, birth_date, photo_url, blood_group').eq('school_id', sessionData.schoolId),
    supabase.schema('gps').from('students').select('id, first_name, last_name, date_of_birth, class_id, blood_group').eq('school_id', sessionData.schoolId)
  ])

  const totalTeachers = (teachers?.length || 0) + 1

  // ==========================================
  // Class Distribution Matrix
  // ==========================================
  const classBreakdown: Record<string, number> = {}
  let unassignedStudents = 0

  if (classes && classes.length > 0) {
    classes.forEach(c => {
      classBreakdown[c.name] = 0
    })

    if (students && students.length > 0) {
      students.forEach(student => {
        if (!student.class_id) {
          unassignedStudents += 1
          return
        }

        const matchedClass = classes.find(c => String(c.id) === String(student.class_id))
        if (matchedClass) {
          classBreakdown[matchedClass.name] += 1
        } else {
          unassignedStudents += 1
        }
      })
    }
  } else if (students && students.length > 0) {
    unassignedStudents = students.length
  }

  if (unassignedStudents > 0) {
    classBreakdown['Unassigned'] = unassignedStudents
  }

  // ==========================================
  // Accurate Birthday Parsing
  // ==========================================
  const today = new Date()
  const currentMonth = String(today.getMonth() + 1).padStart(2, '0')
  const currentDay = String(today.getDate()).padStart(2, '0')
  const todayTarget = `${currentMonth}-${currentDay}`

  const isBirthdayToday = (dateString: string | null | undefined) => {
    if (!dateString) return false
    const str = String(dateString)
    const match = str.match(/(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      return `${match[2]}-${match[3]}` === todayTarget
    }
    return false
  }

  const birthdayTeachers = teachers?.filter(t => isBirthdayToday(t.birth_date)) || []
  const birthdayStudents = students?.filter(s => isBirthdayToday(s.date_of_birth)) || []
  const isHeadTeacherBirthday = isBirthdayToday(currentUser.birth_date)

  // ==========================================
  // Global Blood Group Aggregation
  // ==========================================
  const bgCounts: Record<string, number> = {}
  let totalWithBloodGroup = 0

  const processBloodGroup = (bgString: string | null | undefined) => {
    if (bgString) {
      const bg = bgString.toString().trim().toUpperCase()
      if (bg !== '') {
        bgCounts[bg] = (bgCounts[bg] || 0) + 1
        totalWithBloodGroup++
      }
    }
  }

  if (students && students.length > 0) students.forEach(s => processBloodGroup(s.blood_group))
  if (teachers && teachers.length > 0) teachers.forEach(t => processBloodGroup(t.blood_group))
  processBloodGroup(currentUser.blood_group)

  // Desaturated Matte Colors (Purple Tones)
  const bgColors: Record<string, string> = {
    'A+': '#6b4c9a', 'A-': '#815ba4', 
    'B+': '#5c6b73', 'B-': '#7a8a92', 
    'O+': '#8c7b70', 'O-': '#a39489', 
    'AB+': '#706677', 'AB-': '#887e8f' 
  }

  let currentAngle = 0
  const conicGradientParts = Object.entries(bgCounts).map(([bg, count]) => {
    const percentage = (count / totalWithBloodGroup) * 100
    const color = bgColors[bg] || '#d6d3d1' 
    const part = `${color} ${currentAngle}% ${currentAngle + percentage}%`
    currentAngle += percentage
    return part
  }).join(', ')

  const pieChartStyle = totalWithBloodGroup > 0 
    ? { background: `conic-gradient(${conicGradientParts})` }
    : { background: '#f5f5f4' }

  // Bilingual Modules Configuration
  const modules = [
    { titleBn: "স্কুল সেটআপ", titleEn: "School Setup", descBn: "গ্লোবাল প্যারামিটার কনফিগার করুন।", descEn: "Configure global parameters.", href: "/school-dashboard/setup", icon: Icons.Setup },
    { titleBn: "স্টাফ ডিরেক্টরি", titleEn: "Staff Directory", descBn: "শিক্ষক প্রোফাইল পরিচালনা করুন।", descEn: "Manage teacher profiles.", href: "/school-dashboard/teachers", icon: Icons.Teachers }, 
    { titleBn: "ক্লাস রুটিন", titleEn: "Class Routines", descBn: "দৈনিক সময়সূচী ও পিরিয়ড।", descEn: "Daily schedules & periods.", href: "/school-dashboard/routine", icon: Icons.Routine }, 
    { titleBn: "শিক্ষার্থী তালিকা", titleEn: "Student Roster", descBn: "ভর্তি ও প্রোফাইল পরিচালনা।", descEn: "Enrollments & profiles.", href: "/school-dashboard/students", icon: Icons.Students }, 
    { titleBn: "পরীক্ষা কনফিগার", titleEn: "Exam Config", descBn: "টার্ম এবং বিষয় সেটআপ করুন।", descEn: "Setup terms and subjects.", href: "/school-dashboard/exams", icon: Icons.Exams }, 
    { titleBn: "মার্কস লেজার", titleEn: "Marks Ledger", descBn: "শিক্ষার্থীদের পরীক্ষার নম্বর ইনপুট।", descEn: "Input student exam scores.", href: "/school-dashboard/marks-entry", icon: Icons.Marks }, 
    { titleBn: "রিপোর্ট ইঞ্জিন", titleEn: "Report Engine", descBn: "রিপোর্ট কার্ড তৈরি করুন।", descEn: "Generate report cards.", href: "/school-dashboard/reports", icon: Icons.Reports }, 
    { titleBn: "রক্তের তথ্য", titleEn: "Blood Inventory", descBn: "রক্তদাতাদের তথ্য পরিচালনা।", descEn: "Manage donor demographics.", href: "/school-dashboard/blood-inventory", icon: Icons.Blood },
    { titleBn: "ডেটা লাইফসাইকেল", titleEn: "Data Lifecycle", descBn: "বছর শেষের রোলওভার ও আর্কাইভ।", descEn: "Year-end rollover & archives.", href: "/school-dashboard/lifecycle", icon: Icons.Lifecycle }
  ]

  return (
    <main className="min-h-screen bg-stone-50 p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* ========================================== */}
        {/* GLOBAL PLATFORM BROADCAST BANNER           */}
        {/* ========================================== */}
        <GlobalBroadcastBanner />

        {/* Header Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-6 md:p-8 rounded-sm shadow-sm border border-stone-200 border-t-4 border-t-[#6b4c9a] gap-5">
          <div>
            <div className="flex items-center gap-2 mb-2 leading-none">
              <span className="text-[14px] font-bold text-stone-800">প্রশাসনিক ড্যাশবোর্ড</span>
              <span className="text-[10px] font-bold tracking-[0.2em] text-stone-600 uppercase mt-0.5">/ Admin Dashboard</span>
            </div>
            {/* Rich purple gradient back on the School Name */}
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-wide bg-gradient-to-r from-[#4c2f74] via-[#6b4c9a] to-[#9b7ede] bg-clip-text text-transparent">
              {school?.name || 'স্কুল ওয়ার্কস্পেস'}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-4 shrink-0 sm:border-l sm:border-stone-200 sm:pl-6">
            <div className="flex flex-col items-end">
              <span className="text-[16px] font-bold tracking-wide text-stone-900 uppercase">{currentUser.full_name}</span>
              <div className="flex items-center gap-2 leading-none mt-1">
                <span className="text-[13px] font-bold text-[#6b4c9a]">প্রধান শিক্ষক</span>
                <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-[#6b4c9a] mt-0.5">/ Head Teacher</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-sm overflow-hidden border border-stone-200 bg-stone-100 flex items-center justify-center shrink-0">
              {currentUser.photo_url ? (
                <img src={currentUser.photo_url} alt="Head Teacher" className="w-full h-full object-cover" />
              ) : (
                <span className="text-stone-400 font-bold tracking-widest text-lg">{currentUser.full_name.charAt(0)}</span>
              )}
            </div>
            <div className="ml-1 pl-4 border-l border-stone-100">
              <LogoutButton />
            </div>
          </div>
        </div>

        {/* Top Analytics Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">

          {/* Quick Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:col-span-2">

            <div className="bg-white rounded-sm border border-stone-200 p-6 shadow-sm flex flex-col justify-center relative overflow-hidden group hover:border-[#6b4c9a]/50 hover:bg-gradient-to-br hover:from-white hover:to-[#f5effa] transition-all duration-300">
              <div className="flex justify-between items-start mb-4">
                <div className="flex flex-col gap-1.5 leading-none">
                  <span className="text-[16px] font-bold text-stone-900">মোট শিক্ষার্থী</span>
                  <span className="text-[10px] font-bold tracking-[0.2em] text-stone-600 uppercase">/ Total Students</span>
                </div>
                <div className="text-stone-400 transition-colors group-hover:text-[#6b4c9a]">
                  {Icons.Students}
                </div>
              </div>
              <p className="text-5xl font-black text-stone-900 tracking-wide mt-2">
                {students?.length || 0}
              </p>
            </div>

            <div className="bg-white rounded-sm border border-stone-200 p-6 shadow-sm flex flex-col justify-center relative overflow-hidden group hover:border-[#6b4c9a]/50 hover:bg-gradient-to-br hover:from-white hover:to-[#f5effa] transition-all duration-300">
              <div className="flex justify-between items-start mb-4">
                <div className="flex flex-col gap-1.5 leading-none">
                  <span className="text-[16px] font-bold text-stone-900">মোট শিক্ষক</span>
                  <span className="text-[10px] font-bold tracking-[0.2em] text-stone-600 uppercase">/ Total Faculty</span>
                </div>
                <div className="text-stone-400 transition-colors group-hover:text-[#6b4c9a]">
                  {Icons.Teachers}
                </div>
              </div>
              <p className="text-5xl font-black text-stone-900 tracking-wide mt-2">
                {totalTeachers}
              </p>
            </div>

            {/* Student Distribution Matrix */}
            <div className="bg-white rounded-sm border border-stone-200 p-6 shadow-sm col-span-1 sm:col-span-2 group hover:border-[#6b4c9a]/50 hover:bg-gradient-to-br hover:from-white hover:to-[#f5effa] transition-all duration-300">
              <div className="flex items-end flex-wrap gap-2.5 mb-5 leading-none">
                <span className="text-[18px] font-bold text-stone-900">শ্রেণিভিত্তিক শিক্ষার্থী</span>
                <span className="text-[10px] font-bold tracking-[0.2em] text-stone-600 uppercase mb-0.5">/ Students Per Class</span>
              </div>
              
              <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                {Object.entries(classBreakdown).map(([className, count]) => (
                  <div key={className} className={`shrink-0 border-l border-stone-200 px-4 py-3 min-w-[120px] transition-colors group-hover:bg-white/50 hover:bg-white ${className === 'Unassigned' ? 'bg-[#fcf8f8] border-[#b4483e]/30 group-hover:bg-[#fcf8f8]' : 'bg-transparent'}`}>
                    <p className={`text-[14px] font-bold tracking-widest mb-1.5 uppercase ${className === 'Unassigned' ? 'text-[#b4483e]' : 'text-stone-700'}`}>
                      {className === 'Unassigned' ? 'অনির্ধারিত / Unassigned' : `শ্রেণি ${className}`}
                    </p>
                    <p className={`text-2xl font-bold tracking-wide ${className === 'Unassigned' ? 'text-[#b4483e]' : 'text-stone-900'}`}>
                      {count} <span className="text-[11px] font-bold text-stone-500">জন</span>
                    </p>
                  </div>
                ))}
                {Object.keys(classBreakdown).length === 0 && <p className="text-[13px] font-bold text-stone-500 tracking-wide italic">কোনো ডেটা নেই / No class data available.</p>}
              </div>
            </div>
          </div>

          {/* Side Analytics Column */}
          <div className="space-y-6 lg:space-y-8">

            {/* Birthday Alert */}
            <div className="bg-white rounded-sm border border-stone-200 p-6 shadow-sm group hover:border-[#6b4c9a]/50 hover:bg-gradient-to-br hover:from-white hover:to-[#f5effa] transition-all duration-300">
              <div className="flex items-center gap-3 mb-5">
                <span className="text-stone-400 group-hover:scale-110 transition-transform text-xl">🎂</span>
                <div className="flex flex-col gap-1 leading-none">
                  <span className="text-[16px] font-bold text-stone-900">আজকের জন্মদিন</span>
                  <span className="text-[10px] font-bold tracking-[0.2em] text-stone-600 uppercase">/ Today's Birthdays</span>
                </div>
              </div>

              {!isHeadTeacherBirthday && birthdayStudents.length === 0 && birthdayTeachers.length === 0 ? (
                <p className="text-[13px] font-bold text-stone-500 tracking-wide">আজ কারও জন্মদিন নেই / No birthdays today.</p>
              ) : (
                <div className="space-y-3 max-h-[180px] overflow-y-auto custom-scrollbar pr-2">

                  {isHeadTeacherBirthday && (
                    <div className="flex items-center gap-3 bg-[#fbf9fc] p-3.5 rounded-sm border border-[#dad3e3] shadow-sm">
                      <div className="w-10 h-10 rounded-sm bg-white border border-[#dad3e3] text-[#6b4c9a] flex items-center justify-center text-lg shrink-0">👑</div>
                      <div className="min-w-0">
                        <div className="flex items-end flex-wrap gap-1.5 leading-none mb-1">
                          <span className="text-[12px] font-bold text-[#6b4c9a]">প্রধান শিক্ষক</span>
                          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b4c9a]/80">/ Head Teacher</span>
                        </div>
                        <p className="text-[15px] font-bold tracking-wide text-stone-900 uppercase truncate">{currentUser.full_name}</p>
                      </div>
                    </div>
                  )}

                  {birthdayTeachers.map(t => (
                    <div key={t.id} className="flex items-center gap-3 bg-white p-3.5 rounded-sm border border-stone-200 shadow-sm">
                      <div className="w-10 h-10 rounded-sm bg-stone-50 border border-stone-200 text-stone-500 flex items-center justify-center text-lg shrink-0">👨‍🏫</div>
                      <div className="min-w-0">
                        <div className="flex items-end flex-wrap gap-1.5 leading-none mb-1">
                          <span className="text-[12px] font-bold text-stone-700">শিক্ষক</span>
                          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-500">/ Faculty</span>
                        </div>
                        <p className="text-[15px] font-bold tracking-wide text-stone-900 uppercase truncate">{t.full_name}</p>
                      </div>
                    </div>
                  ))}
                  {birthdayStudents.map(s => (
                    <div key={s.id} className="flex items-center gap-3 bg-white p-3.5 rounded-sm border border-stone-200 shadow-sm">
                      <div className="w-10 h-10 rounded-sm bg-stone-50 border border-stone-200 text-stone-500 flex items-center justify-center text-lg shrink-0">🎓</div>
                      <div className="min-w-0">
                        <div className="flex items-end flex-wrap gap-1.5 leading-none mb-1">
                          <span className="text-[12px] font-bold text-stone-700">শিক্ষার্থী</span>
                          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-500">/ Student</span>
                        </div>
                        <p className="text-[15px] font-bold tracking-wide text-stone-900 uppercase truncate">{s.first_name} {s.last_name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Blood Group Demographics */}
            <div className="bg-white rounded-sm border border-stone-200 p-6 shadow-sm group hover:border-[#6b4c9a]/50 hover:bg-gradient-to-br hover:from-white hover:to-[#f5effa] transition-all duration-300">
              <div className="flex items-end flex-wrap gap-2.5 mb-6 leading-none">
                <span className="text-[16px] font-bold text-stone-900">প্রাতিষ্ঠানিক ডেমোগ্রাফিক্স</span>
                <span className="text-[10px] font-bold tracking-[0.2em] text-stone-600 uppercase mb-0.5">/ Demographics</span>
              </div>
              
              {totalWithBloodGroup > 0 ? (
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="w-16 h-16 rounded-full shrink-0 shadow-sm border border-stone-200 group-hover:scale-105 transition-transform duration-500" style={pieChartStyle}></div>
                  <div className="flex-1 w-full grid grid-cols-2 gap-x-4 gap-y-3.5">
                    {Object.entries(bgCounts).map(([bg, count]) => (
                      <div key={bg} className="flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-[1px]" style={{ backgroundColor: bgColors[bg] || '#a8a29e' }}></div>
                        <p className="text-[13px] font-bold tracking-wide text-stone-900">{bg} <span className="text-stone-500 ml-1 font-bold">({count})</span></p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-[13px] font-bold text-stone-500 tracking-wide">কোনো রক্তের গ্রুপের তথ্য নেই / No blood group data.</p>
              )}
            </div>
          </div>
        </div>

        {/* Master Modules Grid */}
        <div className="pt-4">
          <div className="flex items-center gap-4 mb-6">
            <h2 className="flex items-end gap-2.5 leading-none">
              <span className="text-[20px] font-bold text-stone-900">কন্ট্রোল সেন্টার</span>
              <span className="text-[11px] font-bold text-stone-600 tracking-[0.2em] uppercase mb-0.5">/ Control Center</span>
            </h2>
            <div className="h-[2px] bg-stone-200 flex-1"></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {modules.map((mod, idx) => (
              <Link key={idx} href={mod.href} className="group block h-full">
                {/* Purple Hover Gradient to the Module Cards */}
                <div className="h-full p-6 rounded-sm bg-white border border-stone-200 transition-all duration-300 flex flex-col justify-between shadow-sm hover:border-[#6b4c9a]/50 hover:bg-gradient-to-br hover:from-white hover:to-[#f5effa] hover:shadow-md hover:-translate-y-1">
                  <div>
                    <div className="w-12 h-12 mb-5 rounded-sm bg-stone-50 text-[#6b4c9a] border border-stone-200 flex items-center justify-center group-hover:bg-[#6b4c9a] group-hover:text-white transition-colors duration-300 shadow-sm">
                      {mod.icon}
                    </div>
                    
                    <div className="flex items-end flex-wrap gap-1.5 leading-none mb-3">
                      <h3 className="text-[17px] font-bold text-stone-900">{mod.titleBn}</h3>
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-600 mb-0.5">/ {mod.titleEn}</span>
                    </div>

                    <p className="text-[13px] font-bold text-stone-800 leading-relaxed mb-1.5">
                      {mod.descBn}
                    </p>
                    <p className="text-[11px] font-semibold text-stone-600 leading-relaxed italic">
                      {mod.descEn}
                    </p>
                  </div>
                  
                  <div className="mt-8 flex justify-between items-center text-[12px] font-bold text-[#6b4c9a]/80 group-hover:text-[#6b4c9a] transition-colors duration-300">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[12px]">মডিউল খুলুন</span>
                      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b4c9a]/80 mt-0.5">/ Open</span>
                    </span>
                    <span className="text-lg font-normal leading-none opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">&rarr;</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </main>
  )
}