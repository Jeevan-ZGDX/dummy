import type { Firestore } from 'firebase/firestore'

let _firestoreDb: Firestore | null = null

export function setFirestoreDb(db: Firestore) {
  _firestoreDb = db
}

export function getFirestoreDb() {
  return _firestoreDb
}

export function isFirestoreEnabled() {
  return _firestoreDb !== null
}
