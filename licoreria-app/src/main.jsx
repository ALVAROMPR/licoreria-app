import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { inicializarDB } from './db.js'

inicializarDB().then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}).catch(err => {
  console.error('Error iniciando DB:', err)
  document.body.innerHTML = `
    <div style="padding:24px;color:#fca5a5;font-family:sans-serif">
      <h2>Error al iniciar la base de datos</h2>
      <pre style="margin-top:12px;font-size:13px">${err.message}</pre>
    </div>
  `
})