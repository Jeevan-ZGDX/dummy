import { Card, CardHeader, CardTitle } from '@comp-dash/design-system'
import { Users, UserPlus, Download, Upload } from 'lucide-react'
import { ImportPanel } from './ImportPanel'

export default function ImportSection() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Data Import</h2>
          <p className="text-gray-500 mt-1">Import students and advisors data from CSV/Excel files</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ImportPanel
          type="students"
          title="Students"
          icon={Users}
          description="Import student data including ID, name, email, department, year, and section information"
        />
        
        <ImportPanel
          type="advisors"
          title="Advisors"
          icon={UserPlus}
          description="Import advisor data including ID, name, email, department, and assigned sections"
        />
      </div>
    </div>
  )
}
