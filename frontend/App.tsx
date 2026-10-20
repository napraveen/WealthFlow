import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Text, TouchableOpacity, StatusBar, AppState, AppStateStatus, TextInput, FlatList } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Icons from 'lucide-react-native';
import { DatabaseProvider, useDatabase, RichTransaction } from './src/context/DatabaseContext';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { DeleteConfirmationModal } from './src/components/DeleteConfirmationModal';
import { CollapsibleCalendar } from './src/components/CollapsibleCalendar';
import { TransactionModal } from './src/components/TransactionModal';
import { SettingsTab } from './src/screens/SettingsTab';
import { PlanningTab } from './src/screens/PlanningTab';
import { NotesTab } from './src/screens/NotesTab';
import { useTheme } from './src/utils/theme';
import * as Updates from 'expo-updates';

// Register background tasks in global scope
import './src/utils/backgroundBackup';

// Helper to format date strings YYYY-MM-DD to DD/MM/YYYY
export const formatDateStr = (dateStr: string) => {
  const [year, month, day] = String(dateStr || "").split('-');
  if (!year || !month || !day) return dateStr;
  return `${day}/${month}/${year}`;
};

// --- SUB-SCREEN: TRANSACTIONS LIST TAB ---
const TransactionsTab: React.FC = () => {
  const { transactions, deleteTransaction } = useDatabase();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  // --- SELECTION, FILTER & MODAL STATES ---
  const [timeFilter, setTimeFilter] = useState<'day' | 'week' | 'month' | 'year' | 'all'>('day');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);

  // Integrated Collapsible Calendar states
  const [calendarCollapsed, setCalendarCollapsed] = useState(true);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  // Edit Mode states
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedTxToEdit, setSelectedTxToEdit] = useState<any | null>(null);

  // Get past date bounds
  const getPastDateString = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  };

  // Calculate daily totals based on all database transactions on that date
  const getDailyNet = (dateHeaderStr: string) => {
    const matchTxs = transactions.filter(t => formatDateStr(t.date) === dateHeaderStr);
    return matchTxs.reduce((sum, t) => {
      if (t.type === 'income') return sum + t.amount;
      if (t.type === 'expense') return sum - t.amount;
      return sum;
    }, 0);
  };

  // Advanced search evaluator
  const matchesSearch = (tx: RichTransaction, query: string): boolean => {
    const raw = query.trim().toLowerCase();
    if (!raw) return true;

    // Split query by whitespace for multi-criteria search
    const tokens = raw.split(/\s+/).filter(Boolean);

    return tokens.every(token => {
      // 1. Amount comparisons: >500, >=500, <200, <=200, =500
      if (token.startsWith('>=') && !isNaN(parseFloat(token.slice(2)))) {
        return tx.amount >= parseFloat(token.slice(2));
      }
      if (token.startsWith('<=') && !isNaN(parseFloat(token.slice(2)))) {
        return tx.amount <= parseFloat(token.slice(2));
      }
      if (token.startsWith('>') && !isNaN(parseFloat(token.slice(1)))) {
        return tx.amount > parseFloat(token.slice(1));
      }
      if (token.startsWith('<') && !isNaN(parseFloat(token.slice(1)))) {
        return tx.amount < parseFloat(token.slice(1));
      }
      if (token.startsWith('=') && !isNaN(parseFloat(token.slice(1)))) {
        return Math.abs(tx.amount - parseFloat(token.slice(1))) < 0.01;
      }

      // 2. Amount numeric matching (clean currency symbols ₹, $, rs)
      const cleanNum = token.replace(/^[₹$rs.]+/i, '').trim();
      if (cleanNum && !isNaN(Number(cleanNum))) {
        if (
          tx.amount.toString().includes(cleanNum) ||
          tx.amount.toFixed(2).includes(cleanNum) ||
          Math.floor(tx.amount).toString() === cleanNum
        ) {
          return true;
        }
      }

      // 3. Category & Subcategory matching
      if (tx.categoryName && tx.categoryName.toLowerCase().includes(token)) return true;
      if (tx.subcategoryName && tx.subcategoryName.toLowerCase().includes(token)) return true;

      // 4. Payment type / Account matching
      if (tx.accountName && tx.accountName.toLowerCase().includes(token)) return true;
      if (tx.toAccountName && tx.toAccountName.toLowerCase().includes(token)) return true;

      // 5. Transaction type (income, expense, transfer)
      if (tx.type.toLowerCase().includes(token)) return true;

      // 6. Transaction note / description
      if (tx.note && tx.note.toLowerCase().includes(token)) return true;

      // 7. Date string matching (YYYY-MM-DD or DD/MM/YYYY)
      if (tx.date.includes(token)) return true;
      const formattedDate = formatDateStr(tx.date).toLowerCase();
      if (formattedDate.includes(token)) return true;

      // Month name matching (e.g. Jan, February, Sep, September)
      try {
        const [y, m, d] = tx.date.split('-').map(Number);
        if (y && m && d) {
          const dt = new Date(y, m - 1, d);
          const monthLong = dt.toLocaleString('en-US', { month: 'long' }).toLowerCase();
          const monthShort = dt.toLocaleString('en-US', { month: 'short' }).toLowerCase();
          const dayName = dt.toLocaleString('en-US', { weekday: 'long' }).toLowerCase();
          if (monthLong.includes(token) || monthShort.includes(token) || dayName.includes(token)) {
            return true;
          }
        }
      } catch {}

      return false;
    });
  };

  // 1. FILTER TRANSACTIONS DYNAMICALLY
  const filteredTransactions = transactions.filter(tx => {
    // Check advanced search filter first
    if (searchQuery.trim() && !matchesSearch(tx, searchQuery)) {
      return false;
    }

    if (selectedCalendarDate) {
      return tx.date === selectedCalendarDate;
    }

    if (timeFilter === 'all') return true;
    const todayStr = new Date().toISOString().split('T')[0];

    if (timeFilter === 'day') {
      return tx.date === todayStr;
    }
    if (timeFilter === 'week') {
      return tx.date >= getPastDateString(6);
    }
    if (timeFilter === 'month') {
      return tx.date >= getPastDateString(29);
    }
    if (timeFilter === 'year') {
      return tx.date >= getPastDateString(364);
    }
    return true;
  });

  const totalIncome = filteredTransactions
    .filter(tx => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalExpense = filteredTransactions
    .filter(tx => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0);

  // 2. GROUP AND FLATTEN FOR SECTION HEADERS
  const grouped: { [key: string]: RichTransaction[] } = {};
  filteredTransactions.forEach(tx => {
    const title = formatDateStr(tx.date);
    if (!grouped[title]) {
      grouped[title] = [];
    }
    grouped[title].push(tx);
  });

  // Maintain descending chronological header order
  const uniqueDates = Array.from(
    new Set(filteredTransactions.map(t => formatDateStr(t.date)))
  );

  type ListItem =
    | { type: 'header'; date: string; dailyNet: number }
    | { type: 'transaction'; data: RichTransaction };

  const listItems: ListItem[] = [];
  uniqueDates.forEach(date => {
    const dailyNet = getDailyNet(date);
    listItems.push({ type: 'header', date, dailyNet });
    const txs = grouped[date] || [];
    txs.forEach(tx => {
      listItems.push({ type: 'transaction', data: tx });
    });
  });

  // Selection handlers
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
      setSelectedTxToEdit(item);
      setEditModalVisible(true);
    }
  };

  const handleSelectAll = () => {
    const visibleIds = filteredTransactions.map(t => t.id);
    const allVisibleSelected = visibleIds.every(id => selectedTxIds.includes(id));

    if (allVisibleSelected) {
      setSelectedTxIds(selectedTxIds.filter(id => !visibleIds.includes(id)));
      if (selectedTxIds.length === 0 || selectedTxIds.filter(id => !visibleIds.includes(id)).length === 0) {
        setIsSelectionMode(false);
      }
    } else {
      const merged = Array.from(new Set([...selectedTxIds, ...visibleIds]));
      setSelectedTxIds(merged);
    }
  };

  const handleBatchDelete = () => {
    if (selectedTxIds.length === 0) return;
    setPendingDeleteIds(selectedTxIds);
    setDeleteModalVisible(true);
  };

  const handleSingleDelete = (id: string) => {
    setPendingDeleteIds([id]);
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
      console.error('Batch deletion failed:', err);
    }
  };

  const cancelSelection = () => {
    setSelectedTxIds([]);
    setIsSelectionMode(false);
  };

  return (
    <View style={{ paddingTop: insets.top }} className={`flex-1 ${theme.bg} px-5`}>

      {/* SELECTION BAR HEADER OR STANDARD TITLE */}
      {isSelectionMode ? (
        <View className="flex-row justify-between items-center bg-[#161D2B]/90 border border-white/10 p-4 rounded-2xl mt-3 mb-4">
          <View className="flex-row items-center space-x-2">
            <TouchableOpacity onPress={cancelSelection} className="p-1">
              <Icons.X size={18} color="#6B7280" />
            </TouchableOpacity>
            <Text className="text-white text-base font-bold ml-2">
              {selectedTxIds.length} Selected
            </Text>
          </View>

          <View className="flex-row items-center space-x-4">
            <TouchableOpacity onPress={handleSelectAll} className="px-3 py-1.5 bg-white/5 rounded-xl border border-white/5">
              <Text className="text-mutedText text-[10px] font-bold uppercase tracking-wider">
                Select All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleBatchDelete}
              className="p-2.5 bg-coral-dim rounded-xl border border-coral/10"
            >
              <Icons.Trash2 size={16} color="#EF4444" strokeWidth={1.5} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View className="mt-3 mb-4 flex-row justify-between items-center">
          <View>
            <Text className={`text-3xl font-extrabold tracking-tight ${theme.text}`}>
              Transaction History
            </Text>
          </View>

          {/* CALENDAR TOGGLE BUTTON */}
          <TouchableOpacity
            onPress={() => setCalendarCollapsed(!calendarCollapsed)}
            style={{ backgroundColor: !calendarCollapsed ? '#6366F1' : 'rgba(255, 255, 255, 0.05)' }}
            className="p-3 rounded-2xl border border-white/5 active:scale-95"
          >
            <Icons.Calendar size={18} color={!calendarCollapsed ? '#FFFFFF' : '#6366F1'} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      )}

      {/* ADVANCED SEARCH BAR (BETWEEN HEADING AND FILTER) */}
      {!isSelectionMode && (
        <View
          style={{ height: 42 }}
          className={`flex-row items-center mb-3 ${theme.glassBg} border ${theme.border} px-3.5 rounded-2xl`}
        >
          <Icons.Search size={15} color={theme.isDark ? '#9CA3AF' : '#6B7280'} strokeWidth={2} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search"
            placeholderTextColor={theme.isDark ? '#4B5563' : '#9CA3AF'}
            className={`flex-1 ml-2.5 text-xs ${theme.text} font-medium h-full py-0`}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} className="p-1">
              <Icons.X size={14} color={theme.isDark ? '#9CA3AF' : '#6B7280'} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* COLLAPSIBLE CALENDAR COMPONENT */}
      <CollapsibleCalendar
        selectedDate={selectedCalendarDate}
        onSelectDate={(date) => {
          setSelectedCalendarDate(date);
        }}
        collapsed={calendarCollapsed}
      />

      {/* CALENDAR FILTER BADGE */}
      {selectedCalendarDate && !isSelectionMode && (
        <View className="flex-row items-center mb-3 bg-indigoAcc/10 border border-indigoAcc/20 px-3 py-1.5 rounded-xl self-start">
          <Text className="text-indigoAcc-light text-[10px] font-bold uppercase tracking-wider">
            Filtered Date: {formatDateStr(selectedCalendarDate)}
          </Text>
          <TouchableOpacity onPress={() => setSelectedCalendarDate(null)} className="ml-2 p-0.5">
            <Icons.X size={10} color="#6366F1" strokeWidth={3} />
          </TouchableOpacity>
        </View>
      )}

      {/* TIME FILTERS BAR */}
      {!isSelectionMode && !selectedCalendarDate && (
        <View style={{ height: 42 }} className={`flex-row justify-between mb-5 ${theme.glassBg} border ${theme.border} p-1 rounded-2xl`}>
          {(['day', 'week', 'month', 'year', 'all'] as const).map(filter => (
            <TouchableOpacity
              key={filter}
              onPress={() => {
                setTimeFilter(filter);
                cancelSelection();
              }}
              className={`flex-1 py-2 items-center justify-center rounded-xl ${timeFilter === filter ? 'bg-indigoAcc' : ''
                }`}
            >
              <Text className={`text-[10px] uppercase font-bold tracking-wider ${timeFilter === filter ? 'text-white' : theme.subtext
                }`}>
                {filter === 'day' ? 'Today' : filter}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* INCOME / EXPENSE PERIOD SUMMARY */}
      {!isSelectionMode && (
        <View className="flex-row justify-between mb-5 space-x-3">
          <View className={`flex-1 ${theme.card} border ${theme.border} rounded-2xl p-4 flex-row items-center justify-between shadow-sm`}>
            <View>
              <Text className={`${theme.subtext} text-[9px] font-bold uppercase tracking-wider`}>Period Income</Text>
              <Text className="text-mint text-base font-extrabold mt-1">₹{totalIncome.toFixed(2)}</Text>
            </View>
            <View className="bg-mint/10 p-2.5 rounded-xl">
              <Icons.TrendingUp size={14} color="#10B981" />
            </View>
          </View>

          <View className={`flex-1 ${theme.card} border ${theme.border} rounded-2xl p-4 flex-row items-center justify-between shadow-sm`}>
            <View>
              <Text className={`${theme.subtext} text-[9px] font-bold uppercase tracking-wider`}>Period Expenses</Text>
              <Text className="text-coral text-base font-extrabold mt-1">₹{totalExpense.toFixed(2)}</Text>
            </View>
            <View className="bg-coral-dim p-2.5 rounded-xl">
              <Icons.TrendingDown size={14} color="#EF4444" />
            </View>
          </View>
        </View>
      )}

      {/* DATE-GROUPED FLATTENED LIST */}
      <FlatList
        data={listItems}
        keyExtractor={(item: any) =>
          item.type === 'header' ? `h-${item.date}` : `tx-${item.data.id}`
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
        keyboardShouldPersistTaps="handled"
        extraData={{ selectedTxIds, isSelectionMode, theme, isDark: theme.isDark }}
        initialNumToRender={15}
        maxToRenderPerBatch={15}
        windowSize={11}
        removeClippedSubviews={false}
        ListEmptyComponent={() => (
          <View className={`py-12 items-center ${theme.glassBg} border ${theme.border} border-dashed rounded-3xl mt-5 px-4`}>
            <Icons.HelpCircle size={28} className={theme.subtext} strokeWidth={1.5} />
            <Text className={`${theme.subtext} text-xs mt-2 text-center`}>
              {searchQuery.trim()
                ? `No transactions matching "${searchQuery.trim()}" in ${timeFilter === 'day' ? 'Today' : timeFilter}`
                : 'No activities matching this period'}
            </Text>
            {searchQuery.trim() && timeFilter !== 'all' && (
              <TouchableOpacity
                onPress={() => setTimeFilter('all')}
                className="mt-3 px-3.5 py-1.5 bg-indigoAcc rounded-xl active:opacity-90"
              >
                <Text className="text-white text-[10px] font-bold uppercase tracking-wider">Search Across All Time</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        renderItem={({ item }: { item: any }) => {
          if (item.type === 'header') {
            const net = item.dailyNet;
            const isPositive = net >= 0;
            return (
              <View className="py-2.5 flex-row justify-between items-center">
                <Text className="text-indigoAcc-light text-[10px] font-extrabold uppercase tracking-widest ml-1">
                  {item.date}
                </Text>
                <Text className={`text-[10px] font-extrabold mr-1 ${isPositive ? 'text-mint' : 'text-coral'}`}>
                  {isPositive ? '+' : '-'}₹{Math.abs(net).toFixed(2)}
                </Text>
              </View>
            );
          }

          const tx = item.data;
          const isIncome = tx.type === 'income';
          const isItemSelected = selectedTxIds.includes(tx.id);

          let TxIcon = Icons.HelpCircle;
          let iconColor = '#9CA3AF';
          let iconBg = 'rgba(156, 163, 175, 0.1)';

          if (tx.categoryIcon && tx.categoryColor) {
            TxIcon = (Icons as any)[tx.categoryIcon] || Icons.HelpCircle;
            iconColor = tx.categoryColor;
            iconBg = tx.categoryColor + '15';
          }

          return (
            <View className="pb-2.5">
              <TouchableOpacity
                activeOpacity={0.8}
                delayLongPress={250}
                onLongPress={() => handleLongPress(tx.id)}
                onPress={() => handlePressItem(tx)}
                style={{
                  borderColor: isItemSelected ? '#6366F1' : (theme.isDark ? '#1F222C' : '#E5E7EB')
                }}
                className={`flex-row justify-between items-center ${theme.card} border rounded-2xl p-4 shadow-sm`}
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

                  <View style={{ backgroundColor: iconBg }} className="p-3 rounded-2xl justify-center items-center mr-3.5">
                    <TxIcon size={16} color={iconColor} strokeWidth={1.5} />
                  </View>

                  <View className="flex-1">
                    <Text className={`text-sm font-bold truncate ${theme.text}`}>
                      {tx.categoryName}
                    </Text>
                    <Text className={`text-[10px] ${theme.subtext} mt-0.5`}>
                      {tx.note ? `${tx.note} • ${tx.accountName}` : tx.accountName}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center space-x-3">
                  <Text className={`text-sm font-extrabold ml-1 ${isIncome ? 'text-mint' : theme.textColor === '#FFFFFF' ? 'text-white' : 'text-[#111827]'}`}>
                    {isIncome ? '+' : '-'}₹{tx.amount.toFixed(2)}
                  </Text>

                  {!isSelectionMode && (
                    <TouchableOpacity
                      onPress={() => handleSingleDelete(tx.id)}
                      className="p-2 bg-coral-dim rounded-xl border border-coral/5 active:bg-coral/20 ml-2"
                    >
                      <Icons.Trash2 size={12} color="#EF4444" strokeWidth={1.5} />
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          );
        }}
      />

      {/* EDIT TRANSACTION MODAL */}
      <TransactionModal
        visible={editModalVisible}
        onClose={() => {
          setEditModalVisible(false);
          setSelectedTxToEdit(null);
        }}
        transactionToEdit={selectedTxToEdit}
      />

      <DeleteConfirmationModal
        visible={deleteModalVisible}
        itemCount={pendingDeleteIds.length}
        onClose={() => {
          setDeleteModalVisible(false);
          setPendingDeleteIds([]);
        }}
        onConfirm={confirmDeletion}
      />
    </View>
  );
};

const AppContent: React.FC = () => {
  const { isInitialized } = useDatabase();
  const theme = useTheme();

  // Active tab state supports combined tab Planning, and new tab Notes!
  const [activeTab, setActiveTab] = useState<'home' | 'transactions' | 'notes' | 'planning' | 'settings'>('home');

  // Update checker states
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('Checking system configs...');

  useEffect(() => {
    async function checkForUpdates() {
      if (__DEV__) return; // Skip in developer mode

      // Wait 2.5 seconds for device network & updates module connection to fully stabilize on startup
      await new Promise(resolve => setTimeout(resolve, 2500));

      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          setIsUpdating(true);
          setUpdateMessage('Syncing database configurations...');
          await Updates.fetchUpdateAsync();
          setUpdateMessage('Configurations synced. Restarting...');
          setTimeout(async () => {
            await Updates.reloadAsync();
          }, 800);
        }
      } catch (error) {
        console.log('EAS Updates Check error:', error);
      }
    }

    checkForUpdates();
  }, []);

  if (isUpdating) {
    return (
      <View className="flex-1 bg-[#050505] justify-center items-center px-6">
        <View className="bg-indigoAcc/10 p-5 rounded-full mb-6 border border-indigoAcc/20">
          <Icons.Cpu size={36} color="#6366F1" strokeWidth={1.5} />
        </View>
        <Text className="text-white text-2xl font-black tracking-tight mb-2">
          WealthFlow
        </Text>
        <ActivityIndicator size="small" color="#6366F1" className="mb-4" />
        <Text className="text-mutedText text-xs font-semibold uppercase tracking-widest text-center text-center">
          {updateMessage}
        </Text>
      </View>
    );
  }

  if (!isInitialized) {
    return (
      <View className="flex-1 bg-[#050505] justify-center items-center">
        <ActivityIndicator size="large" color="#10B981" />
        <Text className="text-mutedText text-xs font-bold uppercase tracking-widest mt-4">
          WealthFlow Initialization...
        </Text>
      </View>
    );
  }

  const renderScreen = () => {
    switch (activeTab) {
      case 'home':
        return <DashboardScreen onNavigate={(tab) => setActiveTab(tab as any)} />;
      case 'transactions':
        return <TransactionsTab />;
      case 'notes':
        return <NotesTab />;
      case 'planning':
        return <PlanningTab />;
      case 'settings':
        return <SettingsTab />;
      default:
        return <DashboardScreen />;
    }
  };

  return (
    <View className={`flex-1 ${theme.bg}`}>
      <View className="flex-1">{renderScreen()}</View>

      {/* FLOATING CAPSULE NAVIGATION BAR */}
      <View
        className="absolute bottom-5 left-5 right-5 h-16 rounded-full flex-row justify-around items-center px-4 border"
        style={{
          backgroundColor: theme.isDark ? 'rgba(22, 29, 43, 0.9)' : 'rgba(255, 255, 255, 0.95)',
          borderColor: theme.borderColor,
          shadowColor: theme.shadowColor,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.15,
          shadowRadius: 20,
          elevation: 10,
        }}
      >
        <TouchableOpacity onPress={() => setActiveTab('home')} className="items-center p-1.5">
          <Icons.Home size={18} color={activeTab === 'home' ? '#6366F1' : theme.mutedTextColor} strokeWidth={activeTab === 'home' ? 2 : 1.5} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setActiveTab('transactions')} className="items-center p-1.5">
          <Icons.Receipt size={18} color={activeTab === 'transactions' ? '#6366F1' : theme.mutedTextColor} strokeWidth={activeTab === 'transactions' ? 2 : 1.5} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setActiveTab('notes')} className="items-center p-1.5">
          <Icons.StickyNote size={18} color={activeTab === 'notes' ? '#6366F1' : theme.mutedTextColor} strokeWidth={activeTab === 'notes' ? 2 : 1.5} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setActiveTab('planning')} className="items-center p-1.5">
          <Icons.Sliders size={18} color={activeTab === 'planning' ? '#6366F1' : theme.mutedTextColor} strokeWidth={activeTab === 'planning' ? 2 : 1.5} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setActiveTab('settings')} className="items-center p-1.5">
          <Icons.Settings size={18} color={activeTab === 'settings' ? '#6366F1' : theme.mutedTextColor} strokeWidth={activeTab === 'settings' ? 2 : 1.5} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <DatabaseProvider>
        <AppContent />
      </DatabaseProvider>
    </SafeAreaProvider>
  );
}
