import { ReactNode, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface TooltipProps {
    content: string
    children: ReactNode
    position?: 'top' | 'bottom' | 'left' | 'right'
    delay?: number
}

export const Tooltip = ({ content, children, position = 'top', delay = 300 }: TooltipProps) => {
    const [isVisible, setIsVisible] = useState(false)
    let timeoutId: NodeJS.Timeout

    const handleMouseEnter = () => {
        timeoutId = setTimeout(() => setIsVisible(true), delay)
    }

    const handleMouseLeave = () => {
        clearTimeout(timeoutId)
        setIsVisible(false)
    }

    const positionStyles = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2'
    }

    const arrowStyles = {
        top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent',
        bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent',
        left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent',
        right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent'
    }

    return (
        <div
            className="relative inline-block"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onFocus={handleMouseEnter}
            onBlur={handleMouseLeave}
        >
            {children}
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute z-50 ${positionStyles[position]} pointer-events-none`}
                    >
                        <div className="bg-zinc-900 text-white text-xs px-3 py-1.5 rounded-md shadow-lg border border-zinc-700 whitespace-nowrap">
                            {content}
                            <div className={`absolute w-0 h-0 border-4 border-zinc-900 ${arrowStyles[position]}`} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
