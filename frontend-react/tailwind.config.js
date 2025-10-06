/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Enhanced mobile-first breakpoints
      screens: {
        'xs': '475px',
        // sm: '640px', (default)
        // md: '768px', (default)
        // lg: '1024px', (default)
        // xl: '1280px', (default)
        '2xl': '1536px',
      },
      // Minimum touch target sizes (iOS/Android guidelines: 44x44px)
      spacing: {
        'touch': '2.75rem', // 44px minimum
      },
      // Enhanced font sizes for mobile readability
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      },
    },
  },
  plugins: [],
}