/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        mocha: {
          50: '#FDF8F3',
          100: '#F5EDE4',
          200: '#EDE6DF',
          300: '#D4C4A8',
          400: '#A89080',
          500: '#8B6F5C',
          600: '#6B5344',
          700: '#5C4033',
          800: '#3D2B1F',
          900: '#3F1906',
        },
        sage: '#8B9E7E',
        gold: '#C9A96E',
      },
      fontFamily: {
        serif: ["'Lora'", 'Georgia', 'serif'],
        sans: ["'DM Sans'", '-apple-system', 'BlinkMacSystemFont', "'Segoe UI'", 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        '.scrollbar-hide': {
          /* IE and Edge */
          '-ms-overflow-style': 'none',
          /* Firefox */
          'scrollbar-width': 'none',
          /* Safari and Chrome */
          '&::-webkit-scrollbar': {
            display: 'none'
          }
        }
      })
    }
  ],
}
