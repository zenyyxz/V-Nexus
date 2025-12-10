import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AppProvider } from './contexts/AppContext'
import { ToastProvider } from './contexts/ToastContext'
import './styles/index.css'
import { initTauriBridge } from './utils/tauri-bridge'

// Initialize Tauri Bridge if running in Tauri environment
// We detect this by checking if __TAURI_INTERNALS__ is available or if we are in a non-browser environment
// For now, let's just init it. It checks for window object internally.
initTauriBridge()

const root = ReactDOM.createRoot(document.getElementById('root')!)
root.render(
    <React.StrictMode>
        <ToastProvider>
            <AppProvider>
                <App />
            </AppProvider>
        </ToastProvider>
    </React.StrictMode>
)
