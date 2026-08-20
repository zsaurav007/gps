'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addClass } from '@/app/actions/class-actions'

export default function AddClassForm({ schoolId }: { schoolId: string }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Create New Class</h2>
      <form 
        action={async (formData) => {
          if (isSubmitting) return
          setIsSubmitting(true)
          try {
            const result = await addClass(formData)
            if (result?.success) {
              alert("Class created successfully!")
              router.refresh()
            }
          } catch (error: any) {
            alert(`Error: ${error.message}`)
          } finally {
            setIsSubmitting(false)
          }
        }} 
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="schoolId" value={schoolId} />
        
        <div>
          <label className="block text-sm font-medium text-gray-700">Class Name</label>
          <input 
            type="text" 
            name="name" 
            placeholder="e.g., Grade 10 - Section A" 
            required 
            className="mt-1 w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white" 
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Periods Per Day</label>
          <input 
            type="number" 
            name="periodsPerDay" 
            defaultValue={6} 
            min={1} 
            max={15}
            required 
            className="mt-1 w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white" 
          />
        </div>

        <button 
          type="submit" 
          disabled={isSubmitting}
          className="w-full bg-blue-900 text-white p-2 rounded-md hover:bg-blue-800 transition-colors font-medium disabled:opacity-50 mt-2"
        >
          {isSubmitting ? 'Creating...' : 'Create Class'}
        </button>
      </form>
    </div>
  )
}