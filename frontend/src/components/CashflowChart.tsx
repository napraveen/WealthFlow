import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Line } from 'react-native-svg';
import { RichTransaction } from '../context/DatabaseContext';
import { useTheme } from '../utils/theme';

interface CashflowChartProps {
  transactions: RichTransaction[];
  onPress: () => void;
}

export const CashflowChart: React.FC<CashflowChartProps> = ({ transactions, onPress }) => {
  const theme = useTheme();
  
  // Interactive scrubber state
  const [activePoint, setActivePoint] = useState<{ x: number; y: number; value: number; day: string } | null>(null);

  const getPastDateString = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  };

  const last7Days = Array.from({ length: 7 }, (_, i) => getPastDateString(6 - i));
  const dailySpent = last7Days.map(date => {
    return transactions
      .filter(tx => tx.date === date && tx.type === 'expense')
      .reduce((sum, tx) => sum + tx.amount, 0);
  });

  const getWeeklyTotal = (startDaysAgo: number, endDaysAgo: number) => {
    const dates = Array.from({ length: endDaysAgo - startDaysAgo + 1 }, (_, i) => 
      getPastDateString(endDaysAgo - i)
    );
    return transactions
      .filter(tx => dates.includes(tx.date) && tx.type === 'expense')
      .reduce((sum, tx) => sum + tx.amount, 0);
  };

  const currentWeekSpent = getWeeklyTotal(0, 6);
  const previousWeekSpent = getWeeklyTotal(7, 13);
  
  let velocityPercent = 0;
  let velocityDirection: 'up' | 'down' | 'flat' = 'flat';

  if (previousWeekSpent > 0) {
    velocityPercent = ((currentWeekSpent - previousWeekSpent) / previousWeekSpent) * 100;
    if (velocityPercent > 0.5) velocityDirection = 'up';
    else if (velocityPercent < -0.5) velocityDirection = 'down';
  } else if (currentWeekSpent > 0) {
    velocityPercent = 100;
    velocityDirection = 'up';
  }

  const maxVal = Math.max(...dailySpent, 100);
  const width = 300;
  const height = 90;
  const padding = 10;

  const points = dailySpent.map((val, index) => {
    const x = padding + (index * (width - padding * 2)) / 6;
    const y = height - padding - (val / maxVal) * (height - padding * 2);
    return { x, y, value: val };
  });

  const linePath = points.reduce((path, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${path} L ${pt.x} ${pt.y}`;
  }, '');

  const areaPath = points.length > 0 
    ? `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z` 
    : '';

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const xLabels = last7Days.map(dateStr => {
    const date = new Date(dateStr + 'T00:00:00');
    return daysOfWeek[date.getDay()];
  });

  // Handle touch interactions to find closest point on horizontal axis
  const handleTouch = (evt: any) => {
    const touchX = evt.nativeEvent.locationX;
    if (points.length === 0) return;

    let closestPt = points[0];
    let closestIdx = 0;
    let minDiff = Math.abs(points[0].x - touchX);

    for (let i = 1; i < points.length; i++) {
      const diff = Math.abs(points[i].x - touchX);
      if (diff < minDiff) {
        minDiff = diff;
        closestPt = points[i];
        closestIdx = i;
      }
    }

    const dateStr = last7Days[closestIdx];
    const dateObj = new Date(dateStr + 'T00:00:00');
    const dayName = daysOfWeek[dateObj.getDay()];
    const formattedDay = `${dayName} (${dateStr.substring(8, 10)}/${dateStr.substring(5, 7)})`;

    setActivePoint({
      x: closestPt.x,
      y: closestPt.y,
      value: closestPt.value,
      day: formattedDay
    });
  };

  return (
    <View 
      style={{ height: 240 }}
      className={`${theme.card} border ${theme.border} rounded-3xl p-5 mb-6 shadow-sm justify-between`}
    >
      {/* HEADER SECTION (Pressable to open Detailed Analytics) */}
      <TouchableOpacity 
        activeOpacity={0.8}
        onPress={onPress}
        className="mb-4"
      >
        <View className="flex-row justify-between items-end">
          <View>
            <Text className={`${theme.subtext} text-xs font-semibold uppercase tracking-wider`}>
              {activePoint ? activePoint.day : 'Spending Velocity'}
            </Text>
            <Text className={`${theme.text} text-2xl font-bold tracking-tight mt-1`}>
              ₹{activePoint ? activePoint.value.toFixed(2) : currentWeekSpent.toFixed(2)}
            </Text>
          </View>

          <View className="items-end">
            <View className={`flex-row items-center px-2.5 py-1 rounded-full ${
              velocityDirection === 'down' 
                ? 'bg-mint-dim' 
                : velocityDirection === 'up' 
                  ? 'bg-coral-dim' 
                  : 'bg-white/5'
            }`}>
              <Text className={`text-xs font-semibold ${
                velocityDirection === 'down' 
                  ? 'text-mint' 
                  : velocityDirection === 'up' 
                    ? 'text-coral' 
                    : 'text-mutedText'
              }`}>
                {velocityDirection === 'down' ? '↓' : velocityDirection === 'up' ? '↑' : ''}
                {Math.abs(velocityPercent).toFixed(1)}% vs L/W
              </Text>
            </View>
            <Text className="text-[10px] text-mutedText mt-1">Daily Rolling Velocity</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* INTERACTIVE CHART SCRUBBER VIEW (NO REDIRECT TRIGGER) */}
      <View 
        onTouchStart={handleTouch}
        onTouchMove={handleTouch}
        onTouchEnd={() => setActivePoint(null)}
        className="h-[95px] items-center justify-center"
      >
        {points.length > 0 && (
          <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
            <Defs>
              <LinearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0%" stopColor="#6366F1" />
                <Stop offset="100%" stopColor="#10B981" />
              </LinearGradient>

              <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#6366F1" stopOpacity="0.25" />
                <Stop offset="100%" stopColor="#6366F1" stopOpacity="0.00" />
              </LinearGradient>
            </Defs>

            <Path d={areaPath} fill="url(#areaGrad)" />

            <Path 
              d={linePath} 
              fill="none" 
              stroke="url(#lineGrad)" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />

            {activePoint && (
              <Line 
                x1={activePoint.x} 
                y1={0} 
                x2={activePoint.x} 
                y2={height} 
                stroke="#6366F1" 
                strokeWidth="1" 
                strokeDasharray="4 4" 
              />
            )}

            {points.map((pt, idx) => (
              <Circle 
                key={idx} 
                cx={pt.x} 
                cy={pt.y} 
                r={activePoint && activePoint.x === pt.x ? '5' : '3'} 
                fill={activePoint && activePoint.x === pt.x ? '#10B981' : '#6366F1'} 
                stroke={theme.isDark ? '#050505' : '#FFFFFF'} 
                strokeWidth={activePoint && activePoint.x === pt.x ? '2' : '1'} 
              />
            ))}
          </Svg>
        )}
      </View>

      {/* FOOTER TIMELINE LABELS (Pressable to open Detailed Analytics) */}
      <TouchableOpacity 
        activeOpacity={0.8}
        onPress={onPress}
        className="mt-2"
      >
        <View className="flex-row justify-between px-2">
          {xLabels.map((lbl, idx) => (
            <Text key={idx} className="text-[10px] text-mutedText font-medium w-8 text-center">
              {lbl}
            </Text>
          ))}
        </View>
      </TouchableOpacity>
    </View>
  );
};
