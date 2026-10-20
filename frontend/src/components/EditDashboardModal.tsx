import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, Animated } from 'react-native';
import * as Icons from 'lucide-react-native';
import { useTheme } from '../utils/theme';

interface EditDashboardModalProps {
  visible: boolean;
  onClose: () => void;
  accountsOrder: string[];
  chartsOrder: string[];
  onSave: (accountsOrder: string[], chartsOrder: string[]) => void;
}

export const EditDashboardModal: React.FC<EditDashboardModalProps> = ({ 
  visible, 
  onClose, 
  accountsOrder, 
  chartsOrder, 
  onSave 
}) => {
  const theme = useTheme();
  
  // Local state for editing before save
  const [localAccOrder, setLocalAccOrder] = useState(accountsOrder);
  const [localChartOrder, setLocalChartOrder] = useState(chartsOrder);

  useEffect(() => {
    if (visible) {
      setLocalAccOrder(accountsOrder);
      setLocalChartOrder(chartsOrder);
    }
  }, [visible, accountsOrder, chartsOrder]);

  const moveItem = (list: string[], setList: (v: string[]) => void, index: number, direction: 'up' | 'down') => {
    const newList = [...list];
    if (direction === 'up' && index > 0) {
      const temp = newList[index - 1];
      newList[index - 1] = newList[index];
      newList[index] = temp;
      setList(newList);
    } else if (direction === 'down' && index < newList.length - 1) {
      const temp = newList[index + 1];
      newList[index + 1] = newList[index];
      newList[index] = temp;
      setList(newList);
    }
  };

  const getChartName = (id: string) => {
    if (id === 'velocity') return 'Spending Velocity';
    if (id === 'categories') return 'Category Breakdown';
    return id;
  };

  const getAccountName = (id: string) => {
    if (id === 'acc-cash') return 'Cash Account';
    if (id === 'acc-upi') return 'UPI Account';
    if (id === 'acc-bank') return 'Bank Account';
    if (id === 'acc-credit') return 'Credit Card';
    return id; // fallback
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/85">
        <View className={`${theme.card} border-t-2 border-obsidian-border rounded-t-[32px] p-6 pb-12 h-[80%]`}>
          <View className="flex-row justify-between items-center mb-6 mt-2">
            <Text className={`${theme.text} text-xl font-bold tracking-tight`}>
              Edit Dashboard Layout
            </Text>
            <TouchableOpacity onPress={onClose} className="p-2 bg-white/5 rounded-full border border-white/10">
              <Icons.X size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
            {/* Accounts Ordering */}
            <View className="mb-8">
              <Text className={`${theme.subtext} text-xs font-semibold uppercase tracking-wider mb-4`}>
                Accounts Display Order
              </Text>
              
              <View className="space-y-3">
                {localAccOrder.map((accId, index) => (
                  <View key={accId} className={`flex-row items-center justify-between p-4 rounded-2xl ${theme.inputBg} border ${theme.border}`}>
                    <View className="flex-row items-center space-x-3">
                      <Icons.GripVertical size={16} color={theme.isDark ? '#4B5563' : '#9CA3AF'} />
                      <Text className={`${theme.text} text-sm font-bold`}>{getAccountName(accId)}</Text>
                    </View>
                    <View className="flex-row space-x-2">
                      <TouchableOpacity 
                        onPress={() => moveItem(localAccOrder, setLocalAccOrder, index, 'up')}
                        disabled={index === 0}
                        className={`p-2 rounded-xl ${index === 0 ? 'opacity-30' : 'bg-white/10 active:bg-white/20'}`}
                      >
                        <Icons.ChevronUp size={16} color={theme.isDark ? '#E5E7EB' : '#4B5563'} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => moveItem(localAccOrder, setLocalAccOrder, index, 'down')}
                        disabled={index === localAccOrder.length - 1}
                        className={`p-2 rounded-xl ${index === localAccOrder.length - 1 ? 'opacity-30' : 'bg-white/10 active:bg-white/20'}`}
                      >
                        <Icons.ChevronDown size={16} color={theme.isDark ? '#E5E7EB' : '#4B5563'} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Charts Ordering */}
            <View className="mb-6">
              <Text className={`${theme.subtext} text-xs font-semibold uppercase tracking-wider mb-4`}>
                Charts Display Order
              </Text>
              
              <View className="space-y-3">
                {localChartOrder.map((chartId, index) => (
                  <View key={chartId} className={`flex-row items-center justify-between p-4 rounded-2xl ${theme.inputBg} border ${theme.border}`}>
                    <View className="flex-row items-center space-x-3">
                      <Icons.GripVertical size={16} color={theme.isDark ? '#4B5563' : '#9CA3AF'} />
                      <Text className={`${theme.text} text-sm font-bold`}>{getChartName(chartId)}</Text>
                    </View>
                    <View className="flex-row space-x-2">
                      <TouchableOpacity 
                        onPress={() => moveItem(localChartOrder, setLocalChartOrder, index, 'up')}
                        disabled={index === 0}
                        className={`p-2 rounded-xl ${index === 0 ? 'opacity-30' : 'bg-white/10 active:bg-white/20'}`}
                      >
                        <Icons.ChevronUp size={16} color={theme.isDark ? '#E5E7EB' : '#4B5563'} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => moveItem(localChartOrder, setLocalChartOrder, index, 'down')}
                        disabled={index === localChartOrder.length - 1}
                        className={`p-2 rounded-xl ${index === localChartOrder.length - 1 ? 'opacity-30' : 'bg-white/10 active:bg-white/20'}`}
                      >
                        <Icons.ChevronDown size={16} color={theme.isDark ? '#E5E7EB' : '#4B5563'} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>

          <View className="pt-4 flex-row space-x-3 mt-4">
            <TouchableOpacity 
              onPress={onClose}
              className="flex-1 p-4 rounded-2xl border border-white/10 items-center justify-center bg-white/5 active:bg-white/10"
            >
              <Text className={`${theme.text} font-bold`}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => {
                onSave(localAccOrder, localChartOrder);
                onClose();
              }}
              className="flex-1 p-4 rounded-2xl items-center justify-center bg-indigoAcc shadow-md shadow-indigoAcc/20 active:bg-indigoAcc-dim"
            >
              <Text className="text-white font-bold">Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
