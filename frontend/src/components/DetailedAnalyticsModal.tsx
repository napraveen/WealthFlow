import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Dimensions, Image, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Icons from 'lucide-react-native';
import { RichTransaction } from '../context/DatabaseContext';
import { useTheme } from '../utils/theme';

interface DetailedAnalyticsModalProps {
  visible: boolean;
  onClose: () => void;
  transactions: RichTransaction[];
  initialViewType: 'velocity' | 'categories';
}

const ALL_MONTHS = [
  { label: 'All Months', value: 'All', short: 'All' },
  { label: 'January', value: '01', short: 'Jan' },
  { label: 'February', value: '02', short: 'Feb' },
  { label: 'March', value: '03', short: 'Mar' },
  { label: 'April', value: '04', short: 'Apr' },
  { label: 'May', value: '05', short: 'May' },
  { label: 'June', value: '06', short: 'Jun' },
  { label: 'July', value: '07', short: 'Jul' },
  { label: 'August', value: '08', short: 'Aug' },
  { label: 'September', value: '09', short: 'Sep' },
  { label: 'October', value: '10', short: 'Oct' },
  { label: 'November', value: '11', short: 'Nov' },
  { label: 'December', value: '12', short: 'Dec' },
];

export const DetailedAnalyticsModal: React.FC<DetailedAnalyticsModalProps> = ({ 
  visible, 
  onClose, 
  transactions, 
  initialViewType 
}) => {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  // Selected filters
  const currentYearStr = new Date().getFullYear().toString();
  const currentMonthStr = String(new Date().getMonth() + 1).padStart(2, '0');

  const [selectedYear, setSelectedYear] = useState<string>(currentYearStr);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<{ [key: string]: boolean }>({});

  // Synchronize filters when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedYear(currentYearStr);
      setSelectedMonth(currentMonthStr);
      setShowYearDropdown(false);
      setShowMonthDropdown(false);
      setSelectedCategory(null);
    }
  }, [visible]);

  // Generate list of years: current year on top + past 5 years in descending order
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: string[] = [];
    for (let i = 0; i <= 5; i++) {
      years.push((currentYear - i).toString());
    }
    return years;
  }, []);

  // Check if data exists for a specific month
  const monthHasData = (monthVal: string) => {
    if (monthVal === 'All') return transactions.length > 0;
    return transactions.some(t => {
      const tYear = t.date.substring(0, 4);
      const tMonth = t.date.substring(5, 7);
      const yearMatch = selectedYear === 'All' || tYear === selectedYear;
      return yearMatch && tMonth === monthVal && t.type === 'expense';
    });
  };

  // Check if data exists for a specific year
  const yearHasData = (yearVal: string) => {
    if (yearVal === 'All') return transactions.length > 0;
    return transactions.some(t => t.date.substring(0, 4) === yearVal && t.type === 'expense');
  };

  // Filter transactions based on active Year & Month
  const filteredTxs = useMemo(() => {
    return transactions.filter(t => {
      const tYear = t.date.substring(0, 4);
      const tMonth = t.date.substring(5, 7);

      const yearMatch = selectedYear === 'All' || tYear === selectedYear;
      const monthMatch = selectedMonth === 'All' || tMonth === selectedMonth;

      return yearMatch && monthMatch;
    });
  }, [transactions, selectedYear, selectedMonth]);

  // Calculate Aggregates for filtered period
  const totalIncome = useMemo(() => {
    return filteredTxs
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTxs]);

  const totalExpense = useMemo(() => {
    return filteredTxs
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTxs]);

  const netSavings = totalIncome - totalExpense;

  interface SubcategoryStat {
    name: string;
    amount: number;
    percent: number;
    count: number;
  }

  interface CategoryStat {
    name: string;
    color: string;
    icon?: string;
    amount: number;
    percent: number;
    count: number;
    subcategories: SubcategoryStat[];
  }

  // Category distributions with subcategories
  const categoryBreakdown: CategoryStat[] = useMemo(() => {
    const catMap: { 
      [name: string]: { 
        amount: number; 
        color: string; 
        icon?: string;
        count: number;
        subs: { [subName: string]: { amount: number; count: number } };
      } 
    } = {};
    let periodExpenses = 0;

    filteredTxs.forEach(t => {
      if (t.type !== 'expense') return;
      const name = t.categoryName || 'Uncategorized';
      const color = t.categoryColor || '#9CA3AF';
      const icon = t.categoryIcon || 'HelpCircle';
      const subName = t.subcategoryName ? t.subcategoryName : 'General';

      if (!catMap[name]) {
        catMap[name] = { amount: 0, color, icon, count: 0, subs: {} };
      }
      catMap[name].amount += t.amount;
      catMap[name].count += 1;
      periodExpenses += t.amount;

      if (!catMap[name].subs[subName]) {
        catMap[name].subs[subName] = { amount: 0, count: 0 };
      }
      catMap[name].subs[subName].amount += t.amount;
      catMap[name].subs[subName].count += 1;
    });

    return Object.entries(catMap)
      .map(([name, obj]) => {
        const catTotal = obj.amount;
        const subList: SubcategoryStat[] = Object.entries(obj.subs)
          .map(([sName, sObj]) => ({
            name: sName,
            amount: sObj.amount,
            count: sObj.count,
            percent: catTotal > 0 ? (sObj.amount / catTotal) * 100 : 0
          }))
          .sort((a, b) => b.amount - a.amount);

        return {
          name,
          color: obj.color,
          icon: obj.icon,
          amount: obj.amount,
          count: obj.count,
          percent: periodExpenses > 0 ? (obj.amount / periodExpenses) * 100 : 0,
          subcategories: subList
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [filteredTxs]);

  const toggleCategoryExpand = (catName: string) => {
    setExpandedCategories(prev => {
      const isCurrentlyExpanded = prev[catName];
      if (!isCurrentlyExpanded) {
        setSelectedCategory(catName);
        return { ...prev, [catName]: true };
      } else {
        if (selectedCategory === catName) {
          setSelectedCategory(null);
        }
        return { ...prev, [catName]: false };
      }
    });
  };

  // Group expenses by date for daily velocity display
  const dailyExpenses = useMemo(() => {
    const dailyMap: { [date: string]: number } = {};
    filteredTxs.forEach(t => {
      if (t.type !== 'expense') return;
      dailyMap[t.date] = (dailyMap[t.date] || 0) + t.amount;
    });
    return Object.entries(dailyMap)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredTxs]);

  // Column chart metrics
  const maxCategoryAmount = useMemo(() => {
    if (categoryBreakdown.length === 0) return 1000;
    const max = Math.max(...categoryBreakdown.map(c => c.amount));
    return max > 0 ? max : 1000;
  }, [categoryBreakdown]);

  const formatShortCurrency = (val: number) => {
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(val >= 10000 ? 0 : 1)}k`;
    return `₹${Math.round(val)}`;
  };

  const selectedMonthLabel = ALL_MONTHS.find(m => m.value === selectedMonth)?.short || selectedMonth;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={{ paddingTop: insets.top, paddingBottom: insets.bottom }} className={`flex-1 ${theme.bg}`}>
        
        {/* HEADER */}
        <View className="mt-3 mb-2 px-5 flex-row justify-between items-center">
          <View>
            <Text className={`text-3xl font-extrabold tracking-tight ${theme.text}`}>
              {initialViewType === 'velocity' ? 'Spending Analytics' : 'Category Breakdown'}
            </Text>
            <Text className={`${theme.subtext} text-xs font-semibold uppercase tracking-wider mt-0.5`}>
              {initialViewType === 'velocity' ? 'Daily outflows timeline' : 'Expense distribution logs'}
            </Text>
          </View>
          <TouchableOpacity 
            onPress={onClose} 
            className={`p-2.5 ${theme.inputBg} rounded-xl active:scale-95`}
          >
            <Icons.X size={16} color={theme.textColor} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* FILTER BAR */}
        <View className="px-5 mt-1 mb-3">
          <View className="flex-row items-center space-x-3">
            {/* Month Dropdown Trigger */}
            <TouchableOpacity 
              onPress={() => {
                setShowMonthDropdown(!showMonthDropdown);
                setShowYearDropdown(false);
              }}
              className={`flex-row items-center space-x-1.5 px-4 py-2.5 rounded-2xl border ${
                showMonthDropdown ? 'bg-indigoAcc border-indigoAcc' : `${theme.glassBg} ${theme.border}`
              }`}
            >
              <Icons.Calendar size={14} color={showMonthDropdown ? '#FFF' : '#6366F1'} strokeWidth={2} />
              <Text className={`text-xs font-bold ${showMonthDropdown ? 'text-white' : theme.text}`}>
                {selectedMonth === 'All' ? 'All Months' : selectedMonthLabel}
              </Text>
              <Icons.ChevronDown size={14} color={showMonthDropdown ? '#FFF' : theme.textColor} />
            </TouchableOpacity>

            {/* Year Dropdown Trigger */}
            <TouchableOpacity 
              onPress={() => {
                setShowYearDropdown(!showYearDropdown);
                setShowMonthDropdown(false);
              }}
              className={`flex-row items-center space-x-1.5 px-4 py-2.5 rounded-2xl border ${
                showYearDropdown ? 'bg-indigoAcc border-indigoAcc' : `${theme.glassBg} ${theme.border}`
              }`}
            >
              <Text className={`text-xs font-bold ${showYearDropdown ? 'text-white' : theme.text}`}>
                {selectedYear === 'All' ? 'All Years' : selectedYear}
              </Text>
              <Icons.ChevronDown size={14} color={showYearDropdown ? '#FFF' : theme.textColor} />
            </TouchableOpacity>
          </View>
        </View>

        {/* TOP-LEVEL FLOATING DROPDOWN OVERLAYS WITH FULL-PAGE TOUCH DISMISS */}
        {(showMonthDropdown || showYearDropdown) && (
          <View 
            style={[StyleSheet.absoluteFillObject, { zIndex: 9999, elevation: 9999 }]} 
            pointerEvents="box-none"
          >
            {/* Backdrop to dismiss when tapping outside */}
            <TouchableOpacity 
              activeOpacity={1}
              onPress={() => {
                setShowMonthDropdown(false);
                setShowYearDropdown(false);
              }}
              style={StyleSheet.absoluteFillObject}
              className="bg-black/35"
            />

            {/* Month Dropdown Card */}
            {showMonthDropdown && (
              <View 
                style={{ 
                  position: 'absolute', 
                  top: insets.top + 98, 
                  left: 20, 
                  maxHeight: 300, 
                  zIndex: 10000, 
                  elevation: 100 
                }} 
                className="w-52 bg-[#161D2B] border border-white/20 rounded-2xl p-2.5 shadow-2xl"
              >
                <ScrollView 
                  style={{ flex: 1 }} 
                  contentContainerStyle={{ paddingBottom: 8 }}
                  showsVerticalScrollIndicator={true} 
                  nestedScrollEnabled={true}
                  bounces={true}
                >
                  {ALL_MONTHS.map(m => {
                    const isSelected = selectedMonth === m.value;
                    const hasData = monthHasData(m.value);
                    return (
                      <TouchableOpacity
                        key={m.value}
                        onPress={() => {
                          setSelectedMonth(m.value);
                          setShowMonthDropdown(false);
                        }}
                        className={`px-3 py-2.5 rounded-xl mb-1 flex-row items-center justify-between ${
                          isSelected ? 'bg-indigoAcc/30 border border-indigoAcc/50' : 'active:bg-white/5'
                        }`}
                      >
                        <Text className={`text-xs ${isSelected ? 'font-bold text-indigoAcc-light' : 'font-medium text-white'}`}>
                          {m.label}
                        </Text>
                        {hasData && (
                          <View className="w-1.5 h-1.5 rounded-full bg-mint" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Year Dropdown Card */}
            {showYearDropdown && (
              <View 
                style={{ 
                  position: 'absolute', 
                  top: insets.top + 98, 
                  left: 145, 
                  maxHeight: 260, 
                  zIndex: 10000, 
                  elevation: 100 
                }} 
                className="w-44 bg-[#161D2B] border border-white/20 rounded-2xl p-2.5 shadow-2xl"
              >
                <ScrollView 
                  style={{ flex: 1 }} 
                  contentContainerStyle={{ paddingBottom: 8 }}
                  showsVerticalScrollIndicator={true} 
                  nestedScrollEnabled={true}
                  bounces={true}
                >
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedYear('All');
                      setShowYearDropdown(false);
                    }}
                    className={`px-3 py-2.5 rounded-xl mb-1 flex-row items-center justify-between ${
                      selectedYear === 'All' ? 'bg-indigoAcc/30 border border-indigoAcc/50' : 'active:bg-white/5'
                    }`}
                  >
                    <Text className={`text-xs ${selectedYear === 'All' ? 'font-bold text-indigoAcc-light' : 'font-medium text-white'}`}>
                      All Years
                    </Text>
                  </TouchableOpacity>

                  {availableYears.map(yr => {
                    const isSelected = selectedYear === yr;
                    const hasData = yearHasData(yr);
                    return (
                      <TouchableOpacity
                        key={yr}
                        onPress={() => {
                          setSelectedYear(yr);
                          setShowYearDropdown(false);
                        }}
                        className={`px-3 py-2.5 rounded-xl mb-1 flex-row items-center justify-between ${
                          isSelected ? 'bg-indigoAcc/30 border border-indigoAcc/50' : 'active:bg-white/5'
                        }`}
                      >
                        <Text className={`text-xs ${isSelected ? 'font-bold text-indigoAcc-light' : 'font-medium text-white'}`}>
                          {yr}
                        </Text>
                        {hasData && (
                          <View className="w-1.5 h-1.5 rounded-full bg-mint" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {/* SCROLLABLE CONTENT AREA */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80, paddingHorizontal: 20 }}>
          
          {/* METRICS SUMMARY CARDS */}
          <View className="mb-6">
            {/* NET SAVINGS (HIGHLIGHT CARD) */}
            <View 
              style={{ 
                backgroundColor: netSavings >= 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                borderColor: netSavings >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)' 
              }} 
              className="border rounded-[24px] p-5 mb-3.5 flex-row justify-between items-center shadow-sm"
            >
              <View>
                <Text className={`${theme.subtext} text-[10px] font-bold uppercase tracking-wider`}>Net Savings</Text>
                <Text className={`text-2xl font-extrabold tracking-tight mt-1.5 ${netSavings >= 0 ? 'text-mint' : 'text-coral'}`}>
                  ₹{netSavings.toFixed(2)}
                </Text>
              </View>
              <View 
                style={{ backgroundColor: netSavings >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)' }} 
                className="p-3.5 rounded-2xl"
              >
                <Icons.IndianRupee size={20} color={netSavings >= 0 ? '#10B981' : '#EF4444'} strokeWidth={2.5} />
              </View>
            </View>

            {/* INFLOW / OUTFLOW SIDE-BY-SIDE SPLITS */}
            <View className="flex-row justify-between space-x-3.5">
              <View className={`flex-1 ${theme.card} border ${theme.border} rounded-[20px] p-5 flex-row items-center justify-between shadow-sm`}>
                <View>
                  <Text className={`${theme.subtext} text-[10px] font-bold uppercase tracking-wider`}>Inflow</Text>
                  <Text className="text-mint text-lg font-extrabold tracking-tight mt-1">
                    ₹{totalIncome.toFixed(2)}
                  </Text>
                </View>
                <View className="bg-mint/10 p-2.5 rounded-xl">
                  <Icons.ArrowDownLeft size={14} color="#10B981" />
                </View>
              </View>

              <View className={`flex-grow flex-1 ${theme.card} border ${theme.border} rounded-[20px] p-5 flex-row items-center justify-between shadow-sm`}>
                <View>
                  <Text className={`${theme.subtext} text-[10px] font-bold uppercase tracking-wider`}>Outflow</Text>
                  <Text className="text-coral text-lg font-extrabold tracking-tight mt-1">
                    ₹{totalExpense.toFixed(2)}
                  </Text>
                </View>
                <View className="bg-coral-dim p-2.5 rounded-xl">
                  <Icons.ArrowUpRight size={14} color="#EF4444" />
                </View>
              </View>
            </View>
          </View>

          {/* DETAILED CONTENT DISPLAY */}
          {initialViewType === 'velocity' ? (
            <View>
              <Text className={`${theme.subtext} text-[10px] font-extrabold uppercase tracking-widest mb-4 ml-1`}>
                Daily Spend Timeline ({dailyExpenses.length} Days)
              </Text>

              {dailyExpenses.length > 0 ? (
                dailyExpenses.map(item => {
                  const [yr, mo, dy] = item.date.split('-');
                  const formattedDate = `${dy}/${mo}/${yr}`;

                  return (
                    <View 
                      key={item.date} 
                      className={`bg-[#161D2B]/50 border ${theme.border} rounded-[24px] p-5 mb-4 flex-row justify-between items-center shadow-md`}
                    >
                      <View className="flex-row items-center">
                        <View className="bg-indigoAcc/10 p-3 rounded-2xl mr-4">
                          <Icons.Calendar size={16} color="#6366F1" strokeWidth={2} />
                        </View>
                        <Text className="text-white text-sm font-extrabold">{formattedDate}</Text>
                      </View>
                      <Text className="text-coral text-sm font-black">
                        -₹{item.amount.toFixed(2)}
                      </Text>
                    </View>
                  );
                })
              ) : (
                <View className={`py-12 items-center ${theme.glassBg} border ${theme.border} border-dashed rounded-[24px] mt-2`}>
                  <Icons.HelpCircle size={28} className={theme.subtext} strokeWidth={1.5} />
                  <Text className={`${theme.subtext} text-xs mt-2`}>No expenses in this period</Text>
                </View>
              )}
            </View>
          ) : (
            <View>
              <View className="flex-row justify-between items-center mb-4 ml-1">
                <Text className={`${theme.subtext} text-[10px] font-extrabold uppercase tracking-widest`}>
                  Category Breakdown Chart ({categoryBreakdown.length} Categories)
                </Text>
                {categoryBreakdown.length > 3 && (
                  <Text className="text-indigoAcc-light text-[9px] font-bold">
                    Swipe horizontally ➔
                  </Text>
                )}
              </View>

              {categoryBreakdown.length > 0 ? (
                <>
                  {/* HORIZONTAL SWIPABLE COLUMN CHART */}
                  <View className={`bg-[#161D2B]/60 border ${theme.border} rounded-[28px] p-4 mb-8 shadow-xl`}>
                    
                    {/* Header info inside chart */}
                    <View className="flex-row justify-between items-center mb-3 px-2">
                      <View>
                        <Text className="text-white text-sm font-extrabold">Spending Distribution</Text>
                        <Text className={`${theme.subtext} text-[10px] mt-0.5`}>Tap any column to inspect category</Text>
                      </View>
                      <View className="bg-indigoAcc/15 px-3 py-1.5 rounded-xl border border-indigoAcc/30">
                        <Text className="text-indigoAcc-light text-xs font-black">
                          Total: ₹{totalExpense.toFixed(0)}
                        </Text>
                      </View>
                    </View>

                    {/* Chart Plot Area with Y-Axis & Horizontal Scrolling Bars */}
                    <View className="flex-row items-end" style={{ height: 320 }}>
                      
                      {/* Left Y-Axis Labels */}
                      <View className="justify-between items-end pr-2 pt-12 pb-14" style={{ height: 320, width: 44 }}>
                        <Text className="text-mutedText text-[9px] font-bold">
                          {formatShortCurrency(maxCategoryAmount)}
                        </Text>
                        <Text className="text-mutedText text-[9px] font-bold">
                          {formatShortCurrency(maxCategoryAmount * 0.75)}
                        </Text>
                        <Text className="text-mutedText text-[9px] font-bold">
                          {formatShortCurrency(maxCategoryAmount * 0.5)}
                        </Text>
                        <Text className="text-mutedText text-[9px] font-bold">
                          {formatShortCurrency(maxCategoryAmount * 0.25)}
                        </Text>
                        <Text className="text-mutedText text-[9px] font-bold">₹0</Text>
                      </View>

                      {/* Right Horizontally Scrollable Bar Area */}
                      <View className="flex-1" style={{ height: 320 }}>
                        
                        {/* Background Grid Lines */}
                        <View style={StyleSheet.absoluteFillObject} className="justify-between pt-12 pb-14 pointer-events-none">
                          <View className="w-full h-px bg-white/[0.08]" />
                          <View className="w-full h-px bg-white/[0.06] border-t border-dashed border-white/10" />
                          <View className="w-full h-px bg-white/[0.06] border-t border-dashed border-white/10" />
                          <View className="w-full h-px bg-white/[0.06] border-t border-dashed border-white/10" />
                          <View className="w-full h-px bg-white/[0.15]" />
                        </View>

                        {/* Horizontal Scroll Columns */}
                        <ScrollView 
                          horizontal 
                          showsHorizontalScrollIndicator={true}
                          contentContainerStyle={{ paddingHorizontal: 8, alignItems: 'flex-end', minWidth: '100%' }}
                        >
                          {categoryBreakdown.map((item, idx) => {
                            const isSelected = selectedCategory === item.name;
                            const barPlotHeight = 155;
                            const calculatedHeight = (item.amount / maxCategoryAmount) * barPlotHeight;
                            const barHeight = Math.max(calculatedHeight, 10);
                            const CatIcon = (Icons as any)[item.icon || ''] || Icons.HelpCircle;

                            return (
                              <TouchableOpacity
                                key={idx}
                                activeOpacity={0.8}
                                onPress={() => toggleCategoryExpand(item.name)}
                                className="items-center mr-5 justify-end"
                                style={{ width: 68 }}
                              >
                                {/* Column Top Amount Badge (Full visibility with dedicated top headroom) */}
                                <View className="items-center mb-2.5" style={{ minHeight: 42, justifyContent: 'flex-end' }}>
                                  <Text 
                                    numberOfLines={1}
                                    className={`text-[11px] font-black ${isSelected ? 'text-white' : 'text-indigoAcc-light'}`}
                                  >
                                    ₹{item.amount >= 10000 ? `${(item.amount / 1000).toFixed(1)}k` : Math.round(item.amount)}
                                  </Text>
                                  <Text className="text-[9px] font-bold text-mutedText mt-0.5">
                                    {item.percent.toFixed(0)}%
                                  </Text>
                                </View>

                                {/* Column Bar Track & Fill */}
                                <View 
                                  style={{ height: barPlotHeight, width: 34 }} 
                                  className="justify-end items-center rounded-2xl bg-white/[0.04] overflow-hidden relative"
                                >
                                  <View 
                                    style={{ 
                                      height: barHeight, 
                                      width: 34,
                                      backgroundColor: item.color,
                                      borderTopLeftRadius: 12,
                                      borderTopRightRadius: 12,
                                      borderBottomLeftRadius: 6,
                                      borderBottomRightRadius: 6,
                                      shadowColor: item.color,
                                      shadowOffset: { width: 0, height: -2 },
                                      shadowOpacity: isSelected ? 0.6 : 0.2,
                                      shadowRadius: 6,
                                      elevation: isSelected ? 8 : 2,
                                    }} 
                                    className={isSelected ? 'border-2 border-white' : ''}
                                  />
                                </View>

                                {/* Column Base (Icon & Name along X-Axis) */}
                                <View className="items-center mt-2.5" style={{ width: 68 }}>
                                  <View 
                                    style={{ backgroundColor: isSelected ? item.color : item.color + '20' }} 
                                    className="w-6 h-6 rounded-lg justify-center items-center mb-1 overflow-hidden"
                                  >
                                    {(item.icon && (item.icon.startsWith('uri:') || item.icon.startsWith('data:'))) ? (
                                      <Image 
                                        source={{ uri: item.icon.startsWith('uri:') ? item.icon.replace('uri:', '') : item.icon }} 
                                        style={{ width: 14, height: 14 }} 
                                      />
                                    ) : (
                                      <CatIcon size={12} color={isSelected ? '#FFFFFF' : item.color} />
                                    )}
                                  </View>
                                  <Text 
                                    numberOfLines={1} 
                                    className={`text-[10px] text-center w-full ${
                                      isSelected ? 'text-white font-extrabold' : 'text-white/80 font-semibold'
                                    }`}
                                  >
                                    {item.name}
                                  </Text>
                                  <Text className="text-[8px] text-mutedText mt-0.5">
                                    {item.count} {item.count === 1 ? 'txn' : 'txns'}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    </View>
                  </View>

                  {/* DETAILED CATEGORY & SUBCATEGORY BREAKDOWN ACCORDION LIST */}
                  <View className="px-1">
                    <Text className={`${theme.subtext} text-[10px] font-extrabold uppercase tracking-widest mb-3 ml-1`}>
                      Detailed Breakdown & Subcategories
                    </Text>

                    {categoryBreakdown.map((item, idx) => {
                      const isExpanded = expandedCategories[item.name];
                      const isSelected = selectedCategory === item.name;
                      const CatIcon = (Icons as any)[item.icon || ''] || Icons.HelpCircle;

                      return (
                        <View 
                          key={idx}
                          className={`mb-3 rounded-2xl border overflow-hidden ${
                            isSelected 
                              ? 'border-indigoAcc bg-indigoAcc/10' 
                              : `${theme.card} border-${theme.isDark ? '[#1F222C]' : '[#E5E7EB]'}`
                          }`}
                        >
                          <TouchableOpacity 
                            onPress={() => toggleCategoryExpand(item.name)}
                            className="flex-row justify-between items-center p-4"
                          >
                            <View className="flex-row items-center flex-1 mr-2">
                              <View 
                                style={{ backgroundColor: item.color + '25' }} 
                                className="w-8 h-8 rounded-xl justify-center items-center mr-3 overflow-hidden"
                              >
                                {(item.icon && (item.icon.startsWith('uri:') || item.icon.startsWith('data:'))) ? (
                                  <Image 
                                    source={{ uri: item.icon.startsWith('uri:') ? item.icon.replace('uri:', '') : item.icon }} 
                                    style={{ width: 16, height: 16 }} 
                                  />
                                ) : (
                                  <CatIcon size={15} color={item.color} />
                                )}
                              </View>
                              <View className="flex-1">
                                <Text className={`${theme.text} text-sm font-bold truncate`}>{item.name}</Text>
                                <Text className={`${theme.subtext} text-[10px] font-medium mt-0.5`}>
                                  {item.count} {item.count === 1 ? 'transaction' : 'transactions'}
                                </Text>
                              </View>
                            </View>
                            
                            <View className="flex-row items-center">
                              <View className="items-end mr-3">
                                <Text className={`${theme.text} text-sm font-extrabold`}>
                                  ₹{item.amount.toFixed(2)}
                                </Text>
                                <Text className="text-indigoAcc-light text-[10px] font-extrabold mt-0.5">
                                  {item.percent.toFixed(1)}%
                                </Text>
                              </View>
                              {isExpanded ? (
                                <Icons.ChevronUp size={16} color={theme.mutedTextColor} />
                              ) : (
                                <Icons.ChevronDown size={16} color={theme.mutedTextColor} />
                              )}
                            </View>
                          </TouchableOpacity>

                          {/* SUBCATEGORIES ACCORDION PANEL */}
                          {isExpanded && item.subcategories.length > 0 && (
                            <View className="px-4 pb-4 pt-1 border-t border-white/5 bg-white/[0.02]">
                              <View className="flex-row justify-between items-center mb-2.5 mt-1">
                                <Text className={`${theme.subtext} text-[9px] font-extrabold uppercase tracking-wider`}>
                                  Subcategory Breakdown ({item.subcategories.length})
                                </Text>
                                <Text className={`${theme.subtext} text-[9px] font-semibold uppercase tracking-wider`}>
                                  Share of Category
                                </Text>
                              </View>

                              {item.subcategories.map((sub, sIdx) => (
                                <View key={sIdx} className="mb-2.5 last:mb-0">
                                  <View className="flex-row justify-between items-center mb-1">
                                    <View className="flex-row items-center flex-1 mr-2">
                                      <Text className={`${theme.text} text-xs font-semibold`}>{sub.name}</Text>
                                      <Text className={`${theme.subtext} text-[9px] font-medium ml-2`}>
                                        ({sub.count} {sub.count === 1 ? 'txn' : 'txns'})
                                      </Text>
                                    </View>
                                    <View className="flex-row items-center space-x-2">
                                      <Text className={`${theme.text} text-xs font-bold mr-1`}>
                                        ₹{sub.amount.toFixed(2)}
                                      </Text>
                                      <Text className="text-indigoAcc-light text-[10px] font-extrabold w-11 text-right">
                                        {sub.percent.toFixed(1)}%
                                      </Text>
                                    </View>
                                  </View>

                                  {/* Progress bar for subcategory share */}
                                  <View 
                                    style={{ backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} 
                                    className="w-full h-1.5 rounded-full overflow-hidden"
                                  >
                                    <View 
                                      style={{ width: `${Math.min(sub.percent, 100)}%`, backgroundColor: item.color }} 
                                      className="h-full rounded-full" 
                                    />
                                  </View>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </>
              ) : (
                <View className={`py-12 items-center ${theme.glassBg} border ${theme.border} border-dashed rounded-[24px] mt-2`}>
                  <Icons.HelpCircle size={28} className={theme.subtext} strokeWidth={1.5} />
                  <Text className={`${theme.subtext} text-xs mt-2`}>No expenses to classify in this period</Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};


