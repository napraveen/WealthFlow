import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { RichTransaction } from '../context/DatabaseContext';
import { useTheme } from '../utils/theme';

interface CategoryBreakdownChartProps {
  transactions: RichTransaction[];
}

export const CategoryBreakdownChart: React.FC<CategoryBreakdownChartProps> = ({ transactions }) => {
  const theme = useTheme();

  // Get current month "YYYY-MM"
  const currentMonthYear = new Date().toISOString().substring(0, 7);
  const currentMonthExpenses = transactions.filter(t => 
    t.date.startsWith(currentMonthYear) && t.type === 'expense'
  );

  const totalExpense = currentMonthExpenses.reduce((sum, t) => sum + t.amount, 0);

  // Group by category
  const categoryMap: { [id: string]: { name: string; amount: number; color: string } } = {};
  
  currentMonthExpenses.forEach(t => {
    const catId = t.categoryId || 'uncategorized';
    const catName = t.categoryName || 'Uncategorized';
    const catColor = t.categoryColor || '#9CA3AF';

    if (!categoryMap[catId]) {
      categoryMap[catId] = {
        name: catName,
        amount: 0,
        color: catColor,
      };
    }
    categoryMap[catId].amount += t.amount;
  });

  // Sort by amount descending
  const sortedCategories = Object.values(categoryMap).sort((a, b) => b.amount - a.amount);

  // Take top 3, and group rest into "Others"
  let displayCategories: { name: string; amount: number; color: string; percent: number }[] = [];
  
  if (sortedCategories.length <= 4) {
    displayCategories = sortedCategories.map(c => ({
      ...c,
      percent: totalExpense > 0 ? (c.amount / totalExpense) * 100 : 0
    }));
  } else {
    const top3 = sortedCategories.slice(0, 3);
    const othersAmount = sortedCategories.slice(3).reduce((sum, c) => sum + c.amount, 0);
    
    displayCategories = top3.map(c => ({
      ...c,
      percent: totalExpense > 0 ? (c.amount / totalExpense) * 100 : 0
    }));
    
    displayCategories.push({
      name: 'Others',
      amount: othersAmount,
      color: '#6B7280',
      percent: totalExpense > 0 ? (othersAmount / totalExpense) * 100 : 0
    });
  }

  // Get month name
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const currentMonthName = monthNames[new Date().getMonth()];
  const currentYear = new Date().getFullYear();

  return (
    <View style={{ height: 240 }} className={`${theme.card} border ${theme.border} rounded-3xl p-5 mb-6 shadow-sm justify-between`}>
      <View className="flex-row justify-between items-end mb-4">
        <View>
          <Text className={`${theme.subtext} text-xs font-semibold uppercase tracking-wider`}>
            Category Breakdown
          </Text>
          <Text className={`${theme.text} text-2xl font-bold tracking-tight mt-1`}>
            ₹{totalExpense.toFixed(2)}
          </Text>
        </View>

        <View className="items-end">
          <View className="flex-row items-center px-2.5 py-1 rounded-full bg-white/5 border border-white/5">
            <Text className={`text-[9px] font-extrabold uppercase tracking-wider ${theme.text}`}>
              {currentMonthName} {currentYear}
            </Text>
          </View>
          <Text className="text-[10px] text-mutedText mt-1">Monthly Distribution</Text>
        </View>
      </View>

      {/* Progress Bars for Top Categories */}
      <ScrollView 
        className="flex-1 mt-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, justifyContent: displayCategories.length > 0 ? 'flex-start' : 'center' }}
      >
        <View className="space-y-2">
          {displayCategories.length > 0 ? (
            displayCategories.map((item, idx) => (
              <View key={idx} className="mb-2.5">
                <View className="flex-row justify-between items-center mb-1.5">
                  <View className="flex-row flex-1 items-center mr-2">
                    <Text numberOfLines={1} className={`${theme.text} text-[10px] font-bold max-w-[70%]`}>
                      {item.name}
                    </Text>
                    <Text className={`${theme.subtext} text-[10px] font-medium ml-1`}>
                      • {item.percent.toFixed(0)}%
                    </Text>
                  </View>
                  <Text className={`${theme.text} text-[10px] font-extrabold`}>
                    ₹{item.amount.toFixed(0)}
                  </Text>
                </View>
                <View className="w-full h-2 bg-black/5 rounded-full overflow-hidden">
                  <View 
                    style={{ 
                      width: `${item.percent}%`, 
                      backgroundColor: item.color 
                    }} 
                    className="h-full rounded-full" 
                  />
                </View>
              </View>
            ))
          ) : (
            <View className="py-4 items-center">
              <Text className={`${theme.subtext} text-xs italic`}>No expenses recorded this month</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};
