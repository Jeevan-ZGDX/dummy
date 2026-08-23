export async function parseCSVFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const csv = e.target?.result as string
      const lines = csv.split(/\r?\n/).filter(line => line.trim())
      if (lines.length < 2) {
        resolve([])
        return
      }
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
      const data = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        const obj: any = {}
        headers.forEach((header, index) => {
          obj[header] = values[index] || ''
        })
        return obj
      })
      resolve(data)
    }
    reader.onerror = (e) => reject(e)
    reader.readAsText(file)
  })
}

export function mapToStudent(data: any): any {
  return {
    id: data.id || `stu-${Date.now()}`, 
    name: data.name || '',
    email: data.email || '',
    department: data.department || 'CSE',
    year: data.year || '2nd Year',
    section: data.section || 'A',
    registeredCompetitions: parseInt(data.registeredCompetitions) || 0,
    verifiedCompetitions: parseInt(data.verifiedCompetitions) || 0,
    createdAt: data.createdAt || new Date().toISOString(),
  }
}

export function mapToAdvisor(data: any): any {
  return {
    id: data.id || `adv-${Date.now()}`, 
    name: data.name || '',
    email: data.email || '',
    department: data.department || 'CSE',
    assignedSections: Array.isArray(data.assignedSections) ? data.assignedSections : (data.assignedSections ? [data.assignedSections] : []),
    pendingVerifications: parseInt(data.pendingVerifications) || 0,
    createdAt: data.createdAt || new Date().toISOString(),
  }
}
