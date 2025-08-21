/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './popup/**/*.{html,js,ts,vue}',
    './options/**/*.{html,js,ts,vue}',
    './content/**/*.{html,js,ts,vue}',
    './src/**/*.{html,js,ts,vue}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8'
        }
      }
    },
  },
  plugins: [],
}