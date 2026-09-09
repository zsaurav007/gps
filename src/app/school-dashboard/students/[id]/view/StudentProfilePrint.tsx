'use client'

import Link from 'next/link'
import React from 'react'

// ==========================================
// HELPERS
// ==========================================
const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const translateBanking = (val: string | null | undefined) => {
  if (val === 'bKash') return 'বিকাশ'
  if (val === 'Nagad') return 'নগদ'
  return val || 'None'
}

/**
 * Smart Text Formatter:
 * Automatically detects Bengali characters and increases their font size 
 * by 20% on screen views to improve readability. Keeps English size unchanged.
 * Completely resets sizing for printing/PDF so the document remains perfectly scaled.
 */
const formatMixedText = (val: string | number | null | undefined) => {
  if (val === null || val === undefined) return val;
  const text = String(val);
  
  // Split string by Bengali unicode blocks
  const parts = text.split(/([\u0980-\u09FF]+)/);
  if (parts.length === 1) return text; 
  
  return parts.map((part, index) => {
    if (/[\u0980-\u09FF]/.test(part)) {
      return (
        <span key={index} className="text-[1.2em] print:text-[1em]">
          {part}
        </span>
      );
    }
    return part;
  });
}

// ==========================================
// ACTION ICONS
// ==========================================
const Icons = {
  Print: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>,
  Back: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>,
}

// ==========================================
// DOCUMENT UI COMPONENTS
// ==========================================
const PrintField = ({ label, value, className = "" }: { label: string, value: string | undefined | null, className?: string }) => (
  <div className={`flex items-baseline gap-2 ${className}`}>
    <span className="font-semibold text-gray-600 whitespace-nowrap text-[11px]">{formatMixedText(label)}:</span>
    <span className="font-bold text-black leading-tight text-[13px] flex-1 min-h-[18px]">
      {value ? formatMixedText(value) : '-'}
    </span>
  </div>
)

const PrintSectionHeader = ({ title }: { title: string }) => (
  <div className="border-b border-gray-300 pb-1 mt-6 mb-4 font-bold text-[13px] tracking-wide text-gray-900 uppercase break-inside-avoid">
    {formatMixedText(title)}
  </div>
)

