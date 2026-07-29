import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

function showBootError(message) {
  const root = document.getElementById('root')
  if (!root) return
  root.innerHTML = `
    <div style="min-height:100vh;padding:16px;font-family:system-ui,sans-serif">
      <h1 style="color:#dc2626;font-size:18px;margin:0 0 8px">App failed to start</h1>
      <p style="font-size:14px;color:#666;margin:0 0 12px">Screenshot this and send it so we can fix the phone crash.</p>
      <pre style="white-space:pre-wrap;word-break:break-word;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:12px;font-size:12px;color:#991b1b">${String(message).replace(/</g, '&lt;')}</pre>
    </div>
  `
}

window.addEventListener('error', (event) => {
  if (!event?.error && !event?.message) return
  console.error('Window error:', event.error || event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise:', event.reason)
})

try {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <App />
  )
} catch (err) {
  showBootError(err?.stack || err?.message || err)
}
