'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { removeBackground, preload, Config } from '@imgly/background-removal'

// --- Helper Functions for Image Cropping & Compression ---
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
  })

// Scales dimensions down to max 1200px to prevent the browser from freezing on huge images, 
// while keeping the quality high enough for the AI to detect sharp edges.
const optimizeImageForAI = async (imageSrc: string): Promise<string> => {
  const img = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return imageSrc

  const MAX_DIM = 1200
  let width = img.width
  let height = img.height

  if (width > MAX_DIM || height > MAX_DIM) {
    if (width > height) {
      height = Math.round((height * MAX_DIM) / width)
      width = MAX_DIM
    } else {
      width = Math.round((width * MAX_DIM) / height)
      height = MAX_DIM
    }
  }

  canvas.width = width
  canvas.height = height
  
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)

  return canvas.toDataURL('image/jpeg', 0.95) 
}

// Define the exact shape of the crop area for strict TypeScript
type CropArea = { x: number; y: number; width: number; height: number }

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: CropArea
): Promise<string | null> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) return null

  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    canvas.width,
    canvas.height
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob((file) => {
      if (file) resolve(URL.createObjectURL(file))
      else reject(new Error('Canvas is empty'))
    }, 'image/png')
  })
}

// Global Configuration: "isnet_fp16" is the technical name for the medium model.
// This is automatically cached in the browser's IndexedDB after the first download.
const bgConfig: Config = {
  model: "isnet_fp16", 
  output: { format: "image/png" }
}

interface PhotoEditorProps {
  initialImage: string
  onCancel: () => void
  onComplete: (finalImageUrl: string, originalUrl: string) => void
}

