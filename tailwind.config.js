export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Helixa']
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ]
}
