'use server'

import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// 1. UPLOAD PERMISSION SLIP (Allows browser to upload directly)
export async function getCloudinaryAuth(folderName: string) {
  const timestamp = Math.round(new Date().getTime() / 1000)
  const transformation = 'c_fill,g_face,h_400,w_400' 

  const signature = cloudinary.utils.api_sign_request(
    { folder: folderName, timestamp, transformation },
    process.env.CLOUDINARY_API_SECRET!
  )

  return { 
    timestamp, 
    signature, 
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!, 
    apiKey: process.env.CLOUDINARY_API_KEY!, 
    transformation 
  }
}

// 2. DELETE PERMISSION SLIP (Allows browser to delete directly)
export async function getCloudinaryDeleteAuth(photoUrl: string) {
  if (!photoUrl) return null
  
  try {
    const parts = photoUrl.split('/upload/')
    if (parts.length !== 2) return null
    
    // Extract the exact public_id from the URL
    const pathParts = parts[1].split('/')
    if (pathParts[0].startsWith('v') && !isNaN(parseInt(pathParts[0].substring(1)))) {
      pathParts.shift() 
    }
    
    const fullPath = pathParts.join('/') 
    const publicId = fullPath.substring(0, fullPath.lastIndexOf('.')) || fullPath
    
    // Generate secure signature for deletion
    const timestamp = Math.round(new Date().getTime() / 1000)
    const signature = cloudinary.utils.api_sign_request(
      { public_id: publicId, timestamp },
      process.env.CLOUDINARY_API_SECRET!
    )

    return { 
      publicId, 
      timestamp, 
      signature, 
      cloudName: process.env.CLOUDINARY_CLOUD_NAME!, 
      apiKey: process.env.CLOUDINARY_API_KEY! 
    }
  } catch (error) {
    console.error('Failed to generate Cloudinary delete signature:', error)
    return null
  }
}