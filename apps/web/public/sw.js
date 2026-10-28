/* Meetspace service worker: shows browser push notifications and opens the
   right page when one is clicked. It deliberately does no offline caching. */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Meetspace', {
      body: data.body || '',
      tag: data.tag,
      icon: '/logo.svg',
      badge: '/logo.svg',
      data: { url: data.url || '/app/notifications' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/app/notifications', self.location.origin)
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = windows.find((w) => new URL(w.url).origin === url.origin)
      if (open) {
        await open.focus()
        return open.navigate(url.href)
      }
      return self.clients.openWindow(url.href)
    })(),
  )
})
