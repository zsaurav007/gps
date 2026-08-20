import { createClient } from '@/lib/supabase/server'

export default async function ConnectionTestPage() {
  const supabase = await createClient()
  
  // Attempt to read from your custom GPS schema
  const { data, error } = await supabase
    .schema('gps')
    .from('schools')
    .select('*')
    .limit(1)

  return (
    <main className="p-10 font-mono text-sm">
      <h1 className="text-xl font-bold mb-4">Supabase Connection Diagnostics</h1>
      
      <div className="p-4 rounded-md border bg-gray-50 mb-4">
        <h2 className="font-semibold text-gray-700">Environment Variables Loaded?</h2>
        <p>URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Yes' : '❌ No'}</p>
        <p>ANON KEY: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Yes' : '❌ No'}</p>
      </div>

      <div className={`p-4 rounded-md border ${error ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
        <h2 className="font-semibold mb-2">Database Response:</h2>
        {error ? (
          <p className="text-red-700">❌ Connection Failed: {error.message}</p>
        ) : (
          <p className="text-green-700">✅ Connection Successful! Database is reachable.</p>
        )}
      </div>
    </main>
  )
}