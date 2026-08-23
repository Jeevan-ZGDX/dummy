'use client'

import { useTranslation } from 'react-i18next'

interface TopDepartmentsProps {
  data: { name: string; count: number }[]
}

export function TopDepartments({ data }: TopDepartmentsProps) {
  const { t } = useTranslation()

  if (data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-gray-500">
        {t('common.noData')}
      </div>
    )
  }

  const maxCount = Math.max(...data.map((d) => d.count))

  return (
    <div className="space-y-4">
      {data.map((dept) => (
        <div key={dept.name} className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">{dept.name}</span>
            <span className="text-sm text-gray-500">{dept.count}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${(dept.count / maxCount) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
