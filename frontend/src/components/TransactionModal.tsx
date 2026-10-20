import React, { useState, useEffect, useRef } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  TouchableOpacity, 
  TextInput, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform,
  Animated,
  PanResponder,
  Image,
  Keyboard
} from 'react-native';
import * as Icons from 'lucide-react-native';
import { useDatabase } from '../context/DatabaseContext';
import { evaluateExpression } from '../utils/mathParser';
import { CustomAlert } from './CustomAlert';
import { CollapsibleCalendar } from './CollapsibleCalendar';
import { useKeyboard } from '../utils/useKeyboard';

interface TransactionModalProps {
  visible: boolean;
  onClose: () => void;
  transactionToEdit?: any | null;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({ 
  visible, 
  onClose,
  transactionToEdit = null
}) => {
  const { accounts, categories, subcategories, addTransaction, updateTransaction } = useDatabase();

  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [amountInput, setAmountInput] = useState('');
  const [parsedAmount, setParsedAmount] = useState<number | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [calendarCollapsed, setCalendarCollapsed] = useState(true);

  // Subcategory popup state
  const [showSubcategoryPopup, setShowSubcategoryPopup] = useState(false);
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(null);

  // Custom alert states
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  // Keyboard avoidance hook
  const { animatedKeyboardHeight, maxModalHeight } = useKeyboard();

  // Animated position for swipe down
  const panY = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  // PanResponder to handle swipe-down on handle
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120) {
          Animated.timing(panY, {
            toValue: 800,
            duration: 220,
            useNativeDriver: true,
          }).start(() => {
            onClose();
          });
        } else {
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const triggerAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  const scrollToInput = (yOffset: number) => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: yOffset, animated: true });
    }, 150);
  };

  useEffect(() => {
    const result = evaluateExpression(amountInput);
    setParsedAmount(result);
  }, [amountInput]);

  useEffect(() => {
    if (visible) {
      panY.setValue(0);
      setCalendarCollapsed(true);
      if (transactionToEdit) {
        setTxType(transactionToEdit.type === 'income' ? 'income' : 'expense');
        setAmountInput(transactionToEdit.amount.toString());
        setParsedAmount(transactionToEdit.amount);
        setNote(transactionToEdit.note || '');
        setSelectedAccountId(transactionToEdit.accountId);
        setSelectedCategoryId(transactionToEdit.categoryId || '');
        setSelectedSubcategoryId(transactionToEdit.subcategoryId || null);
        setDate(transactionToEdit.date);
      } else {
        setTxType('expense');
        setAmountInput('');
        setParsedAmount(null);
        setNote('');
        setSelectedSubcategoryId(null);
        setDate(new Date().toISOString().split('T')[0]);
        
        // Default to UPI if available
        const upiAcc = accounts.find(a => a.id === 'acc-upi' || a.name.toLowerCase().includes('upi'));
        if (upiAcc) {
          setSelectedAccountId(upiAcc.id);
        } else if (accounts.length > 0) {
          setSelectedAccountId(accounts[0].id);
        }
      }
    }
  }, [visible, transactionToEdit, accounts]);

  useEffect(() => {
    const filtered = categories.filter(c => c.type === txType);
    if (transactionToEdit && transactionToEdit.type === txType) {
      setSelectedCategoryId(transactionToEdit.categoryId || '');
      setSelectedSubcategoryId(transactionToEdit.subcategoryId || null);
    } else if (filtered.length > 0) {
      setSelectedCategoryId(filtered[0].id);
      setSelectedSubcategoryId(null);
    } else {
      setSelectedCategoryId('');
      setSelectedSubcategoryId(null);
    }
  }, [txType, categories, transactionToEdit]);

  const handleCategoryPress = (catId: string) => {
    const subs = subcategories.filter(s => s.categoryId === catId);
    if (subs.length > 0) {
      setPendingCategoryId(catId);
      setShowSubcategoryPopup(true);
    } else {
      setSelectedCategoryId(catId);
      setSelectedSubcategoryId(null);
    }
  };

  const handleSave = async () => {
    const finalAmount = parsedAmount !== null ? parsedAmount : parseFloat(amountInput);
    
    if (isNaN(finalAmount) || finalAmount <= 0) {
      triggerAlert('Invalid Amount', 'Please input a valid mathematical equation or numeric value.');
      return;
    }

    if (!selectedAccountId) {
      triggerAlert('Account Missing', 'Please select an account.');
      return;
    }

    if (!selectedCategoryId) {
      triggerAlert('Category Missing', 'Please select a category.');
      return;
    }

    const finalDate = date.trim() || (transactionToEdit ? transactionToEdit.date : new Date().toISOString().split('T')[0]);

    try {
      if (transactionToEdit) {
        await updateTransaction(transactionToEdit.id, {
          accountId: selectedAccountId,
          toAccountId: null,
          categoryId: selectedCategoryId,
          subcategoryId: selectedSubcategoryId,
          amount: finalAmount,
          type: txType,
          date: finalDate,
          note: note.trim(),
        });
      } else {
        await addTransaction({
          accountId: selectedAccountId,
          toAccountId: null,
          categoryId: selectedCategoryId,
          subcategoryId: selectedSubcategoryId,
          amount: finalAmount,
          type: txType,
          date: finalDate,
          note: note.trim(),
        });
      }
      onClose();
    } catch (e) {
      triggerAlert('Execution Error', 'An error occurred while saving.');
    }
  };

  const filteredCategories = categories.filter(c => c.type === txType);
  const pendingSubs = pendingCategoryId ? subcategories.filter(s => s.categoryId === pendingCategoryId) : [];

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/80">
        <Animated.View 
          style={{ 
            transform: [{ translateY: panY }],
            marginBottom: animatedKeyboardHeight,
            maxHeight: maxModalHeight,
          }}
          className="bg-obsidian border-t-2 border-obsidian-border rounded-t-[32px] px-6 pt-5 pb-5"
        >
          {/* DRAG DOWN HANDLE PILL */}
          <View {...panResponder.panHandlers} className="items-center py-3 -mt-3 mb-2">
            <View className="w-12 h-1 bg-white/20 rounded-full" />
          </View>

          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-white text-xl font-bold tracking-tight">
              {transactionToEdit ? 'Edit Entry' : 'New Entry'}
            </Text>
            <TouchableOpacity onPress={onClose} className="p-1">
              <Icons.X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* TYPE SELECTOR (EXCLUDE TRANSFERS) */}
          <View className="flex-row bg-[#161D2B]/50 border border-obsidian-border p-1 rounded-2xl mb-6">
            {(['expense', 'income'] as const).map(type => (
              <TouchableOpacity
                key={type}
                onPress={() => setTxType(type)}
                className={`flex-1 py-3 items-center rounded-xl ${
                  txType === type 
                    ? type === 'income' 
                      ? 'bg-mint' 
                      : 'bg-coral' 
                    : ''
                }`}
              >
                <Text className={`text-xs font-semibold capitalize ${
                  txType === type ? 'text-white font-bold' : 'text-mutedText'
                }`}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView 
            ref={scrollViewRef} 
            showsVerticalScrollIndicator={false} 
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 6 }}
          >
            
            {/* AMOUNT INPUT FIELD */}
            <View className="bg-[#161D2B]/30 border border-obsidian-border rounded-2xl p-5 mb-5 justify-center items-end">
              <Text className="text-mutedText text-xs font-medium uppercase tracking-wider mb-1">
                Enter Amount
              </Text>
              <TextInput
                value={amountInput}
                onChangeText={setAmountInput}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#374151"
                className="text-white text-4xl font-extrabold text-right tracking-tight w-full"
                autoFocus={!transactionToEdit}
              />
              {parsedAmount !== null && /[+\-*/]/.test(amountInput) && (
                <Text className="text-mint text-sm font-semibold mt-1">
                  = ₹{parsedAmount.toFixed(2)}
                </Text>
              )}
            </View>

            {/* SOURCE ACCOUNT SELECTOR */}
            <View className="mb-5">
              <Text className="text-mutedText text-xs font-semibold uppercase tracking-wider mb-2">
                Account
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                {accounts.map(acc => {
                  const AccIcon = (Icons as any)[acc.icon] || Icons.HelpCircle;
                  const isSelected = selectedAccountId === acc.id;
                  return (
                    <TouchableOpacity
                      key={acc.id}
                      onPress={() => setSelectedAccountId(acc.id)}
                      style={{ borderColor: isSelected ? acc.color : '#1F222C' }}
                      className={`flex-row items-center border px-4 py-3 rounded-2xl mr-3 ${
                        isSelected ? 'bg-white/[0.04]' : 'bg-transparent'
                      }`}
                    >
                      <AccIcon size={14} color={isSelected ? acc.color : '#6B7280'} />
                      <Text className={`text-xs font-medium ml-2 ${
                        isSelected ? 'text-white font-bold' : 'text-mutedText'
                      }`}>
                        {acc.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* CATEGORY GRID PICKER */}
            <View className="mb-5">
              <Text className="text-mutedText text-xs font-semibold uppercase tracking-wider mb-3">
                Select Category
              </Text>
              <View className="flex-row flex-wrap justify-between">
                {filteredCategories.map(cat => {
                  const CatIcon = (Icons as any)[cat.icon] || Icons.HelpCircle;
                  const isSelected = selectedCategoryId === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => handleCategoryPress(cat.id)}
                      className="w-[23%] items-center mb-4"
                    >
                      <View 
                        style={{ 
                          backgroundColor: isSelected ? cat.color : '#161D2B',
                          borderColor: isSelected ? cat.color : 'transparent',
                          borderWidth: 1,
                          overflow: 'hidden'
                        }} 
                        className="w-12 h-12 rounded-2xl justify-center items-center mb-1.5"
                      >
                        {(cat.icon && (cat.icon.startsWith('uri:') || cat.icon.startsWith('data:'))) ? (
                          <Image source={{ uri: cat.icon.startsWith('uri:') ? cat.icon.replace('uri:', '') : cat.icon }} style={{ width: 24, height: 24 }} />
                        ) : (
                          <CatIcon size={18} color={isSelected ? '#050505' : cat.color} />
                        )}
                      </View>
                      <Text 
                        numberOfLines={1} 
                        className={`text-[10px] text-center w-full font-medium ${
                          isSelected ? 'text-white font-semibold' : 'text-mutedText'
                        }`}
                      >
                        {cat.name}
                      </Text>
                      {selectedCategoryId === cat.id && selectedSubcategoryId && (
                        <Text numberOfLines={1} className="text-[9px] text-indigoAcc font-bold mt-0.5 text-center w-full">
                          {subcategories.find(s => s.id === selectedSubcategoryId)?.name}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* SELECTED SUBCATEGORY DISPLAY (ABOVE TRANSACTION DATE) */}
            {(() => {
              const currentCat = categories.find(c => c.id === selectedCategoryId);
              const currentSub = subcategories.find(s => s.id === selectedSubcategoryId);
              const badgeColor = currentCat?.color || '#6366F1';

              if (!currentSub) return null;

              return (
                <View className="mb-4">
                  <Text className="text-mutedText text-xs font-semibold uppercase tracking-wider mb-2">
                    Selected Subcategory
                  </Text>
                  <View
                    style={{
                      backgroundColor: `${badgeColor}18`,
                      borderColor: `${badgeColor}50`,
                    }}
                    className="flex-row items-center px-4 py-3 rounded-2xl border"
                  >
                    <View
                      style={{ backgroundColor: badgeColor }}
                      className="w-2.5 h-2.5 rounded-full mr-2.5"
                    />
                    <Text
                      style={{ color: badgeColor }}
                      className="text-xs font-extrabold flex-1"
                      numberOfLines={1}
                    >
                      {currentSub.name}
                    </Text>
                    <Text className="text-mutedText text-[10px] font-medium ml-1">
                      ({currentCat?.name || 'Category'})
                    </Text>
                  </View>
                </View>
              );
            })()}

            {/* TRANSACTION DATE */}
            <View className="mb-5">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-mutedText text-xs font-semibold uppercase tracking-wider">
                  Transaction Date
                </Text>
                <View className="flex-row space-x-2">
                  <TouchableOpacity 
                    onPress={() => setDate(new Date().toISOString().split('T')[0])}
                    className="px-2.5 py-1 bg-white/5 border border-white/5 rounded-lg active:bg-white/10"
                  >
                    <Text className="text-mutedText text-[10px] font-bold uppercase tracking-wider">Today</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => {
                      const yesterday = new Date();
                      yesterday.setDate(yesterday.getDate() - 1);
                      setDate(yesterday.toISOString().split('T')[0]);
                    }}
                    className="px-2.5 py-1 bg-white/5 border border-white/5 rounded-lg active:bg-white/10 ml-2"
                  >
                    <Text className="text-mutedText text-[10px] font-bold uppercase tracking-wider">Yesterday</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View className="flex-row items-center">
                <TextInput
                  value={date}
                  onChangeText={setDate}
                  onFocus={() => scrollToInput(360)}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#4B5563"
                  className="flex-1 bg-[#161D2B]/30 border border-obsidian-border rounded-xl px-4 py-3.5 text-white text-xs font-medium mr-2"
                />
                <TouchableOpacity
                  onPress={() => setCalendarCollapsed(!calendarCollapsed)}
                  style={{
                    backgroundColor: !calendarCollapsed ? 'rgba(99, 102, 241, 0.1)' : 'rgba(22, 29, 43, 0.3)',
                    borderColor: !calendarCollapsed ? '#6366F1' : '#1F222C'
                  }}
                  className="p-3.5 rounded-xl border"
                >
                  <Icons.Calendar size={16} color={!calendarCollapsed ? '#6366F1' : '#6B7280'} />
                </TouchableOpacity>
              </View>
              
              {!calendarCollapsed && (
                <View className="mt-3">
                  <CollapsibleCalendar 
                    selectedDate={date} 
                    onSelectDate={(newDate) => {
                      setDate(newDate);
                      setCalendarCollapsed(true);
                    }} 
                    collapsed={calendarCollapsed}
                  />
                </View>
              )}
            </View>

            {/* NOTE INPUT */}
            <View className="mb-6">
              <Text className="text-mutedText text-xs font-semibold uppercase tracking-wider mb-2">
                Transaction Note
              </Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                onFocus={() => scrollToInput(480)}
                placeholder="Details or descriptions..."
                placeholderTextColor="#4B5563"
                className="bg-[#161D2B]/30 border border-obsidian-border rounded-xl px-4 py-3.5 text-white text-xs font-medium"
              />
            </View>

            {/* SAVE BUTTON */}
            <TouchableOpacity
              onPress={handleSave}
              className="bg-mint py-4 rounded-2xl items-center shadow-lg shadow-mint/20 mb-1"
            >
              <Text className="text-white font-extrabold text-sm tracking-wide">
                Save Transaction
              </Text>
            </TouchableOpacity>

          </ScrollView>

          {/* SUBCATEGORY POPUP */}
          {showSubcategoryPopup && pendingCategoryId && (
            <View className="absolute top-0 left-0 right-0 bottom-0 bg-black/60 justify-center items-center rounded-t-[32px] p-6 z-50">
              <View className="bg-obsidian border border-obsidian-border rounded-3xl p-5 w-full shadow-2xl">
                <View className="flex-row justify-between items-center mb-4">
                  <Text className="text-white text-lg font-bold">Select Subcategory</Text>
                  <TouchableOpacity onPress={() => setShowSubcategoryPopup(false)} className="p-1">
                    <Icons.X size={18} color="#6B7280" />
                  </TouchableOpacity>
                </View>
                
                <ScrollView className="max-h-[250px]" showsVerticalScrollIndicator={false}>
                  {pendingSubs.map(sub => (
                    <TouchableOpacity
                      key={sub.id}
                      onPress={() => {
                        setSelectedCategoryId(pendingCategoryId);
                        setSelectedSubcategoryId(sub.id);
                        setShowSubcategoryPopup(false);
                      }}
                      className="py-3.5 px-4 mb-2 bg-[#161D2B]/80 rounded-xl border border-white/5 active:bg-[#161D2B]"
                    >
                      <Text className="text-white text-sm font-semibold">{sub.name}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedCategoryId(pendingCategoryId);
                      setSelectedSubcategoryId(null);
                      setShowSubcategoryPopup(false);
                    }}
                    className="py-3.5 px-4 mb-2 border border-white/10 rounded-xl active:bg-white/5 border-dashed"
                  >
                    <Text className="text-mutedText text-sm font-semibold italic">General</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          )}
        </Animated.View>
      </View>

      {/* CUSTOM THEMED DIALOG */}
      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        onConfirm={() => setAlertVisible(false)}
      />
    </Modal>
  );
};
