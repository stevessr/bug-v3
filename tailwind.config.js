/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './popup/**/*.{html,js,ts,vue}',
    './options/**/*.{html,js,ts,vue}',
    './content/**/*.{html,js,ts,vue}',
    './src/**/*.{html,js,ts,vue}'
  ],
  theme: {
    screens: {
      mobile: { max: '640px' },
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px'
    },
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49'
        }
      },
      colors: {
        primary: {
          50: '#082f49',
          100: '#0c4a6e',
          200: '#075985',
          300: '#0369a1',
          400: '#0284c7',
          500: '#0ea5e9',
          600: '#38bdf8',
          700: '#7dd3fc',
          800: '#bae6fd',
          900: '#e0f2fe',
          950: '#f0f9ff'
        }
      }
    }
  },
}
