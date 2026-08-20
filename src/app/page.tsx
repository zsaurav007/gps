import { redirect } from 'next/navigation'

export default function HomePage() {
  // Automatically route anyone visiting the root domain to the school login portal
  redirect('/login')
}