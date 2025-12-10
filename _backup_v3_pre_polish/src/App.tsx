import { useState, useEffect } from 'react'
import { HashRouter as Router, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { Home, Settings, Activity, Menu, FileText, Shield, FileCode } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { HomeView } from './views/HomeView'
import { ConfigsView } from './views/ConfigsView'
import { AdvancedView } from './views/AdvancedView'
import { SettingsView } from './views/SettingsView'
import { LogsView } from './views/LogsView'
import { CommandPalette } from './components/CommandPalette'
import { ErrorRecovery } from './components/ErrorRecovery'
import { UpdateNotificationBanner } from './components/UpdateNotificationBanner'
import { useApp } from './contexts/AppContext'
import { useUpdateChecker } from './hooks/useUpdateChecker'
import { useTranslation } from './hooks/useTranslation'
import { useReconnect } from './hooks/useReconnect'

import { useHealthCheck } from './hooks/useHealthCheck'
import { TitleBar } from './components/TitleBar'
import { AdminPrivilegeBanner } from './components/AdminPrivilegeBanner'

function AnimatedRoutes() {
    const location = useLocation()

    return (
        <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
                <Route path="/" element={<PageTransition><HomeView /></PageTransition>} />
                <Route path="/configs" element={<PageTransition><ConfigsView /></PageTransition>} />
                <Route path="/connections" element={<PageTransition><AdvancedView /></PageTransition>} />
                <Route path="/logs" element={<PageTransition><LogsView /></PageTransition>} />
                <Route path="/settings" element={<PageTransition><SettingsView /></PageTransition>} />
            </Routes>
        </AnimatePresence>
    )
}

const PageTransition = ({ children }: { children: React.ReactNode }) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="w-full h-full"
    >
        {children}
    </motion.div>
)

