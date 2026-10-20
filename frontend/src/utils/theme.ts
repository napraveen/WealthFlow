import { useDatabase } from '../context/DatabaseContext';

export const useTheme = () => {
  const { isDarkMode } = useDatabase();

  const theme = isDarkMode 
    ? {
        isDark: true,
        bg: 'bg-[#050505]',
        bgHex: '#050505',
        card: 'bg-[#0D0E12]',
        cardBg: '#0D0E12',
        border: 'border-[#1F222C]',
        borderColor: '#1F222C',
        text: 'text-white',
        subtext: 'text-mutedText',
        inputBg: 'bg-[#161D2B]/30',
        barBg: 'bg-[#161D2B]/35',
        navBg: 'bg-[#161D2B]/90',
        statusBar: 'light-content' as const,
        statusBarBg: '#050505',
        shadowColor: '#000000',
        textColor: '#FFFFFF',
        mutedTextColor: '#6B7280',
        glassBg: 'bg-[#161D2B]/50',
      }
    : {
        isDark: false,
        bg: 'bg-[#F9FAFB]',
        bgHex: '#F9FAFB',
        card: 'bg-[#FFFFFF]',
        cardBg: '#FFFFFF',
        border: 'border-[#E5E7EB]',
        borderColor: '#E5E7EB',
        text: 'text-[#111827]',
        subtext: 'text-[#6B7280]',
        inputBg: 'bg-[#F3F4F6]',
        barBg: 'bg-[#E5E7EB]/50',
        navBg: 'bg-[#FFFFFF]/90',
        statusBar: 'dark-content' as const,
        statusBarBg: '#F9FAFB',
        shadowColor: '#D1D5DB',
        textColor: '#111827',
        mutedTextColor: '#6B7280',
        glassBg: 'bg-[#E5E7EB]/80',
      };

  return theme;
};
