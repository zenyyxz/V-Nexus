import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AppProvider } from './contexts/AppContext'
import { ToastProvider } from './contexts/ToastContext'
import './styles/index.css'


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