function App() {
    const [isSidebarOpen, setSidebarOpen] = useState(true)
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
    const [appVersion, setAppVersion] = useState('')
    const { settings } = useApp()

    // Auto-check for updates on startup
    const {
        updateAvailable,
        latestVersion,
        downloadUrl,
        downloading,
        downloadProgress,
        updateDownloaded,
        dismissed,
        downloadUpdate,
        installUpdate,
        dismissUpdate
    } = useUpdateChecker(true)

    // Check admin status and version on mount
    useEffect(() => {
        const init = async () => {
            try {
                const { invoke } = await import('@tauri-apps/api/core')

                const adminResult = await invoke<boolean>('check_is_admin')
                setIsAdmin(adminResult)

                const ver = await invoke<string>('get_version')
                setAppVersion(ver)
            } catch (error) {
                console.error('Failed to init system info:', error)
                // Fallback to false if check fails, so user can try to restart if needed
                if (isAdmin === null) setIsAdmin(false)
            }
        }
        init()
    }, [])

    const handleRestartAsAdmin = async () => {
        try {
            const result = await window.system.restartAsAdmin()
            if (result && !result.success) {
                console.error('Failed to restart as admin:', result.error)
            }
        } catch (error) {
            console.error('Failed to restart as admin (exception):', error)
        }
    }

    // Disable Context Menu
    useEffect(() => {
        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault()
        }
        document.addEventListener('contextmenu', handleContextMenu)
        return () => document.removeEventListener('contextmenu', handleContextMenu)
    }, [])

    // Apply theme to document root
    useEffect(() => {
        const root = document.documentElement
        if (settings.theme === 'light') {
            root.classList.add('light')
        } else {
            root.classList.remove('light')
        }
    }, [settings.theme])

    const { t } = useTranslation()

    // Initialize global background services
    useReconnect()
    useHealthCheck()

    const navItems = [
        { to: '/', icon: <Home size={18} />, label: t('nav_home') },
        { to: '/configs', icon: <FileCode size={18} />, label: t('nav_configs') },
        { to: '/connections', icon: <Activity size={18} />, label: t('nav_connections') },
        { to: '/logs', icon: <FileText size={18} />, label: t('nav_logs') },
        { to: '/settings', icon: <Settings size={18} />, label: t('nav_settings') }
    ]

    return (
        <Router>
            <ErrorRecovery />
            <CommandPalette />

            <div className="flex flex-col h-screen w-screen bg-background text-primary overflow-hidden font-sans selection:bg-accent selection:text-white">
                {/* Titlebar - Absolute, sits on top */}
                <TitleBar />

                {/* Banners Container - Pushes content down */}
                <div className="flex flex-col shrink-0 z-40">
                    {/* Admin Privilege Banner - Has built-in mt-8 to clear TitleBar */}
                    {isAdmin === false && settings.tunMode && (
                        <AdminPrivilegeBanner onRestartAsAdmin={handleRestartAsAdmin} />
                    )}

                    {/* Update Notification Banner */}
                    {updateAvailable && !dismissed && (
                        <div className={isAdmin === false && settings.tunMode ? '' : 'mt-8'}>
                            <UpdateNotificationBanner
                                version={latestVersion}
                                downloadUrl={downloadUrl}
                                downloading={downloading}
                                downloadProgress={downloadProgress}
                                updateDownloaded={updateDownloaded}
                                onDownload={downloadUpdate}
                                onInstall={installUpdate}
                                onDismiss={dismissUpdate}
                            />
                        </div>
                    )}
                </div>

                {/* Main Content Area - Fills remaining space */}
                <div className="flex-1 flex overflow-hidden relative">
                    {/* Sidebar */}
                    <motion.aside
                        initial={{ x: 0, opacity: 1 }}
                        animate={{ width: isSidebarOpen ? 240 : 64 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="h-full bg-surface border-r border-border flex flex-col z-30 pt-10"
                    >
                        <div className={`px-4 mb-8 flex items-center ${isSidebarOpen ? 'justify-between' : 'justify-center'} h-8`}>
                            {isSidebarOpen && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex items-center gap-2"
                                >
                                    <Shield size={18} className="text-accent" />
                                    <span className="font-semibold text-sm tracking-wide text-primary">V-NEXUS</span>
                                </motion.div>
                            )}
                            <button
                                onClick={() => setSidebarOpen(!isSidebarOpen)}
                                className="p-1.5 hover:bg-white/5 rounded-md text-secondary hover:text-primary transition-all hover-lift app-region-no-drag"
                            >
                                <Menu size={16} />
                            </button>
                        </div>

                        <nav className="flex-1 px-2 space-y-1">
                            {navItems.map((item, index) => (
                                <motion.div
                                    key={item.to}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05, duration: 0.2 }}
                                >
                                    <NavItem to={item.to} icon={item.icon} label={item.label} isOpen={isSidebarOpen} />
                                </motion.div>
                            ))}
                        </nav>

                        <div className="p-4 border-t border-border">
                            {isSidebarOpen ? (
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded bg-accent/10 flex items-center justify-center text-accent">
                                        <Shield size={16} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-medium text-primary">V-Nexus</span>
                                        <span className="text-[10px] text-secondary">v{appVersion}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="w-8 h-8 mx-auto rounded bg-accent/10 flex items-center justify-center text-accent">
                                    <Shield size={16} />
                                </div>
                            )}
                        </div>
                    </motion.aside>

                    {/* Main View */}
                    <main className="flex-1 h-full overflow-hidden bg-background relative pt-10 pr-0">
                        <div className="w-full h-full">
                            <AnimatedRoutes />
                        </div>
                    </main>
                </div>
            </div>
        </Router>
    )
}

const NavItem = ({ to, icon, label, isOpen }: { to: string, icon: any, label: string, isOpen: boolean }) => (
    <NavLink
        to={to}
        className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 text-sm hover-lift ${isActive
                ? 'bg-accent/10 text-accent font-medium'
                : 'text-secondary hover:text-primary hover:bg-white/5'
            } ${!isOpen ? 'justify-center' : ''}`
        }
    >
        <span className="min-w-[18px]">{icon}</span>
        {isOpen && <span>{label}</span>}
    </NavLink>
)

export default App
