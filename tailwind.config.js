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
                // Dark theme (default)
                background: '#09090b', // Zinc 950
                surface: '#18181b',    // Zinc 900
                border: '#27272a',     // Zinc 800
                primary: '#fafafa',    // Zinc 50
                secondary: '#a1a1aa',  // Zinc 400
                accent: '#2563eb',     // Blue 600

                // Light theme colors (applied via CSS variables)
                'light-background': '#ffffff',
                'light-surface': '#f4f4f5',    // Zinc 100
                'light-border': '#e4e4e7',     // Zinc 200
                'light-primary': '#18181b',    // Zinc 900
                'light-secondary': '#71717a',  // Zinc 500
                'light-accent': '#2563eb',     // Blue 600
            }
        },
    },
    plugins: [],
}
