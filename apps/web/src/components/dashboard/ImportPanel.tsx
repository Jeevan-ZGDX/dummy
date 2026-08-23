import { useState, useRef } from 'react'
import { Card, CardHeader, CardTitle, Button } from '@comp-dash/design-system'
import { Upload, Download, X, FileText, CheckCircle } from 'lucide-react'
import { parseCSVFile, mapToStudent, mapToAdvisor } from '@/lib/csv-parser'

interface ImportPanelProps {
  type: 'students' | 'advisors'
  title: string
  icon: any
  description: string
}

export function ImportPanel({ type, title, icon: Icon, description }: ImportPanelProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<any[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [isImporting] = useState(false)
  const [importedCount] = useState(0)
  
  const handleFileSelect = async (file: File) => {
    if (!file || !file.type.includes('csv')) {
      return
    }
    setSelectedFile(file)
    try {
      const parsed = await parseCSVFile(file)
      if (type === 'students') {
        const mapped = parsed.map(mapToStudent)
        setPreviewData(mapped.slice(0, 5))
      } else {
        const mapped = parsed.map(mapToAdvisor)
        setPreviewData(mapped.slice(0, 5))
      }
    } catch (error) {
      console.error('Error parsing CSV:', error)
    }
  }
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0 && files[0].type.includes('csv')) {
      handleFileSelect(files[0])
    }
  }
  
  const handleImport = async () => {
    if (!selectedFile) return
    
    try {
      const parsed = await parseCSVFile(selectedFile)
      if (type === 'students') {
        const mapped = parsed.map(mapToStudent)
        console.info('Student import preview', mapped.length)
      } else {
        const mapped = parsed.map(mapToAdvisor)
        console.info('Advisor import preview', mapped.length)
      }
      setSelectedFile(null)
      setPreviewData([])
    } catch (error) {
      console.error('Import failed:', error)
    }
  }
  
  const clearFile = () => {
    setSelectedFile(null)
    setPreviewData([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="w-5 h-5" />
          Import {title}
        </CardTitle>
      </CardHeader>
      <div className="px-6 pb-6 space-y-4">
        <p className="text-sm text-gray-600">{description}</p>
        
        {/* File Upload Area */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">CSV File</label>
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${isDragOver
              ? 'border-blue-500 bg-blue-50'
              : selectedFile
                ? 'border-green-500 bg-green-50'
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            }`}
          >
            {selectedFile ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <FileText className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                  </div>
                </div>
                <button
                  onClick={clearFile}
                  className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 text-sm"
                >
                  <X className="w-4 h-4" />
                  Remove file
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                <div>
                  <p className="text-sm text-gray-600">Drag and drop CSV file here or</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                  >
                    browse files
                  </button>
                </div>
                <p className="text-xs text-gray-500">CSV file only, max 10MB</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            />
          </div>
        </div>

        {/* Preview Data */}
        {previewData.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Preview ({previewData.length} rows)</h3>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    {Object.keys(previewData[0]).map((key) => (
                      <th key={key} className="px-3 py-2 text-left font-medium text-gray-500 uppercase">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, i) => (
                    <tr key={i} className="border-t border-gray-200">
                      {Object.keys(previewData[0]).map((key) => (
                        <td key={key} className="px-3 py-2 text-gray-600">
                          {String(row[key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Import Button */}
        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleImport}
            disabled={!selectedFile || isImporting}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isImporting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isImporting ? 'Importing...' : 'Import Data'}
          </Button>
          {importedCount > 0 && type === 'students' && (
            <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 font-medium rounded-xl">
              <CheckCircle className="w-4 h-4" />
              {importedCount} imported
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
