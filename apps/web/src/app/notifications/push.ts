import { api } from '../../api/client'

/** Browser push needs a service worker, the Push API and a secure origin (localhost counts). */
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext

const toKey = (b64: string) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function registration() {
  return navigator.serviceWorker.register('/sw.js')
}

/** This browser's current push subscription, if any. */
export async function currentSubscription() {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration('/sw.js')
  return (await reg?.pushManager.getSubscription()) ?? null
}

/** Asks for permission, subscribes this browser and registers it with the server. */
export async function enablePush() {
  if (!pushSupported()) throw new Error('This browser doesn’t support push notifications.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notifications are blocked for this site. Allow them in your browser settings.')
  const reg = await registration()
  await navigator.serviceWorker.ready
  const { publicKey } = await api.get<{ publicKey: string }>('/users/me/notifications/push-key')
  const existing = await reg.pushManager.getSubscription()
  const sub = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) }))
  await api.raw('POST', '/users/me/notifications/push-subscriptions', { body: sub.toJSON() })
  return sub
}

export async function disablePush() {
  const sub = await currentSubscription()
  if (!sub) return
  await api.raw('POST', '/users/me/notifications/push-subscriptions/remove', { body: { endpoint: sub.endpoint } }).catch(() => {})
  await sub.unsubscribe()
}

/** Re-sends an existing subscription after sign-in, in case it moved to another account. */
export async function refreshPush() {
  const sub = await currentSubscription().catch(() => null)
  if (sub) await api.raw('POST', '/users/me/notifications/push-subscriptions', { body: sub.toJSON() }).catch(() => {})
}
