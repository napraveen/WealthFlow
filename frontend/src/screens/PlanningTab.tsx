import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, Animated, PanResponder, Image, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Icons from 'lucide-react-native';
import { useDatabase } from '../context/DatabaseContext';
import { useTheme } from '../utils/theme';
import { CustomAlert } from '../components/CustomAlert';
import { useKeyboard } from '../utils/useKeyboard';

export const PlanningTab: React.FC = () => {
  const { 
    budgets, 
    categories, 
    subcategories,
    accounts, 
    recurringBills, 
    upsertBudget, 
    addRecurringBill, 
    deleteRecurringBill 
  } = useDatabase();
  
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { animatedKeyboardHeight, maxModalHeight } = useKeyboard();
  const subScrollRef = useRef<ScrollView>(null);
  const budgetScrollRef = useRef<ScrollView>(null);

  // Tab switcher state
  const [activeSegment, setActiveSegment] = useState<'budgets' | 'subscriptions'>('budgets');

  // Budget editing states
  const [selectedCat, setSelectedCat] = useState<any | null>(null);
  const [selectedSubcat, setSelectedSubcat] = useState<any | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [budgetModalVisible, setBudgetModalVisible] = useState(false);
  const [expandedBudgetCats, setExpandedBudgetCats] = useState<{ [catId: string]: boolean }>({});

  // Subscription states
  const [subModalVisible, setSubModalVisible] = useState(false);
  const [subName, setSubName] = useState('');
  const [subAmount, setSubAmount] = useState('');
  const [subDate, setSubDate] = useState(new Date().toISOString().split('T')[0]);

  // Animated position for swipe down
  const panY = useRef(new Animated.Value(0)).current;

  // Swipe gesture responder
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
            setBudgetModalVisible(false);
            setSubModalVisible(false);
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

  // Dialog configurations
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'info' | 'confirm' | 'destructive'>('info');
  const [alertConfirmText, setAlertConfirmText] = useState('OK');
  const [alertCancelText, setAlertCancelText] = useState('Cancel');
  const [alertCancelOnRight, setAlertCancelOnRight] = useState(false);
  const [alertCancelHighlight, setAlertCancelHighlight] = useState(false);
  const [alertAction, setAlertAction] = useState<() => void>(() => {});

  const triggerAlert = (
    title: string,
    message: string,
    type: 'info' | 'confirm' | 'destructive' = 'info',
    onConfirm: () => void = () => {},
    confirmText: string = 'OK',
    cancelText: string = 'Cancel',
    cancelOnRight: boolean = false,
    cancelHighlight: boolean = false
  ) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertType(type);
    setAlertConfirmText(confirmText);
    setAlertCancelText(cancelText);
    setAlertCancelOnRight(cancelOnRight);
    setAlertCancelHighlight(cancelHighlight);
    setAlertAction(() => () => {
      setAlertVisible(false);
      onConfirm();
    });
    setAlertVisible(true);
  };

  // Reset positioning when modals show
  useEffect(() => {
    if (budgetModalVisible || subModalVisible) {
      panY.setValue(0);
    }
  }, [budgetModalVisible, subModalVisible]);

  const handleAdjustPress = (cat: any, currentAmount: number, subcat?: any) => {
    setSelectedCat(cat);
    setSelectedSubcat(subcat || null);
    setAmountInput(currentAmount > 0 ? currentAmount.toString() : '');
    setBudgetModalVisible(true);
  };

  const toggleBudgetCatExpand = (catId: string) => {
    setExpandedBudgetCats(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  const handleSaveBudget = async () => {
    if (!selectedCat) return;
    const val = parseFloat(amountInput);
    if (isNaN(val) || val < 0) {
      triggerAlert('Invalid Value', 'Please enter a valid positive budget amount');
      return;
    }

    // If saving a subcategory target, validate against parent category limit
    if (selectedSubcat) {
      const catBudget = budgets.find(b => b.categoryId === selectedCat.id && !b.subcategoryId);
      const categoryLimit = catBudget ? catBudget.amount : 0;

      // Calculate sum of all other subcategory targets for this category (excluding current one)
      const catSubs = subcategories.filter(s => s.categoryId === selectedCat.id);
      const otherSubsTotal = catSubs.reduce((sum, sub) => {
        if (sub.id === selectedSubcat.id) return sum; // skip current
        const subBudget = budgets.find(b => b.categoryId === selectedCat.id && b.subcategoryId === sub.id);
        return sum + (subBudget ? subBudget.amount : 0);
      }, 0);

      const newTotal = otherSubsTotal + val;

      if (categoryLimit > 0 && newTotal > categoryLimit) {
        triggerAlert(
          'Subcategory Targets Exceed Limit',
          `The total of all subcategory targets (₹${newTotal.toFixed(0)}) will exceed the "${selectedCat.name}" category limit (₹${categoryLimit.toFixed(0)}).\n\nWould you like to increase the category limit to ₹${newTotal.toFixed(0)}?`,
          'confirm',
          async () => {
            // User chose to increase - save subcategory target AND increase parent
            await upsertBudget(selectedCat.id, newTotal, null); // update parent
            await upsertBudget(selectedCat.id, val, selectedSubcat.id); // save subcategory
            setBudgetModalVisible(false);
            setSelectedCat(null);
            setSelectedSubcat(null);
          },
          'Increase',
          'Cancel',
          true, // cancelOnRight: cancel in right and ok in left
          true  // cancelHighlight: cancel highlighted in red, ok as normal
        );
        return;
      }
    }

    // If saving a category target (not subcategory), validate against sum of subcategory targets
    if (!selectedSubcat) {
      const catSubs = subcategories.filter(s => s.categoryId === selectedCat.id);
      const subsTotal = catSubs.reduce((sum, sub) => {
        const subBudget = budgets.find(b => b.categoryId === selectedCat.id && b.subcategoryId === sub.id);
        return sum + (subBudget ? subBudget.amount : 0);
      }, 0);

      if (subsTotal > 0 && val < subsTotal) {
        triggerAlert(
          'Category Target Too Low',
          `The total of subcategory targets (₹${subsTotal.toFixed(0)}) exceeds the category target you entered (₹${val.toFixed(0)}).\n\nWould you like to set the category target to ₹${subsTotal.toFixed(0)} instead?`,
          'confirm',
          async () => {
            await upsertBudget(selectedCat.id, subsTotal, null);
            setBudgetModalVisible(false);
            setSelectedCat(null);
            setSelectedSubcat(null);
          },
          'Set to ₹' + subsTotal.toFixed(0),
          'Keep ₹' + val.toFixed(0),
          false,
          false
        );
        return;
      }
    }

    await upsertBudget(selectedCat.id, val, selectedSubcat ? selectedSubcat.id : null);
    setBudgetModalVisible(false);
    setSelectedCat(null);
    setSelectedSubcat(null);
  };

  const getDaysRemaining = (dateStr: string) => {
    const target = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleOpenAddSub = () => {
    setSubName('');
    setSubAmount('');
    setSubDate(new Date().toISOString().split('T')[0]);
    setSubModalVisible(true);
  };

  const handleSaveSub = async () => {
    if (!subName.trim() || !subAmount) {
      triggerAlert('Missing Fields', 'Please fill out subscription Name and Money.');
      return;
    }

    const amt = parseFloat(subAmount);
    if (isNaN(amt) || amt <= 0) {
      triggerAlert('Invalid Cost', 'Please enter a valid positive cost.');
      return;
    }

    const billingDate = subDate.trim() || new Date().toISOString().split('T')[0];

    const defaultCatId = categories.length > 0 ? categories[0].id : '';
    const defaultAccId = accounts.length > 0 ? accounts[0].id : '';

    try {
      await addRecurringBill(subName.trim(), amt, defaultCatId, defaultAccId, 'monthly', billingDate);
      setSubModalVisible(false);
    } catch (err: any) {
      triggerAlert('Save Failed', err.message || 'Failed to save subscription.');
    }
  };

  const handleDeleteSub = (subId: string, subName: string) => {
    triggerAlert(
      'Delete Subscription?',
      `Are you sure you want to remove "${subName}" from your subscriptions tracker?`,
      'destructive',
      async () => {
        try {
          await deleteRecurringBill(subId);
        } catch (err: any) {
          triggerAlert('Delete Failed', err.message || 'Failed to delete subscription.');
        }
      }
    );
  };

  const expenseCategories = categories.filter(c => c.type === 'expense');

  return (
    <View style={{ paddingTop: insets.top }} className={`flex-1 ${theme.bg} px-5`}>
      {/* HEADER */}
      <View className="mt-3 mb-4">
        <Text className={`text-3xl font-extrabold tracking-tight ${theme.text}`}>
          Planning
        </Text>
        <Text className={`${theme.subtext} text-xs font-semibold uppercase tracking-wider mt-0.5`}>
          Budgets & Auto-Renewals
        </Text>
      </View>

      {/* SEGMENT SELECTOR */}
      <View className={`flex-row ${theme.glassBg} border ${theme.border} p-1 rounded-2xl mb-5`}>
        {(['budgets', 'subscriptions'] as const).map(segment => (
          <TouchableOpacity
            key={segment}
            onPress={() => setActiveSegment(segment)}
            className={`flex-1 py-3 items-center rounded-xl ${
              activeSegment === segment ? 'bg-indigoAcc' : ''
            }`}
          >
            <Text className={`text-xs font-bold uppercase tracking-wider ${
              activeSegment === segment ? 'text-white' : theme.subtext
            }`}>
              {segment === 'budgets' ? 'Budgets' : 'Subscriptions'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* CONTENT LIST */}
      {activeSegment === 'budgets' ? (
        <FlatList
          data={expenseCategories}
          keyExtractor={(cat: any) => `budget-cat-${cat.id}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 110 }}
          removeClippedSubviews={false}
          ListEmptyComponent={() => (
            <View className={`py-12 items-center ${theme.glassBg} border ${theme.border} border-dashed rounded-3xl mt-5`}>
              <Icons.Sliders size={28} className={theme.subtext} strokeWidth={1.5} />
              <Text className={`${theme.subtext} text-xs mt-2`}>No active budgets configured</Text>
            </View>
          )}
          renderItem={({ item: cat }: { item: any }) => {
            const catBudget = budgets.find(b => b.categoryId === cat.id && !b.subcategoryId);
            const limit = catBudget ? catBudget.amount : 0;
            const spent = catBudget ? catBudget.spent : 0;
            const hasBudget = limit > 0;
            const percent = hasBudget ? (spent / limit) * 100 : 0;
            const displayPercent = Math.min(percent, 100);

            let progressColor = '#10B981';
            if (percent >= 80 && percent < 100) {
              progressColor = '#F59E0B';
            } else if (percent >= 100) {
              progressColor = '#EF4444';
            }

            const CatIcon = (Icons as any)[cat.icon] || Icons.HelpCircle;
            const catSubs = subcategories.filter(s => s.categoryId === cat.id);
            const isExpanded = !!expandedBudgetCats[cat.id];

            return (
              <View className={`${theme.card} border ${theme.border} rounded-3xl p-5 mb-4 shadow-sm`}>
                <View className="flex-row justify-between items-center">
                  <View className="flex-1 mr-4">
                    <View className="flex-row items-center mb-2.5">
                      <View style={{ backgroundColor: cat.color + '15', overflow: 'hidden' }} className="p-2 rounded-xl mr-2.5">
                        {(cat.icon && (cat.icon.startsWith('uri:') || cat.icon.startsWith('data:'))) ? (
                          <Image source={{ uri: cat.icon.startsWith('uri:') ? cat.icon.replace('uri:', '') : cat.icon }} style={{ width: 14, height: 14 }} />
                        ) : (
                          <CatIcon size={14} color={cat.color} />
                        )}
                      </View>
                      <Text className={`${theme.text} text-base font-bold`}>{cat.name}</Text>
                    </View>

                    {hasBudget ? (
                      <>
                        <View className="flex-row justify-between items-center mb-1.5">
                          <Text className={`${theme.subtext} text-[10px] font-semibold`}>
                            Spent: ₹{spent.toFixed(2)}
                          </Text>
                          <Text className={`${theme.text} text-[10px] font-bold`}>
                            Limit: ₹{limit.toFixed(0)}
                          </Text>
                        </View>
                        <View 
                          style={{ backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }} 
                          className="w-full h-2.5 rounded-full overflow-hidden"
                        >
                          <View style={{ width: `${displayPercent}%`, backgroundColor: progressColor }} className="h-full rounded-full" />
                        </View>
                      </>
                    ) : (
                      <Text className={`${theme.subtext} text-[10px] font-medium italic`}>
                        No category target set
                      </Text>
                    )}
                  </View>

                  <TouchableOpacity 
                    onPress={() => handleAdjustPress(cat, limit)}
                    className="p-3 bg-white/5 border border-white/5 rounded-2xl active:bg-white/10 justify-center items-center"
                  >
                    <Icons.Sliders size={14} color="#6366F1" strokeWidth={2} />
                  </TouchableOpacity>
                </View>

                {/* SUBCATEGORY BUDGETS ACCORDION */}
                {catSubs.length > 0 && (
                  <View className="mt-3 pt-3 border-t border-white/5">
                    <TouchableOpacity 
                      onPress={() => toggleBudgetCatExpand(cat.id)}
                      className="flex-row justify-between items-center py-1"
                    >
                      <Text className="text-indigoAcc font-bold text-[10px] uppercase tracking-wider">
                        {isExpanded ? 'Hide Subcategory Targets' : `Subcategory Targets (${catSubs.length})`}
                      </Text>
                      {isExpanded ? (
                        <Icons.ChevronUp size={14} color="#6366F1" />
                      ) : (
                        <Icons.ChevronDown size={14} color="#6366F1" />
                      )}
                    </TouchableOpacity>

                    {isExpanded && (
                      <View className="mt-2.5 space-y-2">
                        {catSubs.map(sub => {
                          const subBudget = budgets.find(b => b.categoryId === cat.id && b.subcategoryId === sub.id);
                          const subLimit = subBudget ? subBudget.amount : 0;
                          const subSpent = subBudget ? subBudget.spent : 0;
                          const hasSubBudget = subLimit > 0;
                          const subPercent = hasSubBudget ? (subSpent / subLimit) * 100 : 0;
                          const subDisplayPercent = Math.min(subPercent, 100);

                          let subProgressColor = '#10B981';
                          if (subPercent >= 80 && subPercent < 100) {
                            subProgressColor = '#F59E0B';
                          } else if (subPercent >= 100) {
                            subProgressColor = '#EF4444';
                          }

                          return (
                            <View 
                              key={sub.id} 
                              className="bg-white/5 rounded-xl p-3 flex-row justify-between items-center mb-1.5"
                            >
                              <View className="flex-1 mr-3">
                                <View className="flex-row justify-between items-center mb-1">
                                  <Text className={`${theme.text} text-xs font-semibold`}>{sub.name}</Text>
                                  <Text className={`${theme.text} text-[10px] font-bold`}>
                                    {hasSubBudget ? `Limit: ₹${subLimit.toFixed(0)}` : 'No limit'}
                                  </Text>
                                </View>

                                {hasSubBudget ? (
                                  <>
                                    <View className="flex-row justify-between items-center mb-1">
                                      <Text className={`${theme.subtext} text-[9px] font-medium`}>
                                        Spent: ₹{subSpent.toFixed(2)}
                                      </Text>
                                      <Text className="text-indigoAcc-light text-[9px] font-extrabold">
                                        {subPercent.toFixed(0)}%
                                      </Text>
                                    </View>
                                    <View 
                                      style={{ backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} 
                                      className="w-full h-1.5 rounded-full overflow-hidden"
                                    >
                                      <View 
                                        style={{ width: `${subDisplayPercent}%`, backgroundColor: subProgressColor }} 
                                        className="h-full rounded-full" 
                                      />
                                    </View>
                                  </>
                                ) : (
                                  <Text className={`${theme.subtext} text-[9px] italic`}>
                                    Spent: ₹{subSpent.toFixed(2)}
                                  </Text>
                                )}
                              </View>

                              <TouchableOpacity 
                                onPress={() => handleAdjustPress(cat, subLimit, sub)}
                                className="p-2 bg-white/5 rounded-lg active:bg-white/10"
                              >
                                <Icons.Sliders size={12} color="#6366F1" />
                              </TouchableOpacity>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          }}
        />
      ) : (
        <View className="flex-1">
          {/* Add Subscription Button */}
          <TouchableOpacity 
            onPress={handleOpenAddSub}
            className="mb-4 w-full py-3.5 bg-mint rounded-2xl flex-row justify-center items-center active:scale-98 shadow-sm"
          >
            <Icons.Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
            <Text className="text-white text-xs font-extrabold ml-2">Add New Subscription</Text>
          </TouchableOpacity>

          <FlatList
            data={recurringBills}
            keyExtractor={(item: any) => `recurring-${item.id}`}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 110 }}
            removeClippedSubviews={false}
            ListEmptyComponent={() => (
              <View className={`py-12 items-center ${theme.glassBg} border ${theme.border} border-dashed rounded-3xl mt-2`}>
                <Icons.CalendarDays size={28} className={theme.subtext} strokeWidth={1.5} />
                <Text className={`${theme.subtext} text-xs mt-2`}>No subscriptions added yet</Text>
              </View>
            )}
            renderItem={({ item }: { item: any }) => {
              const daysRemaining = getDaysRemaining(item.nextBillingDate);
              const isUrgent = daysRemaining <= 5;

              return (
                <View className={`flex-row justify-between items-center ${theme.card} border ${theme.border} rounded-2xl p-4 mb-3 shadow-sm`}>
                  <View className="flex-row items-center flex-1 mr-2">
                    <View style={{ backgroundColor: '#6366F115' }} className="p-3 rounded-2xl justify-center items-center mr-3.5">
                      <Icons.Zap size={16} color="#6366F1" strokeWidth={1.5} />
                    </View>
                    <View className="flex-1">
                      <Text className={`${theme.text} text-sm font-bold truncate`}>{item.name}</Text>
                      <Text className={`text-[10px] ${theme.subtext} mt-0.5`}>Monthly Renewal</Text>
                    </View>
                  </View>
                  <View className="flex-row items-center">
                    <View className="items-end">
                      <Text className={`${theme.text} text-sm font-extrabold`}>₹{item.amount.toFixed(2)}</Text>
                      <Text className={`text-[10px] mt-1 font-medium ${isUrgent ? 'text-coral' : 'text-indigoAcc-light'}`}>
                        Due in {daysRemaining} days
                      </Text>
                    </View>

                    <TouchableOpacity 
                      onPress={() => handleDeleteSub(item.id, item.name)}
                      className="p-2 bg-coral-dim rounded-xl border border-coral/5 active:bg-coral/20 ml-3"
                    >
                      <Icons.Trash2 size={12} color="#EF4444" strokeWidth={1.5} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        </View>
      )}

      {/* ADJUST BUDGET LIMIT MODAL */}
      <Modal visible={budgetModalVisible} transparent={true} animationType="slide" onRequestClose={() => setBudgetModalVisible(false)}>
        <View className="flex-1 justify-end bg-black/85">
          <Animated.View 
            style={{ 
              transform: [{ translateY: panY }],
              marginBottom: animatedKeyboardHeight,
              maxHeight: maxModalHeight,
            }}
            className={`${theme.card} border-t-2 border-obsidian-border rounded-t-[32px] p-6 pb-8`}
          >
            {/* DRAG HANDLE */}
            <View {...panResponder.panHandlers} className="items-center py-3 -mt-3 mb-2">
              <View className="w-12 h-1 bg-white/20 rounded-full" />
            </View>

            <View className="flex-row justify-between items-center mb-4">
              <Text className={`${theme.text} text-xl font-bold tracking-tight`}>
                {selectedSubcat ? 'Set Subcategory Target' : 'Set Budget Limit'}
              </Text>
              <TouchableOpacity onPress={() => setBudgetModalVisible(false)} className="p-1">
                <Icons.X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView ref={budgetScrollRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text className={`${theme.subtext} text-xs font-semibold uppercase tracking-wider mb-2`}>
                {selectedSubcat ? `Target: ${selectedSubcat.name} (${selectedCat?.name})` : `Category: ${selectedCat?.name}`}
              </Text>

              <View className={`${theme.glassBg} border ${theme.border} rounded-2xl p-5 mb-4 justify-center items-end`}>
                <Text className={`${theme.subtext} text-[10px] font-medium uppercase tracking-wider mb-1`}>
                  Monthly Target Limit (₹)
                </Text>
                <TextInput
                  value={amountInput}
                  onChangeText={setAmountInput}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={theme.isDark ? '#374151' : '#9CA3AF'}
                  className={`${theme.text} text-3xl font-extrabold text-right tracking-tight w-full`}
                  autoFocus={true}
                />
              </View>

              {selectedSubcat && (() => {
                const catBudget = budgets.find(b => b.categoryId === selectedCat?.id && !b.subcategoryId);
                const categoryLimit = catBudget ? catBudget.amount : 0;
                const catSubs = subcategories.filter(s => s.categoryId === selectedCat?.id);
                const currentSubsTotal = catSubs.reduce((sum, sub) => {
                  const subBudget = budgets.find(b => b.categoryId === selectedCat?.id && b.subcategoryId === sub.id);
                  return sum + (subBudget ? subBudget.amount : 0);
                }, 0);
                const remaining = categoryLimit - currentSubsTotal;

                if (categoryLimit <= 0) return null;

                return (
                  <View className={`${theme.glassBg} border ${theme.border} rounded-2xl p-4 mb-4`}>
                    <Text className={`${theme.subtext} text-[9px] font-extrabold uppercase tracking-wider mb-2`}>
                      Category Allocation Overview
                    </Text>
                    <View className="flex-row justify-between items-center mb-1.5">
                      <Text className={`${theme.subtext} text-[10px] font-medium`}>
                        {selectedCat?.name} Target
                      </Text>
                      <Text className={`${theme.text} text-[10px] font-bold`}>
                        ₹{categoryLimit.toFixed(0)}
                      </Text>
                    </View>
                    <View className="flex-row justify-between items-center mb-1.5">
                      <Text className={`${theme.subtext} text-[10px] font-medium`}>
                        Subcategories Allocated
                      </Text>
                      <Text className={`text-[10px] font-bold ${currentSubsTotal > categoryLimit ? 'text-coral' : 'text-indigoAcc-light'}`}>
                        ₹{currentSubsTotal.toFixed(0)}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} className="w-full h-px my-1.5" />
                    <View className="flex-row justify-between items-center">
                      <Text className={`${theme.subtext} text-[10px] font-semibold`}>
                        Remaining
                      </Text>
                      <Text className={`text-[10px] font-extrabold ${remaining >= 0 ? 'text-mint' : 'text-coral'}`}>
                        ₹{remaining.toFixed(0)}
                      </Text>
                    </View>
                  </View>
                );
              })()}
            </ScrollView>

            <View className="flex-row justify-between space-x-3 mt-3">
              <TouchableOpacity 
                onPress={() => setBudgetModalVisible(false)}
                className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl items-center active:bg-white/10"
              >
                <Text className={`${theme.text} text-xs font-bold`}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={handleSaveBudget}
                className="flex-1 py-4 bg-mint rounded-2xl items-center active:scale-95 shadow-md shadow-mint/20"
              >
                <Text className="text-white text-xs font-extrabold">Save Target</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* ADD SUBSCRIPTION MODAL (SIMPLIFIED) */}
      <Modal visible={subModalVisible} transparent={true} animationType="slide" onRequestClose={() => setSubModalVisible(false)}>
        <View className="flex-1 justify-end bg-black/85">
          <Animated.View 
            style={{ 
              transform: [{ translateY: panY }],
              marginBottom: animatedKeyboardHeight,
              maxHeight: maxModalHeight,
            }}
            className={`${theme.card} border-t-2 border-obsidian-border rounded-t-[32px] p-6 pb-8`}
          >
            {/* DRAG HANDLE */}
            <View {...panResponder.panHandlers} className="items-center py-3 -mt-3 mb-2">
              <View className="w-12 h-1 bg-white/20 rounded-full" />
            </View>

            <View className="flex-row justify-between items-center mb-4">
              <Text className={`${theme.text} text-xl font-bold tracking-tight`}>Add Subscription</Text>
              <TouchableOpacity onPress={() => setSubModalVisible(false)} className="p-1">
                <Icons.X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              ref={subScrollRef} 
              keyboardShouldPersistTaps="handled" 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {/* Subscription Name */}
              <View className="mb-4">
                <Text className={`${theme.subtext} text-xs font-semibold uppercase tracking-wider mb-2`}>
                  Subscription Name
                </Text>
                <TextInput
                  value={subName}
                  onChangeText={setSubName}
                  placeholder="e.g. Netflix, Spotify, Gym"
                  placeholderTextColor={theme.isDark ? '#4B5563' : '#9CA3AF'}
                  className={`${theme.inputBg} border ${theme.border} rounded-xl px-4 py-3 text-white text-xs font-medium`}
                  autoFocus={true}
                />
              </View>

              {/* Cost amount */}
              <View className="mb-4">
                <Text className={`${theme.subtext} text-xs font-semibold uppercase tracking-wider mb-2`}>
                  Money / Cost (₹)
                </Text>
                <TextInput
                  value={subAmount}
                  onChangeText={setSubAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  onFocus={() => {
                    setTimeout(() => subScrollRef.current?.scrollTo({ y: 70, animated: true }), 150);
                  }}
                  placeholderTextColor={theme.isDark ? '#4B5563' : '#9CA3AF'}
                  className={`${theme.inputBg} border ${theme.border} rounded-xl px-4 py-3 text-white text-xs font-medium`}
                />
              </View>

              {/* Optional next billing date */}
              <View className="mb-4">
                <Text className={`${theme.subtext} text-xs font-semibold uppercase tracking-wider mb-2`}>
                  Next Billing Date (Optional)
                </Text>
                <TextInput
                  value={subDate}
                  onChangeText={setSubDate}
                  placeholder="YYYY-MM-DD"
                  onFocus={() => {
                    setTimeout(() => subScrollRef.current?.scrollTo({ y: 150, animated: true }), 150);
                  }}
                  placeholderTextColor={theme.isDark ? '#4B5563' : '#9CA3AF'}
                  className={`${theme.inputBg} border ${theme.border} rounded-xl px-4 py-3 text-white text-xs font-medium`}
                />
              </View>
            </ScrollView>

            {/* Action Buttons */}
            <View className="flex-row justify-between space-x-3 mt-2">
              <TouchableOpacity 
                onPress={() => setSubModalVisible(false)}
                className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl items-center active:bg-white/10"
              >
                <Text className={`${theme.text} text-xs font-bold`}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={handleSaveSub}
                className="flex-1 py-4 bg-mint rounded-2xl items-center active:scale-95 shadow-md shadow-mint/20"
              >
                <Text className="text-white text-xs font-extrabold">Save Subscription</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* CUSTOM CONFIRM DIALOG */}
      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        type={alertType}
        confirmText={alertConfirmText}
        cancelText={alertCancelText}
        cancelOnRight={alertCancelOnRight}
        cancelHighlight={alertCancelHighlight}
        onConfirm={alertAction}
        onCancel={() => setAlertVisible(false)}
      />
    </View>
  );
};
