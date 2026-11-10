import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import SetupRequired from './components/SetupRequired'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { isSupabaseConfigured } from './lib/config'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      {isSupabaseConfigured ? (
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      ) : (
        <SetupRequired />
      )}
    </BrowserRouter>
  </StrictMode>,
)
