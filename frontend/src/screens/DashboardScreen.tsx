import React, { useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar, 
  StyleSheet,
  Dimensions,
  Image,
  BackHandler
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Icons from 'lucide-react-native';
import { useDatabase } from '../context/DatabaseContext';
import { AccountCard } from '../components/AccountCard';
import { CashflowChart } from '../components/CashflowChart';
import { CategoryBreakdownChart } from '../components/CategoryBreakdownChart';
import { DetailedAnalyticsModal } from '../components/DetailedAnalyticsModal';
import { TransactionModal } from '../components/TransactionModal';
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';
import { EditDashboardModal } from '../components/EditDashboardModal';
import { CustomAlert } from '../components/CustomAlert';
import { useTheme } from '../utils/theme';

// Local date string formatter
const formatDateStr = (dateStr: string) => {
  const [year, month, day] = String(dateStr || "").split('-');
  if (!year || !month || !day) return dateStr;
  return `${day}/${month}/${year}`;
};

export const DashboardScreen: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate }) => {
  const { 
    accounts, 
    transactions, 
    totalNetWorth, 
    deleteTransaction,
    getSetting,
    updateSetting
  } = useDatabase();

  const theme = useTheme();
  const { width } = Dimensions.get('window');
  const chartWidth = width - 40;
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTxToEdit, setSelectedTxToEdit] = useState<any | null>(null);
  const [detailedAnalyticsVisible, setDetailedAnalyticsVisible] = useState(false);
  const [initialAnalyticsView, setInitialAnalyticsView] = useState<'velocity' | 'categories'>('velocity');
  const [activeChartIndex, setActiveChartIndex] = useState(0);
  const insets = useSafeAreaInsets();
  
  // Dashboard Layout state
  const [editLayoutModalVisible, setEditLayoutModalVisible] = useState(false);
  const [accountsOrder, setAccountsOrder] = useState<string[]>([]);
  const [chartsOrder, setChartsOrder] = useState<string[]>(['velocity', 'categories']);

  React.useEffect(() => {
    const accOrder = getSetting('dashboard_account_order');
    if (accOrder) {
      try { setAccountsOrder(JSON.parse(accOrder)); } catch (e) {}
    } else if (accounts.length > 0) {
      setAccountsOrder(accounts.map(a => a.id));
    }
    
    const chOrder = getSetting('dashboard_chart_order');
    if (chOrder) {
      try { setChartsOrder(JSON.parse(chOrder)); } catch (e) {}
    }
  }, [accounts]);

  const handleSaveLayout = (newAccOrder: string[], newChartOrder: string[]) => {
    setAccountsOrder(newAccOrder);
    setChartsOrder(newChartOrder);
    updateSetting('dashboard_account_order', JSON.stringify(newAccOrder));
    updateSetting('dashboard_chart_order', JSON.stringify(newChartOrder));
  };

  // --- SELECTION & CUSTOM DELETE DIALOG STATES ---
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [discardConfirmVisible, setDiscardConfirmVisible] = useState(false);

  React.useEffect(() => {
    const onBackPress = () => {
      if (isSelectionMode) {
        if (selectedTxIds.length > 1) {
          setDiscardConfirmVisible(true);
        } else {
          cancelSelection();
        }
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [isSelectionMode, selectedTxIds]);

  const handleLongPress = (id: string) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedTxIds([id]);
    }
  };

  const handlePressItem = (item: any) => {
    if (isSelectionMode) {
      if (selectedTxIds.includes(item.id)) {
        const updated = selectedTxIds.filter(id => id !== item.id);
        setSelectedTxIds(updated);
        if (updated.length === 0) {
          setIsSelectionMode(false);
        }
      } else {
        setSelectedTxIds([...selectedTxIds, item.id]);
      }
    } else {
      // Normal mode: click to edit transaction!
      setSelectedTxToEdit(item);
      setModalVisible(true);
    }
  };

  const handleSingleDelete = (id: string) => {
    setPendingDeleteIds([id]);
    setDeleteModalVisible(true);
  };

  const handleBatchDelete = () => {
    if (selectedTxIds.length === 0) return;
    setPendingDeleteIds(selectedTxIds);
    setDeleteModalVisible(true);
  };

  const confirmDeletion = async () => {
    try {
      for (const id of pendingDeleteIds) {
        await deleteTransaction(id);
      }
      setSelectedTxIds([]);
      setPendingDeleteIds([]);
      setIsSelectionMode(false);
    } catch (err) {
      console.error('Failed to batch delete:', err);
    }
  };

  const cancelSelection = () => {
    setSelectedTxIds([]);
    setIsSelectionMode(false);
  };

  const handleCancelSelectionPress = () => {
    if (selectedTxIds.length > 1) {
      setDiscardConfirmVisible(true);
    } else {
      cancelSelection();
    }
  };

  // Limit recent activity to 4 items and group them by date
  const recentTransactions = transactions.slice(0, 4);

  const groupedRecent: { [key: string]: typeof transactions } = {};
  recentTransactions.forEach(tx => {
    const title = formatDateStr(tx.date);
    if (!groupedRecent[title]) {
      groupedRecent[title] = [];
    }
    groupedRecent[title].push(tx);
  });

  const recentDates = Array.from(new Set(recentTransactions.map(t => formatDateStr(t.date))));

  // Calculate total net cashflow for a date
  const getDailyNet = (dateHeaderStr: string) => {
    const matchTxs = transactions.filter(t => formatDateStr(t.date) === dateHeaderStr);
    return matchTxs.reduce((sum, t) => {
      if (t.type === 'income') return sum + t.amount;
      if (t.type === 'expense') return sum - t.amount;
      return sum;
    }, 0);
  };

  return (
    <View 
      style={{ 
        paddingTop: insets.top,
        flex: 1 
      }} 
      className={`${theme.bg} px-5`}
    >
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bgHex} />

      {/* FLOATING ACTION SELECTION OVERLAY HEADER */}
      {isSelectionMode && (
        <View 
          className="flex-row justify-between items-center bg-[#161D2B]/90 border border-white/10 p-4 rounded-2xl mt-3 mb-2"
          style={{ zIndex: 100 }}
        >
          <View className="flex-row items-center space-x-2">
            <TouchableOpacity onPress={handleCancelSelectionPress} className="p-1">
              <Icons.X size={18} color="#6B7280" />
            </TouchableOpacity>
            <Text className="text-white text-sm font-bold ml-2">
              {selectedTxIds.length} Selected
            </Text>
          </View>

          <TouchableOpacity 
            onPress={handleBatchDelete} 
            className="p-2.5 bg-coral-dim rounded-xl border border-coral/10"
          >
            <Icons.Trash2 size={16} color="#EF4444" strokeWidth={1.5} />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContainer}
      >
        {/* TOTAL NET WORTH HEADER (RUPEES) */}
        {!isSelectionMode && (
          <View className="mb-6 mt-3">
            <Text className={`${theme.subtext} text-xs font-semibold uppercase tracking-wider`}>
              Total Net Worth
            </Text>
            <Text className={`${theme.text} text-4xl font-extrabold tracking-tight mt-1`}>
              ₹{totalNetWorth.toFixed(2)}
            </Text>
          </View>
        )}

        {/* SWIPEABLE ACCOUNTS ROW CAROUSEL */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-3">
            <Text className={`${theme.subtext} text-xs font-semibold uppercase tracking-wider`}>
              My Portfolio Accounts
            </Text>
            <TouchableOpacity onPress={() => setEditLayoutModalVisible(true)} className="p-1 px-3 bg-white/5 rounded-full border border-white/10 flex-row items-center space-x-1">
              <Icons.Settings2 size={12} color={theme.isDark ? '#E5E7EB' : '#4B5563'} />
              <Text className={`${theme.subtext} text-[10px] font-bold ml-1`}>Edit</Text>
            </TouchableOpacity>
          </View>
          {accounts.length > 0 ? (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={290}
              snapToAlignment="start"
              className="flex-row"
            >
              {[...accounts].sort((a, b) => {
                const idxA = (accountsOrder || []).indexOf(a.id);
                const idxB = (accountsOrder || []).indexOf(b.id);
                if (idxA === -1 && idxB === -1) return 0;
                if (idxA === -1) return 1;
                if (idxB === -1) return -1;
                return idxA - idxB;
              }).map(acc => (
                <AccountCard key={acc.id} account={acc} />
              ))}
            </ScrollView>
          ) : (
            <View className={`${theme.glassBg} border ${theme.border} rounded-3xl p-6 items-center`}>
              <Text className={`${theme.subtext} text-sm`}>No Accounts initialized</Text>
            </View>
          )}
        </View>

        {/* SWIPEABLE CHARTS CAROUSEL */}
        <View className="mb-1">
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={chartWidth + 12}
            snapToAlignment="start"
            bounces={false}
            overScrollMode="never"
            onScroll={(e) => {
              const offset = e.nativeEvent.contentOffset.x;
              const index = Math.round(offset / (chartWidth + 12));
              setActiveChartIndex(index);
            }}
            scrollEventThrottle={16}
            className="flex-row"
          >
            {(chartsOrder || []).map((chartId, index) => {
              const isLast = index === chartsOrder.length - 1;
              const containerStyle = { width: chartWidth, marginRight: isLast ? 0 : 12 };
              if (chartId === 'velocity') {
                return (
                  <View key="velocity" style={containerStyle}>
                    <CashflowChart 
                      transactions={transactions} 
                      onPress={() => {
                        setInitialAnalyticsView('velocity');
                        setDetailedAnalyticsVisible(true);
                      }}
                    />
                  </View>
                );
              }
              if (chartId === 'categories') {
                return (
                  <TouchableOpacity 
                    key="categories"
                    activeOpacity={0.95} 
                    onPress={() => {
                      setInitialAnalyticsView('categories');
                      setDetailedAnalyticsVisible(true);
                    }}
                    style={containerStyle}
                  >
                    <CategoryBreakdownChart transactions={transactions} />
                  </TouchableOpacity>
                );
              }
              return null;
            })}
          </ScrollView>
          
          <View className="flex-row justify-center space-x-1.5 -mt-3 mb-5">
            <View className={`w-1.5 h-1.5 rounded-full ${activeChartIndex === 0 ? 'bg-indigoAcc' : theme.isDark ? 'bg-white/20' : 'bg-[#6B7280]/30'}`} />
            <View className={`w-1.5 h-1.5 rounded-full ${activeChartIndex === 1 ? 'bg-indigoAcc' : theme.isDark ? 'bg-white/20' : 'bg-[#6B7280]/30'}`} />
          </View>
        </View>

        <View className="mb-3 flex-row justify-between items-center">
          <Text className={`${theme.subtext} text-xs font-semibold uppercase tracking-wider`}>
            Recent Activity
          </Text>
          <TouchableOpacity 
            onPress={() => onNavigate && onNavigate('transactions')} 
            className="bg-indigoAcc/10 px-3 py-1.5 rounded-full border border-indigoAcc/20"
          >
            <Text className="text-[10px] text-indigoAcc font-bold uppercase tracking-wider">
              View All
            </Text>
          </TouchableOpacity>
        </View>

        {recentTransactions.length > 0 ? (
          recentDates.map(date => {
            const dailyNet = getDailyNet(date);
            const isPositive = dailyNet >= 0;

            return (
              <View key={date} className="mb-1.5">
                {/* Date Header for Group with Daily Net Sum */}
                <View className="flex-row justify-between items-center mb-2 px-1">
                  <Text className="text-indigoAcc-light text-[10px] font-extrabold uppercase tracking-widest">
                    {date}
                  </Text>
                  <Text className={`text-[10px] font-extrabold ${isPositive ? 'text-mint' : 'text-coral'}`}>
                    {isPositive ? '+' : '-'}₹{Math.abs(dailyNet).toFixed(2)}
                  </Text>
                </View>

                {/* Transactions list in this date group */}
                {(groupedRecent[date] || []).map(item => {
                  const isIncome = item.type === 'income';
                  const isItemSelected = selectedTxIds.includes(item.id);

                  let TxIcon = Icons.HelpCircle;
                  let iconColor = '#9CA3AF';
                  let iconBg = 'rgba(156, 163, 175, 0.1)';

                  if (item.categoryIcon && item.categoryColor) {
                    TxIcon = (Icons as any)[item.categoryIcon] || Icons.HelpCircle;
                    iconColor = item.categoryColor;
                    iconBg = item.categoryColor + '15';
                  }

                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.8}
                      delayLongPress={250}
                      onLongPress={() => handleLongPress(item.id)}
                      onPress={() => handlePressItem(item)}
                      style={{
                        borderColor: isItemSelected ? '#6366F1' : (theme.isDark ? '#1F222C' : '#E5E7EB')
                      }}
                      className={`flex-row justify-between items-center ${theme.card} border rounded-2xl p-4 mb-2.5 shadow-sm`}
                    >
                      <View className="flex-row items-center flex-1 mr-2">
                        {isSelectionMode && (
                          <View 
                            style={{
                              borderColor: isItemSelected ? '#6366F1' : '#4B5563',
                              backgroundColor: isItemSelected ? '#6366F1' : 'transparent'
                            }}
                            className="w-5 h-5 rounded-full border justify-center items-center mr-3.5"
                          >
                            {isItemSelected && <Icons.Check size={10} color="#FFFFFF" strokeWidth={3} />}
                          </View>
                        )}

                        <View 
                          style={{ backgroundColor: iconBg, overflow: 'hidden' }} 
                          className="p-3 rounded-2xl justify-center items-center mr-3.5"
                        >
                          {item.categoryIcon && (item.categoryIcon.startsWith('uri:') || item.categoryIcon.startsWith('data:')) ? (
                            <Image source={{ uri: item.categoryIcon.startsWith('uri:') ? item.categoryIcon.replace('uri:', '') : item.categoryIcon }} style={{ width: 16, height: 16 }} />
                          ) : (
                            <TxIcon size={16} color={iconColor} strokeWidth={1.5} />
                          )}
                        </View>

                         <View className="flex-1">
                          <Text className={`${theme.text} text-sm font-bold truncate`}>
                            {item.categoryName}
                          </Text>
                          
                          <View className="flex-row items-center mt-0.5">
                            <Text className={`text-[10px] ${theme.subtext} font-medium`}>
                              {item.note ? `${item.note} • ${item.accountName}` : item.accountName}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View className="flex-row items-center space-x-3">
                        <Text className={`text-sm font-extrabold ml-1 ${
                          isIncome 
                            ? 'text-mint' 
                            : theme.textColor === '#FFFFFF' ? 'text-white' : 'text-[#111827]'
                        }`}>
                          {isIncome ? '+' : '-'}₹{item.amount.toFixed(2)}
                        </Text>

                        {!isSelectionMode && (
                          <TouchableOpacity 
                            onPress={() => handleSingleDelete(item.id)}
                            className="p-2 bg-coral-dim rounded-xl border border-coral/5 active:bg-coral/20 ml-2"
                          >
                            <Icons.Trash2 size={12} color="#EF4444" strokeWidth={1.5} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })
        ) : (
          <View className={`py-8 items-center ${theme.glassBg} border ${theme.border} border-dashed rounded-3xl`}>
            <Icons.HelpCircle size={28} className={theme.subtext} strokeWidth={1.5} />
            <Text className={`${theme.subtext} text-xs mt-2`}>No transactions recorded yet</Text>
          </View>
        )}
      </ScrollView>

      {/* FLOATING ACTION ADD BUTTON */}
      <TouchableOpacity
        onPress={() => {
          setSelectedTxToEdit(null);
          setModalVisible(true);
        }}
        className="absolute bottom-24 right-6 bg-mint w-14 h-14 rounded-full items-center justify-center shadow-lg shadow-mint/30 active:scale-95 z-50"
      >
        <Icons.Plus size={24} color="#FFFFFF" strokeWidth={2.5} />
      </TouchableOpacity>

      {/* TRANSACTION CREATION OR EDITING MODAL */}
      <TransactionModal 
        visible={modalVisible} 
        onClose={() => {
          setModalVisible(false);
          setSelectedTxToEdit(null);
        }} 
        transactionToEdit={selectedTxToEdit}
      />

      {/* CUSTOM CONFIRMATION DIALOG */}
      <DeleteConfirmationModal
        visible={deleteModalVisible}
        itemCount={pendingDeleteIds.length}
        onClose={() => {
          setDeleteModalVisible(false);
          setPendingDeleteIds([]);
        }}
        onConfirm={confirmDeletion}
      />

      {/* DETAILED ANALYTICS SCREEN */}
      <DetailedAnalyticsModal
        visible={detailedAnalyticsVisible}
        onClose={() => setDetailedAnalyticsVisible(false)}
        transactions={transactions}
        initialViewType={initialAnalyticsView}
      />

      {/* DASHBOARD EDIT MODAL */}
      <EditDashboardModal
        visible={editLayoutModalVisible}
        onClose={() => setEditLayoutModalVisible(false)}
        accountsOrder={accountsOrder}
        chartsOrder={chartsOrder}
        onSave={handleSaveLayout}
      />

      {/* DISCARD SELECTION CONFIRMATION MODAL */}
      <CustomAlert
        visible={discardConfirmVisible}
        title="Discard Selection?"
        message={`Are you sure you want to discard selection of ${selectedTxIds.length} transactions?`}
        type="confirm"
        confirmText="Discard"
        cancelText="Keep Selected"
        onConfirm={() => {
          setDiscardConfirmVisible(false);
          cancelSelection();
        }}
        onCancel={() => setDiscardConfirmVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    paddingBottom: 130,
  }
});
