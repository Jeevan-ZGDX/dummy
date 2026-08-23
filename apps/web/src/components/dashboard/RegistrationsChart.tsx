'use client'

import { useTranslation } from 'react-i18next'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface RegistrationsChartProps {
  data: { date: string; count: number }[]
}

export function RegistrationsChart({ data }: RegistrationsChartProps) {
  const { t } = useTranslation()

  const gridStroke = '#E5E7EB'
  const axisColor = '#6B7280'
  const tooltipBg = '#FFFFFF'
  const tooltipBorder = '#E5E7EB'
  const tooltipText = '#111827'

  if (data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-gray-500">
        {t('common.noData')}
      </div>
    )
  }

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis
            dataKey="date"
            stroke={axisColor}
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke={axisColor}
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: tooltipBg,
              borderColor: tooltipBorder,
              borderRadius: '12px',
              color: tooltipText,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
            itemStyle={{ color: tooltipText }}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#6C4CF1"
            strokeWidth={2}
            dot={{ fill: '#6C4CF1', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
