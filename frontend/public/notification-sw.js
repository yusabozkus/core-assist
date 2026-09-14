self.addEventListener("push", (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: "Core Asistan", body: event.data.text() }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "Core Asistan", {
      body: payload.body || "Yeni bir bildiriminiz var.",
      tag: payload.tag,
      data: { url: payload.url || "/dashboard/settings/notifications" },
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const targetUrl = new URL(
    event.notification.data?.url || "/dashboard/settings/notifications",
    self.location.origin
  ).href

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(
      (clients) => {
        const existingClient = clients.find((client) => client.url === targetUrl)
        if (existingClient) return existingClient.focus()
        return self.clients.openWindow(targetUrl)
      }
    )
  )
})
