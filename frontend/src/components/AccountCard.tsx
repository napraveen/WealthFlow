import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import * as Icons from 'lucide-react-native';
import { Account } from '../db/schema';
import { useTheme } from '../utils/theme';
import { useDatabase } from '../context/DatabaseContext';

interface AccountCardProps {
  account: Account;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.82;

export const AccountCard: React.FC<AccountCardProps> = ({ account }) => {
  const theme = useTheme();
  const { transactions } = useDatabase();
  const IconComponent = (Icons as any)[account.icon] || Icons.HelpCircle;
  const displayBalance = account.balance;
  
  // Calculate total Received & Spent for this account
  const accountTxs = transactions.filter(t => t.accountId === account.id);
  const totalReceived = accountTxs
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalSpent = accountTxs
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <View 
      style={[styles.card, { borderColor: account.color + '40', backgroundColor: theme.cardBg }]} 
      className="rounded-3xl p-5 mr-4 overflow-hidden relative border shadow-sm"
    >
      <View 
        style={[styles.glow, { backgroundColor: account.color }]} 
        className="opacity-5 absolute -top-12 -right-12 w-32 h-32 rounded-full blur-2xl" 
      />

      {/* HEADER SECTION (SWAPPED TO BALANCE) */}
      <View className="flex-row justify-between items-center mb-1">
        <View className="mb-1 pl-1">
          <Text style={{ color: account.color }} className="text-3xl font-black tracking-tighter">
            ₹{displayBalance.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* SUB-HEADER NAME */}
      <View className="mb-3 flex-row items-center space-x-2">
        <View 
          style={{ backgroundColor: account.color + '15' }} 
          className="p-1.5 rounded-xl justify-center items-center"
        >
          <IconComponent size={14} color={account.color} strokeWidth={1.75} />
        </View>
        <Text className={`font-semibold text-xs tracking-wide ml-1.5 ${theme.text}`}>
          {account.name}
        </Text>
      </View>

      {/* SPLIT RECEIVED AND SPENT SECTION */}
      <View className="mt-1 flex-1 justify-center">
        <View style={{ borderColor: theme.borderColor }} className={`flex-row justify-between items-center ${theme.inputBg} rounded-2xl p-3 border`}>
          <View className="flex-1">
            <Text className={`${theme.subtext} text-[9px] font-bold uppercase tracking-wider`}>Received</Text>
            <Text className="text-mint text-sm font-extrabold mt-0.5">
              ₹{totalReceived.toFixed(2)}
            </Text>
          </View>

          <View style={{ backgroundColor: theme.borderColor }} className="w-px h-8 mx-2" />

          <View className="flex-1 items-end">
            <Text className={`${theme.subtext} text-[9px] font-bold uppercase tracking-wider`}>Spent</Text>
            <Text className="text-coral text-sm font-extrabold mt-0.5">
              ₹{totalSpent.toFixed(2)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    borderWidth: 1.5,
    height: 160,
  },
  glow: {}
});
