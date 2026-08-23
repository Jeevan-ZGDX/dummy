'use client'

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { firebaseConfig, isFirebaseConfigured } from './config'

let app: FirebaseApp | null = null

function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null
  if (!app) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
  }
  return app
}

export function getFirebaseAuth(): Auth | null {
  const instance = getFirebaseApp()
  return instance ? getAuth(instance) : null
}

export function getFirebaseDb(): Firestore | null {
  const instance = getFirebaseApp()
  return instance ? getFirestore(instance) : null
}

/**
 * `hd` narrows Google's account picker to the college domain. It is a UX filter
 * only — the real domain gate runs server-side in the session route.
 */
export function buildGoogleProvider(hostedDomain: string): GoogleAuthProvider {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ hd: hostedDomain, prompt: 'select_account' })
  return provider
}

export { isFirebaseConfigured }