// ==========================================
// MAIN COMPONENT
// ==========================================
export default function StudentProfilePrint({
  student,
  className,
  schoolName,
  headmasterName,
  schoolAddress
}: {
  student: any;
  className: string;
  schoolName: string;
  headmasterName: string;
  schoolAddress: string;
}) {
  const hasGuardian = Boolean(student.guardian_name_en || student.guardian_name_bn || student.guardian_mobile)

  return (
    <div className="w-full font-sans relative print:static z-10 pb-20 print:pb-0 print:bg-white print:overflow-visible">

      {/* Action Buttons Toolbar - Hidden on Print */}
      <div className="max-w-[210mm] mx-auto flex flex-wrap justify-between items-center gap-3 mb-6 relative z-20 print:hidden">
        <Link 
          href="/school-dashboard/students" 
          className="bg-white border border-stone-200 text-stone-600 px-5 py-3 rounded-sm text-[10px] uppercase tracking-widest font-bold hover:bg-stone-50 hover:text-stone-900 transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          {Icons.Back}
          Back to Directory
        </Link>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/school-dashboard/students/${student.id}/edit`}
            className="text-center bg-white border border-stone-200 text-[#6b4c9a] px-6 py-3.5 rounded-sm text-[10px] uppercase tracking-widest font-bold hover:bg-[#fbf9fc] hover:border-[#dad3e3] transition-colors shadow-sm"
          >
            Edit Profile
          </Link>
          <button
            onClick={() => window.print()}
            className="bg-[#6b4c9a] text-white border border-transparent px-6 py-3.5 rounded-sm text-[10px] uppercase tracking-widest font-bold hover:bg-[#5a3f82] transition-colors shadow-sm flex items-center justify-center gap-2 group"
          >
            <span className="text-white/80 group-hover:text-white transition-colors">{Icons.Print}</span> Print Document
          </button>
        </div>
      </div>

      {/* 
        Strictly configured Print Styles 
      */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          * { box-sizing: border-box; }
          
          /* Force the body to have height so the absolute child renders */
          html, body {
            min-height: 100vh;
            margin: 0;
            padding: 0;
          }
          
          /* Hide EVERYTHING on the page by default */
          body * {
            visibility: hidden;
          }
          
          /* Make ONLY the print document and its children visible */
          #student-profile-print-page, #student-profile-print-page * {
            visibility: visible;
          }
          
          /* 
            Forces the document to absolute center vertically and horizontally 
            bottom: 0 and height: max-content perfectly centers it in PDF.
          */
          #student-profile-print-page {
            position: absolute;
            left: 0;
            right: 0;
            top: 0;
            bottom: 0;
            margin: auto !important; 
            width: 100% !important;
            max-width: 190mm !important; 
            height: max-content !important; 
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            page-break-after: avoid;
            page-break-before: avoid;
          }
          
          #student-profile-print-page * {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `,
        }}
      />

      {/* 
        THE DOCUMENT ("DIGITAL PAPER")
      */}
      <div
        id="student-profile-print-page"
        className="flex flex-col w-full max-w-[210mm] min-h-[297mm] mx-auto bg-white text-black font-sans leading-tight shadow-xl border border-stone-200 p-8 md:p-12 print:shadow-none print:border-none print:p-0 print:max-w-none print:min-h-0"
      >
        {/* PDF Document Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start mb-2 border-b-2 border-black pb-4 gap-4">

          <div className="w-full sm:w-[33%]">
            <span className="text-[10px] font-bold text-gray-800 uppercase tracking-widest block mb-2 border-b border-gray-300 pb-1 w-max">Office Registration</span>
            <div className="flex flex-col gap-1.5">
              <PrintField label="শ্রেণি" value={className} />
              <PrintField label="রোল" value={student.enrollment_id} />
              <PrintField label="ভর্তির বছর" value={student.admission_year} />
              <PrintField label="পূর্ববর্তী রোল" value={student.previous_roll} />
            </div>
          </div>

          <div className="w-full sm:w-[44%] text-center pt-2">
            <h1 className="text-[10px] font-bold text-gray-600">{formatMixedText("গণপ্রজাতন্ত্রী বাংলাদেশ সরকার")}</h1>
            <h2 className="text-[18px] md:text-[20px] font-black mt-0.5 leading-tight">{formatMixedText(schoolName)}</h2>
            <p className="text-[10px] mt-0.5 text-gray-600">{formatMixedText(schoolAddress)}</p>
          </div>

          <div className="w-full sm:w-[20%] flex justify-start sm:justify-end">
            <div className="w-[90px] h-[90px] border border-gray-300 p-0.5 rounded-sm flex items-center justify-center bg-gray-50 shrink-0">
              {student.photo_url ? (
                <img src={student.photo_url} alt="ছবি" className="w-full h-full object-cover" />
              ) : (
                <span className="text-gray-400 text-[10px] font-bold tracking-widest">{formatMixedText("ছবি")}</span>
              )}
            </div>
          </div>
        </div>

        {/* 1. Student Info */}
        <PrintSectionHeader title="শিক্ষার্থীর তথ্য (Student Information)" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-3 px-1">
          <div className="flex flex-col gap-3">
             <PrintField label="নাম (বাংলায়)" value={student.name_bangla} />
             <PrintField label="জন্ম নিবন্ধন নং" value={student.birth_reg_no} />
             <PrintField label="গ্রাম" value={student.village} />
          </div>
          <div className="flex flex-col gap-3">
             <PrintField label="ইংরেজিতে" value={student.first_name} />
             <PrintField label="জন্ম তারিখ" value={formatDate(student.date_of_birth)} />
             <PrintField label="ডাকঘর" value={student.post_office} />
          </div>
          <div className="flex flex-col gap-3">
             <PrintField label="লিঙ্গ ও রক্ত" value={`${student.gender || '-'} / ${student.blood_group || '-'}`} />
             <PrintField label="উপজেলা" value={student.upazila} />
             <PrintField label="জেলা" value={student.district || "বগুড়া"} />
          </div>
        </div>

        {/* 2. Father Info */}
        <PrintSectionHeader title="পিতার তথ্য (Father's Information)" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-3 px-1">
          <div className="flex flex-col gap-3">
             <PrintField label="নাম (বাংলায়)" value={student.father_name_bn} />
             <PrintField label="Smart Card" value={student.father_nid} />
             <PrintField label="পিতার নাম" value={student.father_father_name} />
             <PrintField label="গ্রাম" value={student.father_village} />
          </div>
          <div className="flex flex-col gap-3">
             <PrintField label="ইংরেজিতে" value={student.father_name_en} />
             <PrintField label="শিক্ষাগত যোগ্যতা" value={student.father_edu} />
             <PrintField label="মাতার নাম" value={student.father_mother_name} />
             <PrintField label="ডাকঘর" value={student.father_post_office} />
          </div>
          <div className="flex flex-col gap-3">
             <PrintField label="জন্ম তারিখ" value={formatDate(student.father_dob)} />
             <div className="hidden sm:block min-h-[18px]"></div>
             <PrintField label="উপজেলা" value={student.father_upazila} />
             <PrintField label="পোস্ট কোড" value={student.father_post_code} />
          </div>
        </div>

        {/* 3. Mother Info */}
        <PrintSectionHeader title="মাতার তথ্য (Mother's Information)" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-3 px-1">
          <div className="flex flex-col gap-3">
             <PrintField label="নাম (বাংলায়)" value={student.mother_name_bn} />
             <PrintField label="Smart Card" value={student.mother_nid} />
             <PrintField label="পিতার নাম" value={student.mother_father_name} />
             <PrintField label="গ্রাম" value={student.mother_village} />
          </div>
          <div className="flex flex-col gap-3">
             <PrintField label="ইংরেজিতে" value={student.mother_name_en} />
             <PrintField label="শিক্ষাগত যোগ্যতা" value={student.mother_edu} />
             <PrintField label="মাতার নাম" value={student.mother_mother_name} />
             <PrintField label="ডাকঘর" value={student.mother_post_office} />
          </div>
          <div className="flex flex-col gap-3">
             <PrintField label="জন্ম তারিখ" value={formatDate(student.mother_dob)} />
             <div className="hidden sm:block min-h-[18px]"></div>
             <PrintField label="উপজেলা" value={student.mother_upazila} />
             <PrintField label="পোস্ট কোড" value={student.mother_post_code} />
          </div>
        </div>

        {/* 4. Guardian Info */}
        {hasGuardian && (
          <>
            <PrintSectionHeader title="অভিভাবকের তথ্য (Guardian's Information)" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-3 px-1">
              <div className="flex flex-col gap-3">
                 <PrintField label="নাম (বাংলায়)" value={student.guardian_name_bn} />
                 <PrintField label="সম্পর্ক" value={student.guardian_relation} />
                 <PrintField label="গ্রাম" value={student.guardian_village} />
              </div>
              <div className="flex flex-col gap-3">
                 <PrintField label="ইংরেজিতে" value={student.guardian_name_en} />
                 <PrintField label="Smart Card" value={student.guardian_nid} />
                 <PrintField label="ডাকঘর" value={student.guardian_post_office} />
              </div>
              <div className="flex flex-col gap-3">
                 <PrintField label="শিক্ষাগত যোগ্যতা" value={student.guardian_edu} />
                 <PrintField label="উপজেলা" value={student.guardian_upazila} />
                 <PrintField label="পোস্ট কোড" value={student.guardian_post_code} />
              </div>
            </div>
          </>
        )}

        {/* 5. Mobile & Banking */}
        <PrintSectionHeader title="মোবাইল নম্বর ও ব্যাংকিং (Contact & Banking)" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-4 px-1 mt-2">
          <div className="flex flex-col gap-2">
            <span className="font-semibold text-gray-600 text-[11px] block border-b border-gray-200 pb-1">{formatMixedText("পিতার মোবাইল")}</span>
            <span className="font-black text-[15px] tracking-widest text-black block leading-none">{student.father_mobile || '-'}</span>
            <span className="font-medium text-[10px] text-gray-500 block">
              {formatMixedText("ব্যাংকিং অপারেটর")}: <strong className="text-black font-bold ml-1">{formatMixedText(translateBanking(student.father_mobile_banking))}</strong>
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-semibold text-gray-600 text-[11px] block border-b border-gray-200 pb-1">{formatMixedText("মাতার মোবাইল")}</span>
            <span className="font-black text-[15px] tracking-widest text-black block leading-none">{student.mother_mobile || '-'}</span>
            <span className="font-medium text-[10px] text-gray-500 block">
              {formatMixedText("ব্যাংকিং অপারেটর")}: <strong className="text-black font-bold ml-1">{formatMixedText(translateBanking(student.mother_mobile_banking))}</strong>
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-semibold text-gray-600 text-[11px] block border-b border-gray-200 pb-1">{formatMixedText("অভিভাবকের মোবাইল")}</span>
            <span className="font-black text-[15px] tracking-widest text-black block leading-none">{student.guardian_mobile || student.guardian_phone || '-'}</span>
            <span className="font-medium text-[10px] text-gray-500 block">
              {formatMixedText("ব্যাংকিং অপারেটর")}: <strong className="text-black font-bold ml-1">{formatMixedText(translateBanking(student.guardian_mobile_banking))}</strong>
            </span>
          </div>
        </div>

        {/* 6. Signatures */}
        <div className="mt-auto pt-16 flex flex-col sm:flex-row justify-between items-end gap-8 px-6">
          <div className="text-center w-full sm:w-auto">
            <div className="border-b-2 border-black w-40 mx-auto mb-1.5"></div>
            <span className="font-bold text-[13px] block">{formatMixedText("অভিভাবকের স্বাক্ষর")}</span>
            <span className="block text-[10px] mt-1 text-gray-600 font-medium">{formatMixedText("তারিখ: ...../......./২০....")}</span>
          </div>
          <div className="text-center w-full sm:w-auto">
            <span className="font-black text-[16px] block">{formatMixedText(headmasterName)}</span>
            <span className="font-bold text-[12px] block text-gray-800">{formatMixedText("প্রধান শিক্ষক")}</span>
            <span className="font-medium text-[11px] block text-gray-600">{formatMixedText(schoolName)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}