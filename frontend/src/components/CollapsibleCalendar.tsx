import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Icons from 'lucide-react-native';
import { useDatabase } from '../context/DatabaseContext';

interface CollapsibleCalendarProps {
  selectedDate: string | null;
  onSelectDate: (dateStr: string) => void;
  collapsed: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_SHORT_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const CollapsibleCalendar: React.FC<CollapsibleCalendarProps> = ({
  selectedDate,
  onSelectDate,
  collapsed,
}) => {
  const { transactions } = useDatabase();

  const todayStr = new Date().toISOString().split('T')[0];
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [pickerMode, setPickerMode] = useState<'calendar' | 'year' | 'month'>('calendar');
  const [pickerYear, setPickerYear] = useState<number>(new Date().getFullYear());

  if (collapsed) return null;

  // Month navigation
  const handlePrevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleToday = () => {
    const today = new Date();
    onSelectDate(todayStr);
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  // Generate calendar days grid
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 (Sunday) to 6 (Saturday)
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarCells: (string | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarCells.push(null);
  }
  for (let d = 1; d <= totalDaysInMonth; d++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarCells.push(dStr);
  }

  // Check transactions for dot indicator
  const getTransactionsForDate = (dateStr: string) => {
    return transactions.filter(tx => tx.date === dateStr);
  };

  return (
    <View className="bg-[#161D2B]/35 border border-obsidian-border rounded-[24px] p-4 mb-4">
      {/* HEADER */}
      <View className="flex-row justify-between items-center mb-3 px-1">
        {pickerMode === 'calendar' ? (
          <TouchableOpacity onPress={handlePrevMonth} className="p-2 bg-white/5 rounded-xl border border-white/5 active:bg-white/10">
            <Icons.ChevronLeft size={14} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        ) : pickerMode === 'year' ? (
          <TouchableOpacity onPress={() => setPickerMode('calendar')} className="p-2 bg-white/5 rounded-xl border border-white/5 active:bg-white/10">
            <Icons.ArrowLeft size={14} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => setPickerMode('year')} className="p-2 bg-white/5 rounded-xl border border-white/5 active:bg-white/10">
            <Icons.ArrowLeft size={14} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        )}

        <View className="flex-row items-center space-x-2">
          {pickerMode === 'calendar' ? (
            <>
              <TouchableOpacity onPress={() => { setPickerYear(currentMonth.getFullYear()); setPickerMode('year'); }}>
                <Text className="text-white text-xs font-extrabold tracking-tight">
                  {MONTH_NAMES[month]} {year}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleToday} className="px-2 py-1 bg-white/5 rounded-lg border border-white/5 active:bg-white/10 ml-2">
                <Text className="text-indigoAcc-light text-[8px] font-bold uppercase tracking-wider">Today</Text>
              </TouchableOpacity>
            </>
          ) : pickerMode === 'year' ? (
            <Text className="text-white text-xs font-extrabold tracking-tight">Select Year</Text>
          ) : (
            <Text className="text-white text-xs font-extrabold tracking-tight">{pickerYear}</Text>
          )}
        </View>

        {pickerMode === 'calendar' ? (
          <TouchableOpacity onPress={handleNextMonth} className="p-2 bg-white/5 rounded-xl border border-white/5 active:bg-white/10">
            <Icons.ChevronRight size={14} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        ) : (
          <View className="w-8" />
        )}
      </View>

      {pickerMode === 'calendar' && (
        <>
          {/* WEEKDAY HEADERS */}
          <View className="flex-row justify-between mb-2">
            {WEEKDAY_NAMES.map((name, idx) => (
              <View key={idx} className="w-[12%] items-center">
                <Text className="text-mutedText text-[9px] font-bold uppercase tracking-wider">{name}</Text>
              </View>
            ))}
          </View>

          {/* DAYS GRID */}
          <View className="flex-row flex-wrap justify-between">
            {calendarCells.map((cellDate, idx) => {
              if (!cellDate) {
                return <View key={`empty-${idx}`} className="w-[12%] aspect-square mb-2" />;
              }

              const isSelected = selectedDate === cellDate;
              const isToday = todayStr === cellDate;
              const dayNum = parseInt(cellDate.split('-')[2]);

              const cellTxs = getTransactionsForDate(cellDate);
              const hasTxs = cellTxs.length > 0;

              // Determine dot color
              let dotColor = '#6366F1'; // Default Indigo
              if (hasTxs) {
                const hasIncome = cellTxs.some(t => t.type === 'income');
                const hasExpense = cellTxs.some(t => t.type === 'expense');
                if (hasIncome && !hasExpense) {
                  dotColor = '#10B981'; // Mint Green
                } else if (hasExpense && !hasIncome) {
                  dotColor = '#EF4444'; // Coral Red
                }
              }

              return (
                <TouchableOpacity
                  key={cellDate}
                  onPress={() => onSelectDate(cellDate)}
                  style={{
                    backgroundColor: isSelected ? '#6366F1' : isToday ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                    borderColor: isToday ? '#6366F1' : 'transparent',
                  }}
                  className="w-[12%] aspect-square items-center justify-center rounded-xl mb-2 border"
                >
                  <Text
                    style={{
                      color: isSelected ? '#FFFFFF' : isToday ? '#6366F1' : '#E5E7EB',
                      fontWeight: isSelected || isToday ? '800' : '500',
                    }}
                    className="text-[10px]"
                  >
                    {dayNum}
                  </Text>

                  {hasTxs && (
                    <View
                      style={{
                        backgroundColor: isSelected ? '#FFFFFF' : dotColor,
                      }}
                      className="w-1 h-1 rounded-full absolute bottom-1"
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {pickerMode === 'year' && (
        <View className="flex-row flex-wrap justify-between">
          {Array.from({ length: 13 }, (_, i) => new Date().getFullYear() - 6 + i).map(y => {
            const isCurrentYear = y === currentMonth.getFullYear();
            return (
              <TouchableOpacity
                key={y}
                onPress={() => {
                  setPickerYear(y);
                  setPickerMode('month');
                }}
                className={`w-[30%] items-center justify-center py-3 rounded-xl mb-3 ${isCurrentYear ? 'bg-[#6366F1]' : 'bg-white/5'}`}
              >
                <Text className={`text-[12px] font-bold ${isCurrentYear ? 'text-white' : 'text-white/80'}`}>{y}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {pickerMode === 'month' && (
        <View className="flex-row flex-wrap justify-between">
          {MONTH_SHORT_NAMES.map((m, idx) => {
            const isCurrentMonth = pickerYear === currentMonth.getFullYear() && idx === currentMonth.getMonth();
            return (
              <TouchableOpacity
                key={idx}
                onPress={() => {
                  setCurrentMonth(new Date(pickerYear, idx, 1));
                  setPickerMode('calendar');
                }}
                className={`w-[30%] items-center justify-center py-3 rounded-xl mb-3 ${isCurrentMonth ? 'bg-[#6366F1]' : 'bg-white/5'}`}
              >
                <Text className={`text-[12px] font-bold ${isCurrentMonth ? 'text-white' : 'text-white/80'}`}>{m}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};
