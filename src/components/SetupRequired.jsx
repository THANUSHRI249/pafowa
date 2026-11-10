import { ShieldAlert } from 'lucide-react'
import { APP_NAME } from '../lib/config'

export default function SetupRequired() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-5 py-12">
      <div className="w-full max-w-lg rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-soft sm:p-8">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <ShieldAlert className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-[1.4rem] font-bold text-slate-900">{APP_NAME} is not connected</h1>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-slate-600">
          The app needs a Supabase project before it can sign anyone in. Set these environment
          variables, then rebuild:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-900 p-4 text-[0.85rem] leading-relaxed text-slate-100">
          <code>{`VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY`}</code>
        </pre>
        <p className="mt-4 text-[0.88rem] leading-relaxed text-slate-500">
          Use only the anon public key. Never put a service-role key in this app.
        </p>
      </div>
    </div>
  )
}
