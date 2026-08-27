'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardHeader, CardTitle, Button } from '@comp-dash/design-system'
import { useCreateCompetition, useUpdateCompetition, useCompetition } from '@comp-dash/api'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, X, Save, AlertCircle } from 'lucide-react'
import type { CompetitionCategory, CompetitionScope, CompetitionMode } from '@comp-dash/types'

const categoryOptions: { value: CompetitionCategory; label: string }[] = [
  { value: 'hackathon', label: 'Hackathon' },
  { value: 'internship', label: 'Internship' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'paper_presentation', label: 'Paper Presentation' },
  { value: 'project', label: 'Project' },
  { value: 'sports', label: 'Sports' },
  { value: 'cultural', label: 'Cultural' },
  { value: 'other', label: 'Other' },
]

const scopeOptions: { value: CompetitionScope; label: string }[] = [
  { value: 'national', label: 'National' },
  { value: 'international', label: 'International' },
  { value: 'state', label: 'State' },
  { value: 'college', label: 'College' },
]

const modeOptions: { value: CompetitionMode; label: string }[] = [
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
  { value: 'hybrid', label: 'Hybrid' },
]

const departmentOptions = [
  'CSE',
]

// Updated for seamless light/dark mode contrast and hover transitions
const inputClass = 'w-full px-4 py-2.5 bg-white dark:bg-zinc-900/80 border border-gray-200 dark:border-zinc-700/60 rounded-xl text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all duration-200 hover:border-gray-300 dark:hover:border-zinc-600'
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5'
const selectClass = `${inputClass} cursor-pointer`

function CreateCompetitionContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')
  const isEdit = !!editId

  const queryClient = useQueryClient()
  const createMutation = useCreateCompetition()
  const updateMutation = useUpdateCompetition()
  const { data: existingComp } = useCompetition(editId || '')

  const [tagsInput, setTagsInput] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  const defaultForm = {
    title: '',
    description: '',
    shortDescription: '',
    category: '' as CompetitionCategory | '',
    scope: '' as CompetitionScope | '',
    mode: '' as CompetitionMode | '',
    organizer: '',
    organizerEmail: '',
    websiteUrl: '',
    registrationUrl: '',
    registrationLink: '',
    teamSizeMin: 1,
    teamSizeMax: 1,
    prizePool: '',
    registrationDeadline: '',
    startDate: '',
    endDate: '',
    eligibilityDepartments: [] as string[],
    tags: [] as string[],
  }

  const [form, setForm] = useState(defaultForm)

  useEffect(() => {
    if (isEdit && existingComp) {
      setForm({
        title: existingComp.title || '',
        description: existingComp.description || '',
        shortDescription: existingComp.shortDescription || '',
        category: existingComp.category || '',
        scope: existingComp.scope || '',
        mode: existingComp.mode || '',
        organizer: existingComp.organizer || '',
        organizerEmail: (existingComp as any).organizerEmail || '',
        websiteUrl: existingComp.websiteUrl || '',
        registrationUrl: existingComp.registrationUrl || '',
        registrationLink: existingComp.registrationLink || '',
        teamSizeMin: existingComp.teamSizeMin || 1,
        teamSizeMax: existingComp.teamSizeMax || 1,
        prizePool: existingComp.prizePool || '',
        registrationDeadline: existingComp.registrationDeadline?.split('T')[0] || '',
        startDate: existingComp.startDate?.split('T')[0] || '',
        endDate: existingComp.endDate?.split('T')[0] || '',
        eligibilityDepartments: existingComp.eligibility?.departments || [],
        tags: existingComp.tags || [],
      })
    }
  }, [isEdit, existingComp])

  const update = (field: string, value: any) => setForm((prev) => ({ ...prev, [field]: value }))

  const toggleDepartment = (dept: string) => {
    setForm((prev) => ({
      ...prev,
      eligibilityDepartments: prev.eligibilityDepartments.includes(dept)
        ? prev.eligibilityDepartments.filter((d) => d !== dept)
        : [...prev.eligibilityDepartments, dept],
    }))
  }

  const addTag = () => {
    const trimmed = tagsInput.trim()
    if (trimmed && !form.tags.includes(trimmed)) {
      update('tags', [...form.tags, trimmed])
      setTagsInput('')
    }
  }

  const removeTag = (tag: string) => {
    update('tags', form.tags.filter((t) => t !== tag))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    if (!form.title.trim() || !form.category || !form.scope || !form.mode || !form.organizer.trim()) {
      setSubmitError('Please fill in all required fields: Title, Category, Scope, Mode, and Organizer.')
      return
    }

    const payload = {
      ...form,
      title: form.title.trim(),
      organizer: form.organizer.trim(),
      category: form.category as CompetitionCategory,
      scope: form.scope as CompetitionScope,
      mode: form.mode as CompetitionMode,
      eligibility: {
        departments: form.eligibilityDepartments,
        yearOfStudy: [],
        description: '',
      },
    }

    try {
      if (isEdit && editId) {
        await updateMutation.mutateAsync({ id: editId, data: payload })
      } else {
        await createMutation.mutateAsync(payload)
      }
      await queryClient.invalidateQueries({ queryKey: ['competitions'] })
      await queryClient.invalidateQueries({ queryKey: ['supabase-competitions'] })
      router.push('/competitions')
      router.refresh()
    } catch (err: any) {
      console.error('Failed to save competition:', err)
      const errorMsg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to save competition to database. Please check your connection and try again.'
      setSubmitError(errorMsg)
    }
  }

  const isValid = Boolean(form.title.trim() && form.category && form.scope && form.mode && form.organizer.trim())
  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display tracking-tight text-2xl font-medium text-gray-900 dark:text-white">{isEdit ? 'Edit Competition' : 'Create Competition'}</h1>
        {isEdit && (
          <span className="px-3 py-1 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-full text-xs text-blue-700 dark:text-blue-300 font-medium shadow-sm transition-transform duration-200 hover:scale-105">
            Editing: {form.title || editId}
          </span>
        )}
      </div>

      {submitError && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 text-sm flex items-start gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Unable to save competition</p>
            <p className="mt-0.5 text-xs opacity-90">{submitError}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-zinc-800 shadow-sm transition-all duration-200">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white font-semibold text-lg">Basic Information</CardTitle>
          </CardHeader>
          <div className="mt-4 space-y-5">
            <div>
              <label className={labelClass}>Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                className={inputClass}
                placeholder="Enter competition title"
                required
              />
            </div>
            <div>
              <label className={labelClass}>Short Description</label>
              <input
                type="text"
                value={form.shortDescription}
                onChange={(e) => update('shortDescription', e.target.value)}
                className={inputClass}
                placeholder="Brief description"
              />
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                className={`${inputClass} min-h-[100px] resize-y`}
                placeholder="Full description of the competition"
                rows={4}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Category *</label>
                <select
                  value={form.category}
                  onChange={(e) => update('category', e.target.value)}
                  className={selectClass}
                  required
                >
                  <option value="" className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100">Select category</option>
                  {categoryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100">{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Scope *</label>
                <select
                  value={form.scope}
                  onChange={(e) => update('scope', e.target.value)}
                  className={selectClass}
                  required
                >
                  <option value="" className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100">Select scope</option>
                  {scopeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100">{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Mode *</label>
                <select
                  value={form.mode}
                  onChange={(e) => update('mode', e.target.value)}
                  className={selectClass}
                  required
                >
                  <option value="" className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100">Select mode</option>
                  {modeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100">{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </Card>

        <Card className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-zinc-800 shadow-sm transition-all duration-200">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white font-semibold text-lg">Organizer & Links</CardTitle>
          </CardHeader>
          <div className="mt-4 space-y-5">
            <div>
              <label className={labelClass}>Organizer *</label>
              <input
                type="text"
                value={form.organizer}
                onChange={(e) => update('organizer', e.target.value)}
                className={inputClass}
                placeholder="Organizing body"
                required
              />
            </div>
            <div>
              <label className={labelClass}>Organizer Sender Email <span className="text-gray-400 dark:text-zinc-500 font-normal">(optional)</span></label>
              <input
                type="email"
                value={form.organizerEmail}
                onChange={(e) => update('organizerEmail', e.target.value)}
                className={inputClass}
                placeholder="organizer@example.com"
              />
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1.5">Email address that sends competition confirmations — used for student email verification matching</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Website URL</label>
                <input
                  type="url"
                  value={form.websiteUrl}
                  onChange={(e) => update('websiteUrl', e.target.value)}
                  className={inputClass}
                  placeholder="https://"
                />
              </div>
              <div>
                <label className={labelClass}>Registration URL</label>
                <input
                  type="url"
                  value={form.registrationUrl}
                  onChange={(e) => update('registrationUrl', e.target.value)}
                  className={inputClass}
                  placeholder="https://"
                />
              </div>
              <div>
                <label className={labelClass}>Registration Link <span className="text-gray-400 dark:text-zinc-500 font-normal">(optional)</span></label>
                <input
                  type="url"
                  value={form.registrationLink}
                  onChange={(e) => update('registrationLink', e.target.value)}
                  className={inputClass}
                  placeholder="https://"
                />
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1.5">Direct registration link (used for dashboard sync)</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-zinc-800 shadow-sm transition-all duration-200">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white font-semibold text-lg">Team & Prize</CardTitle>
          </CardHeader>
          <div className="mt-4 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Min Team Size</label>
                <input
                  type="number"
                  min={1}
                  value={form.teamSizeMin}
                  onChange={(e) => update('teamSizeMin', parseInt(e.target.value) || 1)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Max Team Size</label>
                <input
                  type="number"
                  min={1}
                  value={form.teamSizeMax}
                  onChange={(e) => update('teamSizeMax', parseInt(e.target.value) || 1)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Prize Pool</label>
                <input
                  type="text"
                  value={form.prizePool}
                  onChange={(e) => update('prizePool', e.target.value)}
                  className={inputClass}
                  placeholder="e.g. ₹50,000"
                />
              </div>
            </div>
          </div>
        </Card>

        <Card className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-zinc-800 shadow-sm transition-all duration-200">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white font-semibold text-lg">Dates</CardTitle>
          </CardHeader>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Registration Deadline</label>
              <input
                type="date"
                value={form.registrationDeadline}
                onChange={(e) => update('registrationDeadline', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => update('startDate', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>End Date</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => update('endDate', e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </Card>

        <Card className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-zinc-800 shadow-sm transition-all duration-200">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white font-semibold text-lg">Eligibility & Tags</CardTitle>
          </CardHeader>
          <div className="mt-4 space-y-5">
            <div>
              <label className={labelClass}>Eligible Departments</label>
              <div className="flex flex-wrap gap-2">
                {departmentOptions.map((dept) => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => toggleDepartment(dept)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105 active:scale-95 ${
                      form.eligibilityDepartments.includes(dept)
                        ? 'bg-accent text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-zinc-800/80 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700 hover:text-gray-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass}>Tags</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                  className={inputClass}
                  placeholder="Type a tag and press Enter"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={addTag} 
                  className="transition-transform duration-200 hover:scale-105 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {form.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-accent/10 dark:bg-accent/20 border border-accent/20 text-accent dark:text-accent text-xs font-medium rounded-full transition-transform duration-200 hover:scale-105"
                    >
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} className="hover:opacity-75 transition-opacity ml-1">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-end gap-3 mt-6 pt-2">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => router.back()}
            className="transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={!isValid || isSaving} 
            isLoading={isSaving}
            className="transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] gap-2"
          >
            {isEdit ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {isEdit ? 'Save Changes' : 'Create Competition'}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default function CreateCompetitionPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-gray-500 dark:text-zinc-400">Loading...</div>}>
      <CreateCompetitionContent />
    </Suspense>
  )
}