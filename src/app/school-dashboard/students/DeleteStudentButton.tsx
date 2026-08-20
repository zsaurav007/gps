'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteStudent, getStudentPhotoUrl } from '@/app/actions/student-actions'
import { getCloudinaryDeleteAuth } from '@/app/actions/cloudinary-actions'

export default function DeleteStudentButton({ studentId, studentName }: { studentId: string, studentName: string }) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to permanently delete ${studentName}?`)) return
    
    setIsDeleting(true)

    try {
      // 1. Fetch photo URL from database
      const photoUrl = await getStudentPhotoUrl(studentId)
      
      // 2. Delete from Cloudinary using the browser (Matches Teacher Logic)
      if (photoUrl) {
        const auth = await getCloudinaryDeleteAuth(photoUrl)
        if (auth) {
          const fd = new FormData()
          fd.append('public_id', auth.publicId)
          fd.append('api_key', auth.apiKey)
          fd.append('timestamp', auth.timestamp.toString())
          fd.append('signature', auth.signature)
          // Silent catch in case Cloudinary blocks client-side destroy
          await fetch(`https://api.cloudinary.com/v1_1/${auth.cloudName}/image/destroy`, { method: 'POST', body: fd }).catch(e => console.error(e))
        }
      }

      // 3. Delete from Database
      const formData = new FormData()
      formData.append('studentId', studentId)
      await deleteStudent(formData)
      
      alert(`${studentName} deleted successfully.`)
      router.refresh()
    } catch (error: any) {
      alert(`Failed to delete: ${error.message}`)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <button 
      onClick={handleDelete} 
      disabled={isDeleting} 
      className="bg-white border border-stone-200 text-[#b4483e] px-4 py-2 rounded-sm text-[10px] uppercase tracking-widest font-medium hover:bg-[#fcf8f8] hover:border-[#b4483e] transition-colors disabled:opacity-50 shadow-sm whitespace-nowrap"
    >
      {isDeleting ? 'Deleting...' : 'Delete'}
    </button>
  )
}