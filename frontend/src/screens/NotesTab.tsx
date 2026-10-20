import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Icons from 'lucide-react-native';
import { useDatabase } from '../context/DatabaseContext';
import { useTheme } from '../utils/theme';
import { CustomAlert } from '../components/CustomAlert';
import { useKeyboard } from '../utils/useKeyboard';

export const NotesTab: React.FC = () => {
  const {
    noteTopicsList,
    noteFieldsList,
    noteEntriesList,
    addNoteTopic,
    updateNoteTopic,
    deleteNoteTopic,
    addNoteField,
    updateNoteField,
    deleteNoteField,
    addNoteEntry,
    deleteNoteEntry,
    toggleNoteEntrySettled,
  } = useDatabase();

  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { keyboardHeight, animatedKeyboardHeight, maxModalHeight } = useKeyboard();

  // Expanded topics state
  const [expandedTopics, setExpandedTopics] = useState<{ [topicId: string]: boolean }>({});

  // Add entry modal state
  const [addEntryModalVisible, setAddEntryModalVisible] = useState(false);
  const [addEntryTopicId, setAddEntryTopicId] = useState<string | null>(null);
  const [entryFieldValues, setEntryFieldValues] = useState<Record<string, string>>({});

  // Customization modal state
  const [customizeVisible, setCustomizeVisible] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editTopicName, setEditTopicName] = useState('');
  const [editTopicShowTotal, setEditTopicShowTotal] = useState(false);
  const [editTopicTotalLabel, setEditTopicTotalLabel] = useState('');
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<'text' | 'number'>('text');
  const [addFieldForTopicId, setAddFieldForTopicId] = useState<string | null>(null);

  // Alert dialog state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'info' | 'confirm' | 'destructive'>('info');
  const [alertAction, setAlertAction] = useState<() => void>(() => { });

  const triggerAlert = (
    title: string,
    message: string,
    type: 'info' | 'confirm' | 'destructive' = 'info',
    onConfirm: () => void = () => { }
  ) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertType(type);
    setAlertAction(() => () => {
      setAlertVisible(false);
      onConfirm();
    });
    setAlertVisible(true);
  };

  // Swipe-to-dismiss for modal
  const panY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
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
            setAddEntryModalVisible(false);
            panY.setValue(0);
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

  // Toggle topic expand/collapse
  const toggleTopicExpand = (topicId: string) => {
    setExpandedTopics(prev => ({ ...prev, [topicId]: !prev[topicId] }));
  };

  // Calculate totals for topics that have showTotal enabled
  const topicTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    noteTopicsList.forEach(topic => {
      if (topic.showTotal) {
        const topicFields = noteFieldsList.filter(f => f.topicId === topic.id && f.type === 'number');
        const topicEntries = noteEntriesList.filter(e => e.topicId === topic.id && !e.isSettled);
        let total = 0;
        topicEntries.forEach(entry => {
          try {
            const data = JSON.parse(entry.data);
            topicFields.forEach(field => {
              const val = parseFloat(data[field.id]);
              if (!isNaN(val)) total += val;
            });
          } catch { }
        });
        totals[topic.id] = total;
      }
    });
    return totals;
  }, [noteTopicsList, noteFieldsList, noteEntriesList]);

  // Grand total across all topics with showTotal
  const grandTotal = useMemo(() => {
    return Object.values(topicTotals).reduce((sum, v) => sum + v, 0);
  }, [topicTotals]);

  const hasAnyShowTotal = noteTopicsList.some(t => t.showTotal);

  // Open add entry modal
  const handleOpenAddEntry = (topicId: string) => {
    setAddEntryTopicId(topicId);
    setEntryFieldValues({});
    panY.setValue(0);
    setAddEntryModalVisible(true);
  };

  // Save entry
  const handleSaveEntry = async () => {
    if (!addEntryTopicId) return;
    const fields = noteFieldsList.filter(f => f.topicId === addEntryTopicId);
    
    // Validate at least one field has a value
    const hasValue = fields.some(f => {
      const val = entryFieldValues[f.id];
      return val && val.trim().length > 0;
    });
    if (!hasValue) {
      triggerAlert('Missing Data', 'Please fill in at least one field.');
      return;
    }

    // Build data object
    const data: Record<string, string | number> = {};
    fields.forEach(f => {
      const val = entryFieldValues[f.id] || '';
      if (f.type === 'number') {
        data[f.id] = parseFloat(val) || 0;
      } else {
        data[f.id] = val;
      }
    });

    try {
      await addNoteEntry(addEntryTopicId, data);
      setAddEntryModalVisible(false);
    } catch (err: any) {
      triggerAlert('Error', err.message || 'Failed to save entry.', 'destructive');
    }
  };

  // Delete entry
  const handleDeleteEntry = (id: string) => {
    triggerAlert(
      'Delete Entry?',
      'Are you sure you want to remove this entry?',
      'destructive',
      async () => {
        try {
          await deleteNoteEntry(id);
        } catch (err: any) {
          triggerAlert('Failed', 'Could not delete entry.', 'destructive');
        }
      }
    );
  };

  // Toggle settled
  const handleToggleSettled = async (id: string) => {
    try {
      await toggleNoteEntrySettled(id);
    } catch (err) {
      console.error('Failed to toggle settled:', err);
    }
  };

  // Customization handlers
  const handleAddTopic = async () => {
    if (!newTopicName.trim()) {
      triggerAlert('Missing Name', 'Please enter a topic name.');
      return;
    }
    try {
      await addNoteTopic(newTopicName.trim(), false, 'Total');
      setNewTopicName('');
    } catch (err: any) {
      triggerAlert('Error', err.message || 'Failed to add topic.', 'destructive');
    }
  };

  const handleStartEditTopic = (topic: any) => {
    setEditingTopicId(topic.id);
    setEditTopicName(topic.name);
    setEditTopicShowTotal(topic.showTotal);
    setEditTopicTotalLabel(topic.totalLabel || 'Total');
  };

  const handleSaveEditTopic = async () => {
    if (!editingTopicId || !editTopicName.trim()) return;
    try {
      await updateNoteTopic(editingTopicId, editTopicName.trim(), editTopicShowTotal, editTopicTotalLabel.trim() || 'Total');
      setEditingTopicId(null);
    } catch (err: any) {
      triggerAlert('Error', err.message || 'Failed to update topic.', 'destructive');
    }
  };

  const handleDeleteTopic = (topicId: string, topicName: string) => {
    triggerAlert(
      'Delete Topic?',
      `Delete "${topicName}" and all its entries? This cannot be undone.`,
      'destructive',
      async () => {
        try {
          await deleteNoteTopic(topicId);
        } catch (err: any) {
          triggerAlert('Failed', err.message || 'Could not delete topic.', 'destructive');
        }
      }
    );
  };

  const handleAddField = async (topicId: string) => {
    if (!newFieldName.trim()) {
      triggerAlert('Missing Name', 'Please enter a field name.');
      return;
    }
    try {
      await addNoteField(topicId, newFieldName.trim(), newFieldType);
      setNewFieldName('');
      setNewFieldType('text');
      setAddFieldForTopicId(null);
    } catch (err: any) {
      triggerAlert('Error', err.message || 'Failed to add field.', 'destructive');
    }
  };

  const handleDeleteField = (fieldId: string, fieldName: string) => {
    triggerAlert(
      'Delete Field?',
      `Remove "${fieldName}" from this topic? Existing entry data for this field will be lost.`,
      'destructive',
      async () => {
        try {
          await deleteNoteField(fieldId);
        } catch (err: any) {
          triggerAlert('Failed', err.message || 'Could not delete field.', 'destructive');
        }
      }
    );
  };

  // Get field display value for an entry
  const getEntryDisplayValue = (entry: any, field: any): string => {
    try {
      const data = JSON.parse(entry.data);
      const val = data[field.id];
      if (val === undefined || val === null) return '';
      if (field.type === 'number') return `₹${parseFloat(val).toFixed(2)}`;
      return String(val);
    } catch {
      return '';
    }
  };

  // Get the primary display text for an entry (first text field)
  const getEntryPrimaryText = (entry: any, topicFields: any[]): string => {
    try {
      const data = JSON.parse(entry.data);
      const textField = topicFields.find(f => f.type === 'text');
      if (textField) return data[textField.id] || 'Untitled';
      return 'Entry';
    } catch {
      return 'Entry';
    }
  };

  // Get amount from an entry (first number field)
  const getEntryAmount = (entry: any, topicFields: any[]): number | null => {
    try {
      const data = JSON.parse(entry.data);
      const numField = topicFields.find(f => f.type === 'number');
      if (numField) {
        const val = parseFloat(data[numField.id]);
        return isNaN(val) ? null : val;
      }
      return null;
    } catch {
      return null;
    }
  };

  return (
    <View style={{ paddingTop: insets.top }} className={`flex-1 ${theme.bg} px-5`}>

      {/* HEADER */}
      <View className="mt-3 mb-4 flex-row justify-between items-center">
        <View>
          <Text className={`text-3xl font-extrabold tracking-tight ${theme.text}`}>
            Notes
          </Text>
          <Text className={`${theme.subtext} text-xs font-semibold uppercase tracking-wider mt-0.5`}>
            People & Amounts
          </Text>
        </View>
        <View className="flex-row items-center space-x-2">
          <TouchableOpacity
            onPress={() => setCustomizeVisible(true)}
            className={`p-3 ${theme.glassBg} border ${theme.border} rounded-2xl active:scale-95 mr-2`}
          >
            <Icons.Settings size={16} color="#6366F1" strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      {/* TOTAL OUTSTANDING CARD */}
      {hasAnyShowTotal && (
        <View className="bg-[#6366F1]/10 border border-[#6366F1]/20 rounded-[28px] p-5 mb-5 shadow-sm">
          {noteTopicsList.filter(t => t.showTotal).map(topic => (
            <View key={topic.id} className="mb-1">
              <Text className="text-indigoAcc-light text-[10px] font-extrabold uppercase tracking-widest mb-0.5">
                {topic.totalLabel || 'Total'}
              </Text>
              <Text className={`${theme.text} text-2xl font-extrabold tracking-tight`}>
                ₹{(topicTotals[topic.id] || 0).toFixed(2)}
              </Text>
            </View>
          ))}
          {noteTopicsList.filter(t => t.showTotal).length > 1 && (
            <View className="mt-2 pt-2 border-t border-indigoAcc/20">
              <Text className="text-indigoAcc-light text-[9px] font-extrabold uppercase tracking-widest">
                Combined Total
              </Text>
              <Text className={`${theme.text} text-xl font-extrabold tracking-tight`}>
                ₹{grandTotal.toFixed(2)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* TOPICS LIST */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {noteTopicsList.map(topic => {
          const isExpanded = !!expandedTopics[topic.id];
          const topicFields = noteFieldsList.filter(f => f.topicId === topic.id);
          const topicEntries = noteEntriesList.filter(e => e.topicId === topic.id);
          const unsettledEntries = topicEntries.filter(e => !e.isSettled);
          const settledEntries = topicEntries.filter(e => e.isSettled);

          return (
            <View key={topic.id} className="mb-4">
              {/* TOPIC HEADER — collapsible */}
              <TouchableOpacity
                onPress={() => toggleTopicExpand(topic.id)}
                className={`flex-row justify-between items-center p-4 rounded-2xl border ${
                  isExpanded
                    ? `${theme.card} border-indigoAcc/30`
                    : `${theme.card} ${theme.border}`
                } shadow-sm`}
              >
                <View className="flex-row items-center flex-1">
                  <View className="bg-indigoAcc/10 p-2.5 rounded-xl mr-3">
                    <Icons.FileText size={14} color="#6366F1" strokeWidth={2} />
                  </View>
                  <View className="flex-1">
                    <Text className={`${theme.text} text-sm font-bold`}>{topic.name}</Text>
                    <Text className={`${theme.subtext} text-[10px] mt-0.5`}>
                      {unsettledEntries.length} active · {settledEntries.length} settled
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center">
                  {topic.showTotal && (
                    <Text className={`${theme.text} text-sm font-extrabold mr-3`}>
                      ₹{(topicTotals[topic.id] || 0).toFixed(0)}
                    </Text>
                  )}
                  {isExpanded ? (
                    <Icons.ChevronUp size={16} color="#6366F1" />
                  ) : (
                    <Icons.ChevronDown size={16} color="#6366F1" />
                  )}
                </View>
              </TouchableOpacity>

              {/* EXPANDED CONTENT */}
              {isExpanded && (
                <View className="mt-2">
                  {/* Add Entry Button */}
                  <TouchableOpacity
                    onPress={() => handleOpenAddEntry(topic.id)}
                    className="mb-3 py-2.5 bg-mint/10 border border-mint/20 rounded-xl flex-row justify-center items-center active:bg-mint/20"
                  >
                    <Icons.Plus size={14} color="#10B981" strokeWidth={2.5} />
                    <Text className="text-mint text-[10px] font-extrabold uppercase tracking-wider ml-1.5">Add Entry</Text>
                  </TouchableOpacity>

                  {/* UNSETTLED ENTRIES */}
                  {unsettledEntries.map(entry => {
                    const primaryText = getEntryPrimaryText(entry, topicFields);
                    const amount = getEntryAmount(entry, topicFields);

                    return (
                      <View
                        key={entry.id}
                        className={`flex-row justify-between items-center ${theme.card} border ${theme.border} rounded-2xl p-4 mb-2 shadow-sm`}
                      >
                        <View className="flex-row items-center flex-1 mr-2">
                          <TouchableOpacity
                            onPress={() => handleToggleSettled(entry.id)}
                            className="mr-3"
                          >
                            <View
                              style={{
                                borderColor: '#6366F1',
                                backgroundColor: 'transparent',
                              }}
                              className="w-5 h-5 rounded-full border-2 justify-center items-center"
                            />
                          </TouchableOpacity>

                          <View className="bg-[#F59E0B]/10 p-2.5 rounded-xl mr-3">
                            <Icons.User size={14} color="#F59E0B" strokeWidth={2} />
                          </View>

                          <View className="flex-1">
                            <Text className={`${theme.text} text-sm font-extrabold`}>{primaryText}</Text>
                            {/* Show additional fields */}
                            {topicFields.filter(f => f.type === 'text').slice(1).map(field => {
                              const val = getEntryDisplayValue(entry, field);
                              return val ? (
                                <Text key={field.id} className={`${theme.subtext} text-[10px] mt-0.5`}>{val}</Text>
                              ) : null;
                            })}
                          </View>
                        </View>

                        <View className="flex-row items-center space-x-2">
                          {amount !== null && (
                            <Text className={`${theme.text} text-sm font-extrabold`}>
                              ₹{amount.toFixed(2)}
                            </Text>
                          )}
                          <TouchableOpacity
                            onPress={() => handleDeleteEntry(entry.id)}
                            className="p-2 bg-coral-dim rounded-xl border border-coral/5 active:bg-coral/20 ml-2"
                          >
                            <Icons.Trash2 size={12} color="#EF4444" strokeWidth={1.5} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}

                  {/* SETTLED ENTRIES */}
                  {settledEntries.length > 0 && (
                    <View className="mb-2 mt-3 flex-row justify-between items-center px-1">
                      <Text className={`${theme.subtext} text-[10px] font-semibold uppercase tracking-wider`}>
                        Settled
                      </Text>
                      <Text className="text-[10px] text-mutedText font-semibold">
                        {settledEntries.length} entries
                      </Text>
                    </View>
                  )}

                  {settledEntries.map(entry => {
                    const primaryText = getEntryPrimaryText(entry, topicFields);
                    const amount = getEntryAmount(entry, topicFields);

                    return (
                      <View
                        key={entry.id}
                        style={{ opacity: 0.5 }}
                        className={`flex-row justify-between items-center ${theme.card} border ${theme.border} rounded-2xl p-4 mb-2 shadow-sm`}
                      >
                        <View className="flex-row items-center flex-1 mr-2">
                          <TouchableOpacity
                            onPress={() => handleToggleSettled(entry.id)}
                            className="mr-3"
                          >
                            <View
                              style={{
                                borderColor: '#10B981',
                                backgroundColor: '#10B981',
                              }}
                              className="w-5 h-5 rounded-full border-2 justify-center items-center"
                            >
                              <Icons.Check size={10} color="#FFFFFF" strokeWidth={3} />
                            </View>
                          </TouchableOpacity>

                          <View className="bg-mint/10 p-2.5 rounded-xl mr-3">
                            <Icons.User size={14} color="#10B981" strokeWidth={2} />
                          </View>

                          <View className="flex-1">
                            <Text className={`${theme.text} text-sm font-extrabold line-through`}>{primaryText}</Text>
                          </View>
                        </View>

                        <View className="flex-row items-center space-x-2">
                          {amount !== null && (
                            <Text className={`${theme.subtext} text-sm font-extrabold line-through`}>
                              ₹{amount.toFixed(2)}
                            </Text>
                          )}
                          <TouchableOpacity
                            onPress={() => handleDeleteEntry(entry.id)}
                            className="p-2 bg-coral-dim rounded-xl border border-coral/5 active:bg-coral/20 ml-2"
                          >
                            <Icons.Trash2 size={12} color="#EF4444" strokeWidth={1.5} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}

                  {topicEntries.length === 0 && (
                    <View className={`py-6 items-center ${theme.glassBg} border ${theme.border} border-dashed rounded-2xl`}>
                      <Text className={`${theme.subtext} text-xs italic`}>No entries in this topic</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}

        {/* EMPTY STATE */}
        {noteTopicsList.length === 0 && (
          <View className={`py-12 items-center ${theme.glassBg} border ${theme.border} border-dashed rounded-3xl mt-5`}>
            <Icons.NotebookPen size={28} color={theme.isDark ? '#6B7280' : '#9CA3AF'} strokeWidth={1.5} />
            <Text className={`${theme.subtext} text-xs mt-2`}>No topics configured</Text>
            <Text className={`${theme.subtext} text-[10px] mt-1`}>Tap the settings icon to add topics</Text>
          </View>
        )}
      </ScrollView>

      {/* ADD ENTRY MODAL */}
      <Modal visible={addEntryModalVisible} transparent={true} animationType="slide" onRequestClose={() => setAddEntryModalVisible(false)}>
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
                Add Entry
              </Text>
              <TouchableOpacity onPress={() => setAddEntryModalVisible(false)} className="p-1">
                <Icons.X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              keyboardShouldPersistTaps="handled" 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {addEntryTopicId && noteFieldsList
                .filter(f => f.topicId === addEntryTopicId)
                .map(field => (
                  <View key={field.id} className="mb-4">
                    <Text className={`${theme.subtext} text-xs font-semibold uppercase tracking-wider mb-2`}>
                      {field.name} {field.type === 'number' ? '(₹)' : ''}
                    </Text>
                    <TextInput
                      value={entryFieldValues[field.id] || ''}
                      onChangeText={(val) => setEntryFieldValues(prev => ({ ...prev, [field.id]: val }))}
                      keyboardType={field.type === 'number' ? 'decimal-pad' : 'default'}
                      placeholder={field.type === 'number' ? '0.00' : `Enter ${field.name.toLowerCase()}...`}
                      placeholderTextColor={theme.isDark ? '#4B5563' : '#9CA3AF'}
                      className={`${theme.inputBg} border ${theme.border} rounded-xl px-4 py-3 ${theme.text} text-xs font-medium`}
                    />
                  </View>
                ))
              }
            </ScrollView>

            {/* Buttons */}
            <View className="flex-row justify-between space-x-3 mt-2">
              <TouchableOpacity
                onPress={() => setAddEntryModalVisible(false)}
                className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl items-center active:bg-white/10"
              >
                <Text className={`${theme.text} text-xs font-bold`}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveEntry}
                className="flex-1 py-4 bg-mint rounded-2xl items-center active:scale-95 shadow-md shadow-mint/20"
              >
                <Text className="text-white text-xs font-extrabold">Save</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* CUSTOMIZATION MODAL */}
      <Modal visible={customizeVisible} animationType="slide" transparent={false} onRequestClose={() => setCustomizeVisible(false)}>
        <View style={{ paddingTop: insets.top, paddingBottom: insets.bottom }} className={`flex-1 ${theme.bg}`}>
          {/* Header */}
          <View className="mt-3 mb-4 px-5 flex-row justify-between items-center">
            <View>
              <Text className={`text-2xl font-extrabold tracking-tight ${theme.text}`}>
                Customize Notes
              </Text>
              <Text className={`${theme.subtext} text-xs font-semibold uppercase tracking-wider mt-0.5`}>
                Manage topics & fields
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => { setCustomizeVisible(false); setEditingTopicId(null); setAddFieldForTopicId(null); }}
              className={`p-2.5 ${theme.inputBg} rounded-xl active:scale-95`}
            >
              <Icons.X size={16} color={theme.textColor} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            className="px-5" 
            showsVerticalScrollIndicator={false} 
            contentContainerStyle={{ paddingBottom: 80 + keyboardHeight }} 
            keyboardShouldPersistTaps="handled"
          >

            {/* ADD NEW TOPIC */}
            <View className={`${theme.card} border ${theme.border} rounded-[24px] p-5 mb-5 shadow-sm`}>
              <Text className={`${theme.text} text-xs font-extrabold mb-3`}>Add New Topic</Text>
              <View className="flex-row">
                <TextInput
                  value={newTopicName}
                  onChangeText={setNewTopicName}
                  placeholder="Topic name (e.g. Investments)"
                  placeholderTextColor={theme.isDark ? '#4B5563' : '#9CA3AF'}
                  className={`${theme.inputBg} border ${theme.border} rounded-xl px-3 py-2.5 ${theme.text} text-xs font-medium flex-1`}
                />
                <TouchableOpacity
                  onPress={handleAddTopic}
                  className="bg-mint rounded-xl px-4 py-2.5 ml-2 justify-center"
                >
                  <Text className="text-white text-[10px] font-bold">Add</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* EXISTING TOPICS */}
            {noteTopicsList.map(topic => {
              const topicFields = noteFieldsList.filter(f => f.topicId === topic.id);
              const isEditing = editingTopicId === topic.id;
              const isAddingField = addFieldForTopicId === topic.id;

              return (
                <View key={topic.id} className={`${theme.card} border ${theme.border} rounded-[24px] p-5 mb-4 shadow-sm`}>
                  {isEditing ? (
                    /* EDIT MODE */
                    <View>
                      <Text className={`${theme.subtext} text-[9px] font-extrabold uppercase tracking-wider mb-2`}>Edit Topic</Text>
                      <TextInput
                        value={editTopicName}
                        onChangeText={setEditTopicName}
                        placeholder="Topic name"
                        placeholderTextColor={theme.isDark ? '#4B5563' : '#9CA3AF'}
                        className={`${theme.inputBg} border ${theme.border} rounded-xl px-3 py-2.5 ${theme.text} text-xs font-medium mb-3`}
                      />

                      {/* Show Total Toggle */}
                      <TouchableOpacity
                        onPress={() => setEditTopicShowTotal(!editTopicShowTotal)}
                        className="flex-row items-center mb-3"
                      >
                        <View
                          style={{
                            backgroundColor: editTopicShowTotal ? '#6366F1' : 'transparent',
                            borderColor: editTopicShowTotal ? '#6366F1' : theme.isDark ? '#4B5563' : '#D1D5DB',
                          }}
                          className="w-5 h-5 rounded-md border-2 justify-center items-center mr-2.5"
                        >
                          {editTopicShowTotal && <Icons.Check size={12} color="#FFF" strokeWidth={3} />}
                        </View>
                        <Text className={`${theme.text} text-xs font-medium`}>Show total value at the top</Text>
                      </TouchableOpacity>

                      {editTopicShowTotal && (
                        <View className="mb-3">
                          <Text className={`${theme.subtext} text-[9px] font-bold uppercase tracking-wider mb-1`}>Total Label</Text>
                          <TextInput
                            value={editTopicTotalLabel}
                            onChangeText={setEditTopicTotalLabel}
                            placeholder="e.g. Total Outstanding"
                            placeholderTextColor={theme.isDark ? '#4B5563' : '#9CA3AF'}
                            className={`${theme.inputBg} border ${theme.border} rounded-xl px-3 py-2 ${theme.text} text-xs font-medium`}
                          />
                        </View>
                      )}

                      <View className="flex-row space-x-2">
                        <TouchableOpacity
                          onPress={() => setEditingTopicId(null)}
                          className="flex-1 py-2.5 bg-white/5 border border-white/10 rounded-xl items-center"
                        >
                          <Text className={`${theme.text} text-[10px] font-bold`}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={handleSaveEditTopic}
                          className="flex-1 py-2.5 bg-indigoAcc rounded-xl items-center"
                        >
                          <Text className="text-white text-[10px] font-bold">Save</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    /* VIEW MODE */
                    <View>
                      <View className="flex-row justify-between items-center mb-3">
                        <View className="flex-row items-center flex-1">
                          <View className="bg-indigoAcc/10 p-2 rounded-xl mr-2.5">
                            <Icons.FileText size={14} color="#6366F1" />
                          </View>
                          <View className="flex-1">
                            <Text className={`${theme.text} text-sm font-bold`}>{topic.name}</Text>
                            {topic.showTotal && (
                              <Text className={`text-[9px] text-indigoAcc-light mt-0.5`}>
                                Shows total • {topic.totalLabel}
                              </Text>
                            )}
                          </View>
                        </View>
                        <View className="flex-row items-center space-x-1">
                          <TouchableOpacity
                            onPress={() => handleStartEditTopic(topic)}
                            className="p-2 bg-indigoAcc/10 rounded-xl active:bg-indigoAcc/20"
                          >
                            <Icons.Pencil size={12} color="#6366F1" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDeleteTopic(topic.id, topic.name)}
                            className="p-2 bg-coral-dim rounded-xl active:bg-coral/20 ml-1"
                          >
                            <Icons.Trash2 size={12} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* FIELDS LIST */}
                      <Text className={`${theme.subtext} text-[9px] font-extrabold uppercase tracking-wider mb-2`}>
                        Fields ({topicFields.length})
                      </Text>
                      {topicFields.map(field => (
                        <View key={field.id} className="flex-row justify-between items-center bg-white/5 rounded-lg p-2.5 mb-1.5">
                          <View className="flex-row items-center flex-1">
                            <View className={`px-1.5 py-0.5 rounded ${field.type === 'number' ? 'bg-mint/15' : 'bg-indigoAcc/15'} mr-2`}>
                              <Text className={`text-[8px] font-bold uppercase ${field.type === 'number' ? 'text-mint' : 'text-indigoAcc-light'}`}>
                                {field.type}
                              </Text>
                            </View>
                            <Text className={`${theme.text} text-[10px] font-semibold`}>{field.name}</Text>
                          </View>
                          <TouchableOpacity onPress={() => handleDeleteField(field.id, field.name)}>
                            <Icons.X size={12} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      ))}

                      {/* ADD FIELD */}
                      {isAddingField ? (
                        <View className="mt-2 bg-white/5 rounded-xl p-3">
                          <TextInput
                            value={newFieldName}
                            onChangeText={setNewFieldName}
                            placeholder="Field name..."
                            placeholderTextColor={theme.isDark ? '#4B5563' : '#9CA3AF'}
                            autoFocus
                            className={`${theme.inputBg} border ${theme.border} rounded-lg px-3 py-2 ${theme.text} text-[10px] font-medium mb-2`}
                          />
                          <View className="flex-row items-center mb-2">
                            <Text className={`${theme.subtext} text-[9px] font-bold mr-2`}>Type:</Text>
                            {(['text', 'number'] as const).map(t => (
                              <TouchableOpacity
                                key={t}
                                onPress={() => setNewFieldType(t)}
                                className={`px-3 py-1.5 rounded-lg mr-2 ${newFieldType === t ? 'bg-indigoAcc' : 'bg-white/5 border border-white/10'}`}
                              >
                                <Text className={`text-[9px] font-bold uppercase ${newFieldType === t ? 'text-white' : theme.subtext}`}>
                                  {t}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                          <View className="flex-row space-x-2">
                            <TouchableOpacity
                              onPress={() => { setAddFieldForTopicId(null); setNewFieldName(''); }}
                              className="flex-1 py-2 bg-white/5 border border-white/10 rounded-lg items-center"
                            >
                              <Text className={`${theme.text} text-[9px] font-bold`}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleAddField(topic.id)}
                              className="flex-1 py-2 bg-mint rounded-lg items-center"
                            >
                              <Text className="text-white text-[9px] font-bold">Add Field</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => { setAddFieldForTopicId(topic.id); setNewFieldName(''); setNewFieldType('text'); }}
                          className="mt-2 py-2 bg-white/5 border border-white/10 rounded-xl items-center active:bg-white/10 flex-row justify-center"
                        >
                          <Icons.Plus size={12} color="#6366F1" />
                          <Text className="text-indigoAcc text-[10px] font-bold ml-1">Add Field</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      {/* CUSTOM ALERT */}
      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        type={alertType}
        onConfirm={alertAction}
        onCancel={() => setAlertVisible(false)}
      />
    </View>
  );
};
