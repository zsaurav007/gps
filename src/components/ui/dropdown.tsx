"use client"

import React, { useState, useRef, useEffect, useMemo } from 'react'

export interface DropdownOption {
  label: string
  value: string | number
}

interface DropdownProps {
  options: DropdownOption[]
  value: string | number | null
  onChange: (value: string | number) => void
  placeholder?: string
  hasSearch?: boolean
  disabled?: boolean
  className?: string
}

export default function Dropdown({
  options = [],
  value,
  onChange,
  placeholder = "Select an option...",
  hasSearch = false, // <-- Defaults to false (no search)
  disabled = false,
  className = ""
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Handle click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Clear search query when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      // Small timeout to allow exit animation to finish before clearing
      const timer = setTimeout(() => setSearchQuery(""), 200)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Filter options based on search
  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options
    return options.filter(option => 
      option.label.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [options, searchQuery])

  // Get current selected label
  const selectedLabel = useMemo(() => {
    return options.find(opt => opt.value === value)?.label || placeholder
  }, [options, value, placeholder])

  return (
    <div className={`relative w-full ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-4 py-2.5 bg-white border rounded-sm shadow-sm text-sm tracking-wide transition-colors
          ${disabled ? 'bg-stone-50 text-stone-400 cursor-not-allowed border-stone-200' : 'text-stone-800 border-stone-200 hover:border-[#6b4c9a]/50 focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a]'}
        `}
      >
        <span className={`truncate ${!value && !disabled ? 'text-stone-500' : ''}`}>
          {selectedLabel}
        </span>
        <svg 
          className={`w-4 h-4 text-stone-400 transition-transform duration-300 ease-in-out ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.5" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu (Animated) */}
      <div 
        className={`absolute z-50 w-full mt-1 bg-white border border-stone-200 rounded-sm shadow-lg overflow-hidden origin-top transition-all duration-200 ease-out
          ${isOpen ? 'opacity-100 scale-y-100 translate-y-0' : 'opacity-0 scale-y-95 -translate-y-2 pointer-events-none'}
        `}
      >
        {/* Optional Search Bar */}
        {hasSearch && (
          <div className="p-2 border-b border-stone-100 bg-stone-50">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-stone-200 rounded-sm text-stone-800 focus:outline-none focus:border-[#6b4c9a] focus:ring-1 focus:ring-[#6b4c9a] transition-all"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking input
              />
            </div>
          </div>
        )}

        {/* Options List */}
        <ul className="max-h-60 overflow-y-auto custom-scrollbar py-1">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <li
                key={option.value}
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
                className={`px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center justify-between
                  ${value === option.value ? 'bg-[#fbf9fc] text-[#6b4c9a] font-medium' : 'text-stone-700 hover:bg-stone-50'}
                `}
              >
                <span className="truncate">{option.label}</span>
                {value === option.value && (
                  <svg className="w-4 h-4 text-[#6b4c9a] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </li>
            ))
          ) : (
            <li className="px-4 py-3 text-xs text-stone-500 text-center">
              No results found
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}