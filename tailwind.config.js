/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './popup/**/*.{html,js,ts,vue}',
    './options/**/*.{html,js,ts,vue}',
    './content/**/*.{html,js,ts,vue}',
    './src/**/*.{html,js,ts,vue}',
  ],
  theme: {
    screens: {
      mobile: { max: '640px' },
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
      },
    },
  },
  plugins: [],
}

// ensure dynamic grid-cols classes are included by Tailwind JIT
export const safelist = [
  'grid-cols-1',
  'grid-cols-2',
  'grid-cols-3',
  'grid-cols-4',
  'grid-cols-5',
  'grid-cols-6',
  'grid-cols-7',
  'grid-cols-8',
  'grid-cols-9',
  'grid-cols-10',
  'grid-cols-11',
  'grid-cols-12',
]
