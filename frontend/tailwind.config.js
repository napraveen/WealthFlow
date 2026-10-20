/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        obsidian: {
          DEFAULT: '#050505',
          deep: '#020202',
          card: '#0D0E12',
          border: '#1F222C',
        },
        slateGlass: {
          DEFAULT: 'rgba(22, 29, 43, 0.6)',
          border: 'rgba(255, 255, 255, 0.08)',
        },
        mint: {
          DEFAULT: '#10B981',
          light: '#34D399',
          dim: 'rgba(16, 185, 129, 0.1)',
        },
        coral: {
          DEFAULT: '#EF4444',
          light: '#F87171',
          dim: 'rgba(239, 68, 68, 0.1)',
        },
        indigoAcc: {
          DEFAULT: '#6366F1',
          light: '#818CF8',
          dim: 'rgba(99, 102, 241, 0.1)',
        },
        amberAcc: {
          DEFAULT: '#F59E0B',
          light: '#FBBF24',
          dim: 'rgba(245, 158, 11, 0.1)',
        },
        mutedText: '#6B7280',
        lightGray: '#E5E7EB',
      },
    },
  },
  plugins: [],
}
