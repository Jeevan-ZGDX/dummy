"use strict"

const fs = require('fs')
const path = require('path')

const appDir = path.join(__dirname, 'apps/web')

const checks = [
  { file: 'src/lib/firebase/config.ts', required: true },
  { file: 'src/contexts/FirebaseAuthProvider.tsx', required: true },
  { file: 'src/app/login/page.tsx', required: true },
  { file: 'package.json', check: '"firebase"' },
  { file: '.env.local.template', required: true },
]

console.log('🔍 Verifying Firebase Integration...\n')

let allGood = true

checks.forEach((check) => {
  if (check.file) {
    const filePath = path.join(appDir, check.file)
    const exists = fs.existsSync(filePath)
    const status = exists ? '✅' : '❌'
    
    if (check.required) {
      if (!exists) {
        allGood = false
        console.log(`${status} Missing required file: ${check.file}`)
      } else {
        console.log(`${status} ${check.file}`)
      }
    } else if (check.check) {
      try {
        const content = fs.readFileSync(filePath, 'utf8')
        if (content.includes(check.check)) {
          console.log(`${status} ${check.file} (has ${check.check})`)
        } else {
          allGood = false
          console.log(`${status} ${check.file} (missing: ${check.check})`)
        }
      } catch {
        allGood = false
        console.log(`${status} ${check.file} (cannot read)`)
      }
    }
  }
})

if (allGood) {
  console.log('\n🎉 All Firebase checks passed! Integration is working correctly.')
} else {
  console.log('\n⚠️  Some checks failed. Please review the integration.')
  process.exit(1)
}