export default function PhotoEditor({ initialImage, onCancel, onComplete }: PhotoEditorProps) {
  const [step, setStep] = useState<'hub' | 'crop' | 'enhance'>('hub')
  const [isComparing, setIsComparing] = useState(false)

  const [history, setHistory] = useState<string[]>([initialImage])
  const currentImage = history[history.length - 1] 
  const canUndoGlobal = history.length > 1

  const handleGlobalUndo = () => {
    if (canUndoGlobal) setHistory(prev => prev.slice(0, -1))
  }

  const pushToGlobalHistory = (newImageUrl: string) => {
    setHistory(prev => [...prev, newImageUrl])
  }
  
  const [isRemovingBg, setIsRemovingBg] = useState(false)

  // Preloads the AI model into the browser cache as soon as the editor opens
  useEffect(() => {
    preload(bgConfig).catch((err) => {
      // Safely ignore preload errors (e.g. if offline). It will just try again on click.
      console.log('Background preload status:', err.message)
    })
  }, [])

  const defaultFilters = { b: 100, c: 100, s: 100, sep: 0 }
  const [filterHistory, setFilterHistory] = useState([defaultFilters])
  const [liveFilters, setLiveFilters] = useState(defaultFilters)
  const canUndoFilter = filterHistory.length > 1

  const enhanceCanvasRef = useRef<HTMLCanvasElement>(null)
  const [enhanceImageObj, setEnhanceImageObj] = useState<HTMLImageElement | null>(null)

  const defaultCrop = { x: 0, y: 0 }
  const [crop, setCrop] = useState(defaultCrop)
  const [zoom, setZoom] = useState(1)
  
  // Typed state to fix "any" TS warnings
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null)

  // ==========================================
  // HUB ACTIONS
  // ==========================================
  const handleRemoveBg = async () => {
    setIsRemovingBg(true)
    try {
      const optimizedImage = await optimizeImageForAI(currentImage)
      const imageBlob = await removeBackground(optimizedImage, bgConfig) 
      const url = URL.createObjectURL(imageBlob)
      pushToGlobalHistory(url)
    } catch (error: unknown) {
      console.error(error)
      if (error instanceof Error && error.message.includes('fetch')) {
        alert("Network error: Failed to download the AI model. Please check your internet connection or disable adblockers.")
      } else {
        alert("Failed to remove background. Please try again.")
      }
    } finally {
      setIsRemovingBg(false)
    }
  }

  const handleFinalSave = () => {
    onComplete(currentImage, initialImage)
  }

  // ==========================================
  // ENHANCER ACTIONS
  // ==========================================
  useEffect(() => {
    if (step === 'enhance') {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.src = currentImage
      img.onload = () => setEnhanceImageObj(img)
    }
  }, [step, currentImage])

  useEffect(() => {
    if (step !== 'enhance' || !enhanceImageObj || !enhanceCanvasRef.current) return
    const canvas = enhanceCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = enhanceImageObj.naturalWidth
    canvas.height = enhanceImageObj.naturalHeight
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (isComparing) {
      ctx.filter = 'none'
      ctx.drawImage(enhanceImageObj, 0, 0)
    } else {
      ctx.filter = `brightness(${liveFilters.b}%) contrast(${liveFilters.c}%) saturate(${liveFilters.s}%) sepia(${liveFilters.sep}%)`
      ctx.drawImage(enhanceImageObj, 0, 0)
    }
  }, [step, enhanceImageObj, liveFilters, isComparing])

  const commitFilterHistory = () => {
    const last = filterHistory[filterHistory.length - 1]
    if (
      liveFilters.b !== last.b || 
      liveFilters.c !== last.c || 
      liveFilters.s !== last.s || 
      liveFilters.sep !== last.sep
    ) {
      setFilterHistory([...filterHistory, liveFilters])
    }
  }

  const handleFilterUndo = () => {
    if (canUndoFilter) {
      const newHistory = filterHistory.slice(0, -1)
      setFilterHistory(newHistory)
      setLiveFilters(newHistory[newHistory.length - 1])
    }
  }

  const handleAutoEnhance = () => {
    const autoSettings = { b: 105, c: 115, s: 120, sep: 0 }
    setLiveFilters(autoSettings)
    setFilterHistory([...filterHistory, autoSettings])
  }

  const handleApplyEnhancements = () => {
    if (!enhanceCanvasRef.current) return
    const processedUrl = enhanceCanvasRef.current.toDataURL('image/png')
    pushToGlobalHistory(processedUrl) 
    setStep('hub')
    
    setFilterHistory([defaultFilters])
    setLiveFilters(defaultFilters)
  }

  // ==========================================
  // CROPPER ACTIONS
  // ==========================================
  
  // Added proper CropArea typing to the callback
  const onCropComplete = useCallback((croppedArea: CropArea, croppedAreaPixels: CropArea) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleApplyCrop = async () => {
    if (croppedAreaPixels) {
      try {
        const croppedImage = await getCroppedImg(currentImage, croppedAreaPixels)
        if (croppedImage) {
          pushToGlobalHistory(croppedImage)
          setStep('hub')
          setCrop(defaultCrop)
          setZoom(1)
        }
      } catch (e) {
        alert('Failed to crop image.')
      }
    }
  }

  const handleResetCrop = () => {
    setCrop(defaultCrop)
    setZoom(1)
  }

  // ==========================================
  // RENDER: HUB VIEW
  // ==========================================
  if (step === 'hub') {
    return (
      <div className="fixed inset-0 z-[110] bg-slate-100/90 backdrop-blur-sm flex flex-col items-center justify-center p-4">
        
        <div className="bg-white w-full max-w-2xl rounded-t-xl overflow-hidden flex flex-col items-center justify-center min-h-[350px] relative p-6 border border-slate-200 border-b-0 shadow-lg">
          <p className="absolute top-4 left-6 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            {isComparing ? 'Showing Original' : 'Hold Image to Compare'}
          </p>

          <img 
            src={isComparing ? initialImage : currentImage} 
            alt="Current Editor State" 
            className="max-w-full max-h-[350px] object-contain drop-shadow-md cursor-pointer active:scale-[0.99] transition-transform" 
            onPointerDown={() => setIsComparing(true)}
            onPointerUp={() => setIsComparing(false)}
            onPointerLeave={() => setIsComparing(false)}
            title="Click and hold to see absolute original"
          />
          
          {isRemovingBg && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center flex-col gap-3 z-50">
              <svg className="animate-spin w-8 h-8 text-[#6384A3]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-slate-800 text-xs font-bold uppercase tracking-widest">Removing Background...</p>
            </div>
          )}
        </div>

        <div className="w-full max-w-2xl bg-white p-6 rounded-b-xl border border-slate-200 shadow-xl">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-5">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Photo Studio</h4>
            <button 
              onClick={handleGlobalUndo} 
              disabled={!canUndoGlobal} 
              className="px-3 py-1.5 bg-slate-50 text-slate-600 text-[9px] font-bold uppercase tracking-widest rounded-md border border-slate-200 hover:bg-slate-100 hover:text-slate-900 transition-colors disabled:opacity-40"
            >
              ↩ Undo Last Step
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <button onClick={() => setStep('crop')} className="py-5 px-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-[#6384A3] hover:text-white hover:border-[#6384A3] transition-colors flex flex-col items-center gap-2 group shadow-sm">
              <svg className="w-6 h-6 text-slate-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"></path></svg>
              <span className="text-[10px] font-bold uppercase tracking-widest">Crop & Frame</span>
            </button>

            <button onClick={() => setStep('enhance')} className="py-5 px-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-[#6384A3] hover:text-white hover:border-[#6384A3] transition-colors flex flex-col items-center gap-2 group shadow-sm">
              <svg className="w-6 h-6 text-slate-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
              <span className="text-[10px] font-bold uppercase tracking-widest">Enhance Photo</span>
            </button>

            <button onClick={handleRemoveBg} disabled={isRemovingBg} className="py-5 px-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-[#6384A3] hover:text-white hover:border-[#6384A3] transition-colors flex flex-col items-center gap-2 group disabled:opacity-50 shadow-sm">
              <svg className="w-6 h-6 text-slate-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
              <span className="text-[10px] font-bold uppercase tracking-widest">Remove BG</span>
            </button>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button onClick={onCancel} className="px-6 py-3 border border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-widest rounded-md hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleFinalSave} className="px-6 py-3 bg-[#6384A3] text-xs font-bold text-white uppercase tracking-widest rounded-md hover:bg-[#4f6a83] transition-colors shadow-md">
              Finish & Save
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================
  // RENDER: ENHANCER VIEW
  // ==========================================
  if (step === 'enhance') {
    return (
      <div className="fixed inset-0 z-[110] bg-slate-100/90 backdrop-blur-sm flex flex-col items-center justify-center p-4">
        
        <div className="bg-white w-full max-w-2xl rounded-t-xl overflow-hidden flex flex-col items-center justify-center min-h-[350px] border border-slate-200 border-b-0 shadow-lg relative p-6">
          <p className="absolute top-4 left-6 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            {isComparing ? 'Showing Original' : 'Hold Image to Compare'}
          </p>

          <canvas 
            ref={enhanceCanvasRef} 
            className="max-w-full max-h-[350px] object-contain drop-shadow-md cursor-pointer transition-transform active:scale-[0.99]" 
            onPointerDown={() => setIsComparing(true)}
            onPointerUp={() => setIsComparing(false)}
            onPointerLeave={() => setIsComparing(false)}
            title="Click and hold to see unedited version"
          />
        </div>

        <div className="w-full max-w-2xl bg-white p-6 rounded-b-xl border border-slate-200 shadow-xl">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-5">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Enhancement</h4>
            <div className="flex gap-2">
              <button 
                onClick={handleFilterUndo} 
                disabled={!canUndoFilter} 
                className="px-3 py-1.5 bg-slate-50 text-slate-600 text-[9px] font-bold uppercase tracking-widest rounded-md border border-slate-200 hover:bg-slate-100 transition-colors disabled:opacity-40"
              >
                ↩ Undo Edit
              </button>
              <button onClick={handleAutoEnhance} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-[9px] font-bold uppercase tracking-widest rounded-md border border-indigo-200 hover:bg-indigo-100 transition-colors">
                ✨ Auto Enhance
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 mb-6">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Brightness</label>
              <input type="range" min="50" max="150" value={liveFilters.b} onChange={(e) => setLiveFilters({...liveFilters, b: Number(e.target.value)})} onMouseUp={commitFilterHistory} onTouchEnd={commitFilterHistory} className="w-full accent-[#6384A3]" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Contrast</label>
              <input type="range" min="50" max="150" value={liveFilters.c} onChange={(e) => setLiveFilters({...liveFilters, c: Number(e.target.value)})} onMouseUp={commitFilterHistory} onTouchEnd={commitFilterHistory} className="w-full accent-[#6384A3]" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Saturation</label>
              <input type="range" min="0" max="200" value={liveFilters.s} onChange={(e) => setLiveFilters({...liveFilters, s: Number(e.target.value)})} onMouseUp={commitFilterHistory} onTouchEnd={commitFilterHistory} className="w-full accent-[#6384A3]" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Warmth</label>
              <input type="range" min="0" max="100" value={liveFilters.sep} onChange={(e) => setLiveFilters({...liveFilters, sep: Number(e.target.value)})} onMouseUp={commitFilterHistory} onTouchEnd={commitFilterHistory} className="w-full accent-[#6384A3]" />
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-100">
            <button onClick={() => setStep('hub')} className="text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-slate-800 transition-colors">
              Cancel
            </button>
            <button onClick={handleApplyEnhancements} className="px-6 py-2.5 bg-slate-800 text-xs font-bold text-white uppercase tracking-widest rounded-md hover:bg-black transition-colors shadow-sm">
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================
  // RENDER: CROPPER VIEW
  // ==========================================
  if (step === 'crop') {
    return (
      <div className="fixed inset-0 z-[110] bg-slate-100/90 backdrop-blur-sm flex flex-col items-center justify-center p-4">
        
        <div className="relative w-full max-w-md h-[400px] bg-white rounded-t-xl overflow-hidden border border-slate-200 border-b-0 shadow-lg">
          <Cropper
            image={currentImage}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            minZoom={0.1}
            maxZoom={3}
            restrictPosition={false}
            style={{ containerStyle: { backgroundColor: '#FFFFFF' } }}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="w-full max-w-md bg-white p-6 rounded-b-xl border border-slate-200 shadow-xl flex flex-col gap-5">
          <div className="flex justify-between items-center">
             <label className="text-xs font-bold text-slate-800 uppercase tracking-widest">Adjust Zoom</label>
             <button onClick={handleResetCrop} className="text-[9px] font-bold text-slate-500 uppercase tracking-widest hover:text-slate-900 border border-slate-200 px-2 py-1 rounded-sm transition-colors">
               Reset View
             </button>
          </div>
          
          <input type="range" value={zoom} min={0.1} max={3} step={0.05} onChange={(e) => setZoom(Number(e.target.value))} className="w-full accent-[#6384A3]" />
          
          <div className="flex justify-between items-center pt-4 border-t border-slate-100">
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => setStep('hub')} className="text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-slate-800 transition-colors">
                Back to Hub
              </button>
            </div>
            <button type="button" onClick={handleApplyCrop} className="px-5 py-2.5 bg-slate-800 text-xs font-bold text-white uppercase tracking-widest rounded-md hover:bg-black transition-colors shadow-sm">
              Apply Crop
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}