/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class', // Enable class-based dark mode
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                mono: ['Fira Code', 'monospace'],
            },
            colors: {
                // Theme colors mapped to CSS variables
                background: 'var(--bg-app)',
                surface: 'var(--bg-panel)',
                border: 'var(--border-subtle)',
                primary: 'var(--text-primary)',
                secondary: 'var(--text-secondary)',
                accent: '#2563eb',     // Blue 600 (shared)
            }
        },
    },
    plugins: [],
}
