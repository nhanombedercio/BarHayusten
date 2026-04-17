/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          brand: {
            blue: '#1E9FD4',
            cyan: '#00C8C8',
            orange: '#F5A623',
            dark: '#0D1B2A',
          },
        },
      },
    },
    plugins: [],
  }