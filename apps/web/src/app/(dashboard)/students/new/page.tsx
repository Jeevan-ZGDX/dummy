'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle } from '@comp-dash/design-system'
import { UserPlus, ArrowLeft, CheckCircle } from 'lucide-react'

export default function AddStudentPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', year: '2nd Year', section: 'A' })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setSuccess(true)
        setTimeout(() => router.push('/students'), 1500)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = "w-full px-3.5 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700/60 rounded-xl text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all duration-200 hover:border-gray-300 dark:hover:border-zinc-600"
  const labelClass = "block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1.5"

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <button 
        onClick={() => router.back()} 
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition-all duration-200 hover:scale-105 origin-left"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <Card className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-zinc-800 shadow-sm transition-all duration-200">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white font-semibold text-lg">Add New Student</CardTitle>
        </CardHeader>
        <div className="mt-4 px-4 pb-6">
          {success ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center mb-3">
                <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Student added successfully!</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Full Name</label>
                <input 
                  type="text" 
                  value={form.name} 
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Enter student full name"
                  className={inputClass} 
                />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input 
                  type="email" 
                  value={form.email} 
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="student@example.com"
                  className={inputClass} 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Year</label>
                  <select 
                    value={form.year} 
                    onChange={e => setForm({ ...form, year: e.target.value })}
                    className={`${inputClass} cursor-pointer`}
                  >
                    <option value="1st Year" className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100">1st Year</option>
                    <option value="2nd Year" className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100">2nd Year</option>
                    <option value="3rd Year" className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100">3rd Year</option>
                    <option value="4th Year" className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100">4th Year</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Section</label>
                  <input 
                    type="text" 
                    value={form.section} 
                    onChange={e => setForm({ ...form, section: e.target.value })}
                    placeholder="Enter section (e.g. A, B, CSE-A)"
                    className={inputClass} 
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => router.back()} 
                  className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-zinc-700/60 text-gray-700 dark:text-zinc-300 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800 transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={handleSubmit} 
                  disabled={submitting || !form.name || !form.email}
                  className="flex-1 px-4 py-2.5 bg-accent text-white text-sm font-medium rounded-xl hover:bg-accent/90 disabled:opacity-50 transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  Add Student
                </button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}