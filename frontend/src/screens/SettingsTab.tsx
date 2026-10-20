import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, Share, KeyboardAvoidingView, Platform, ScrollView, Image, Modal, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Icons from 'lucide-react-native';
import { useDatabase } from '../context/DatabaseContext';
import { CustomAlert } from '../components/CustomAlert';
import { useTheme } from '../utils/theme';
import { useKeyboard } from '../utils/useKeyboard';
import * as FileSystem from 'expo-file-system/src/legacy/FileSystem';
import { EncodingType } from 'expo-file-system/src/legacy/FileSystem.types';

import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { expoDb } from '../db/client';
import { registerBackgroundBackup, unregisterBackgroundBackup } from '../utils/backgroundBackup';

// Available icons for custom categories (matching the 7 default categories)
const CATEGORY_ICONS = [
  'Briefcase',
  'TrendingUp',
  'ShoppingBag',
  'Utensils',
  'Home',
  'Car',
  'Tv'
];

// Premium colors for custom categories
const CATEGORY_COLORS = [
  { name: 'Mint', value: '#10B981' },
  { name: 'Indigo', value: '#6366F1' },
  { name: 'Coral', value: '#EF4444' },
  { name: 'Amber', value: '#F59E0B' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Teal', value: '#14B8A6' }
];

export const SettingsTab: React.FC = () => {
  const {
    categories,
    subcategories,
    addCategory,
    deleteCategory,
    updateCategory,
    addSubcategory,
    deleteSubcategory,
    updateSubcategory,
    exportDatabase,
    importDatabase,
    clearAllData,
    isDarkMode,
    toggleTheme
  } = useDatabase();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { keyboardHeight, animatedKeyboardHeight } = useKeyboard();

  // Dialog configurations
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'info' | 'confirm' | 'destructive';
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    onConfirm: () => { },
  });

  const triggerAlert = (
    title: string,
    message: string,
    type: 'info' | 'confirm' | 'destructive' = 'info',
    onConfirm: () => void = () => { },
    onCancel: () => void = () => { }
  ) => {
    setAlertConfig({
      visible: true,
      title,
      message,
      type,
      onConfirm: () => {
        setAlertConfig(prev => ({ ...prev, visible: false }));
        onConfirm();
      },
      onCancel: () => {
        setAlertConfig(prev => ({ ...prev, visible: false }));
        onCancel();
      }
    });
  };

  // Auto Backup states
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [autoBackupUri, setAutoBackupUri] = useState<string | null>(null);

  useEffect(() => {
    try {
      const enabledRow = expoDb.getFirstSync<{ value: string }>("SELECT value FROM app_settings WHERE key = 'auto_backup_enabled'");
      setAutoBackupEnabled(enabledRow?.value === 'true');
      
      const uriRow = expoDb.getFirstSync<{ value: string }>("SELECT value FROM app_settings WHERE key = 'auto_backup_uri'");
      setAutoBackupUri(uriRow?.value || null);
    } catch (e) {
      console.log('Failed to load auto backup settings', e);
    }
  }, []);

  // Category addition form state
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'expense' | 'income'>('expense');
  const [newCatIcon, setNewCatIcon] = useState('ShoppingBag');
  const [newCatColor, setNewCatColor] = useState('#6366F1');

  const handlePickImage = async () => {
    try {
      const ImagePicker = require('expo-image-picker');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          const mime = asset.mimeType || 'image/jpeg';
          setNewCatIcon(`data:${mime};base64,${asset.base64}`);
        } else {
          setNewCatIcon(`uri:${asset.uri}`);
        }
      }
    } catch (err) {
      console.error('Image picker not available:', err);
    }
  };

  // Subcategory form states
  const [expandedCategoryForSub, setExpandedCategoryForSub] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState('');

  // Collapsible toggle for inline category list
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);

  // Edit category modal state
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatIcon, setEditCatIcon] = useState('');
  const [editCatColor, setEditCatColor] = useState('');
  // Edit subcategory inline state  
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editSubName, setEditSubName] = useState('');

  // Handle DB export (saves backup directly to files on device)
  const handleExport = async () => {
    try {
      const backup = await exportDatabase();
      const backupString = JSON.stringify(backup, null, 2);

      // Write JSON content to local cache directory
      const fileUri = FileSystem.cacheDirectory + 'wealthflow_backup.json';
      await FileSystem.writeAsStringAsync(fileUri, backupString, {
        encoding: EncodingType.UTF8,
      });

      // Share the file URI to trigger system document saver
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Export WealthFlow Backup',
          UTI: 'public.json',
        });
      } else {
        triggerAlert('Export Error', 'Sharing or saving files is not supported on this device.', 'destructive');
      }
    } catch (err: any) {
      triggerAlert('Export Failed', err.message || 'An error occurred during database export.', 'destructive');
    }
  };

  // Handle DB import (loads backup file using device document selector)
  const handleImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const fileUri = result.assets[0].uri;
      const content = await FileSystem.readAsStringAsync(fileUri, {
        encoding: EncodingType.UTF8,
      });

      if (!content.trim()) {
        triggerAlert('Import Error', 'The selected backup file is empty.', 'info');
        return;
      }

      const parsed = JSON.parse(content.trim());

      if (!parsed || parsed.wealthflow_export !== true) {
        triggerAlert('Invalid Backup', 'The selected file is not a valid WealthFlow backup.', 'info');
        return;
      }

      triggerAlert(
        'Confirm Restore',
        'Importing this backup will completely overwrite your current database. This action cannot be undone.',
        'destructive',
        async () => {
          try {
            await importDatabase(parsed);
            triggerAlert('Success', 'Your database backup has been successfully imported!');
          } catch (err: any) {
            triggerAlert('Restore Failed', err.message || 'Error occurred during importing.', 'destructive');
          }
        }
      );
    } catch (err: any) {
      triggerAlert('Import Failed', 'Failed to read or parse the selected backup file. Make sure it is a valid WealthFlow backup JSON file.', 'destructive');
    }
  };

  const handleToggleAutoBackup = async () => {
    if (autoBackupEnabled) {
      // Disable
      try {
        expoDb.execSync(`INSERT OR REPLACE INTO app_settings (key, value) VALUES ('auto_backup_enabled', 'false');`);
        setAutoBackupEnabled(false);
        await unregisterBackgroundBackup();
        triggerAlert('Auto Backup Disabled', 'Daily automatic backups have been disabled.');
      } catch (err) {
        console.error(err);
      }
    } else {
      // Enable - require choosing a folder
      try {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const uri = permissions.directoryUri;
          expoDb.execSync(`INSERT OR REPLACE INTO app_settings (key, value) VALUES ('auto_backup_enabled', 'true');`);
          expoDb.execSync(`INSERT OR REPLACE INTO app_settings (key, value) VALUES ('auto_backup_uri', '${uri}');`);
          setAutoBackupEnabled(true);
          setAutoBackupUri(uri);
          await registerBackgroundBackup();
          triggerAlert('Auto Backup Enabled', 'Daily automatic backups are now configured. Data will be saved to your selected folder after 8 PM.');
        } else {
          triggerAlert('Permission Denied', 'Folder access is required to save automatic backups.');
        }
      } catch (err: any) {
        triggerAlert('Setup Failed', err.message || 'Failed to configure auto backup.', 'destructive');
      }
    }
  };

  // Handle clear database
  const handleClear = () => {
    triggerAlert(
      'Reset All Data?',
      'Are you sure you want to permanently erase all transactions, budgets, and subscriptions, and reset your accounts to ₹0.00? This cannot be undone.',
      'destructive',
      async () => {
        try {
          await clearAllData();
          triggerAlert('Reset Complete', 'All transactions have been deleted and accounts have been reset.');
        } catch (err: any) {
          triggerAlert('Reset Failed', err.message || 'Failed to erase data.', 'destructive');
        }
      }
    );
  };

  // Handle add category
  const handleAddCategory = async () => {
    if (newCatName.trim().toLowerCase() === 'subscription' || newCatName.trim().toLowerCase() === 'subscriptions') {
      triggerAlert('Protected Tag', 'Subscriptions are managed inside the Planning Tab directly. Please choose another category name.');
      return;
    }

    if (!newCatName.trim()) {
      triggerAlert('Missing Name', 'Please specify a name for the new category.');
      return;
    }

    try {
      await addCategory(newCatName.trim(), newCatType, newCatIcon, newCatColor);
      const addedName = newCatName.trim();
      setNewCatName('');
      triggerAlert('Success', `Category "${addedName}" created successfully!`);
    } catch (err: any) {
      triggerAlert('Creation Failed', err.message || 'Failed to create category.');
    }
  };

  // Handle delete category
  const handleDeleteCategory = (catId: string, catName: string) => {
    triggerAlert(
      'Delete Category?',
      `Are you sure you want to delete "${catName}"? Existing transactions matching this category will become uncategorized. Subcategories will be deleted.`,
      'destructive',
      async () => {
        try {
          await deleteCategory(catId);
        } catch (err: any) {
          triggerAlert('Delete Failed', err.message || 'Failed to delete category.', 'destructive');
        }
      }
    );
  };

  const handleAddSubcategory = async (categoryId: string) => {
    if (!newSubName.trim()) return;
    try {
      await addSubcategory(newSubName.trim(), categoryId);
      setNewSubName('');
    } catch (err: any) {
      triggerAlert('Failed', err.message || 'Failed to create subcategory.');
    }
  };

  const handleDeleteSubcategory = (subId: string, subName: string) => {
    triggerAlert(
      'Delete Subcategory?',
      `Are you sure you want to delete "${subName}"? Transactions in this subcategory will keep their main category.`,
      'destructive',
      async () => {
        try {
          await deleteSubcategory(subId);
        } catch (err: any) {
          triggerAlert('Delete Failed', err.message || 'Failed to delete subcategory.', 'destructive');
        }
      }
    );
  };

  const handleStartEditCategory = (cat: any) => {
    setEditingCategory(cat);
    setEditCatName(cat.name);
    setEditCatIcon(cat.icon);
    setEditCatColor(cat.color);
  };

  const handleSaveEditCategory = async () => {
    if (!editingCategory) return;
    if (!editCatName.trim()) {
      triggerAlert('Missing Name', 'Please specify a name for the category.');
      return;
    }
    try {
      await updateCategory(editingCategory.id, editCatName.trim(), editCatIcon, editCatColor);
      triggerAlert('Updated', `Category "${editCatName.trim()}" updated successfully!`);
      setEditingCategory(null);
    } catch (err: any) {
      triggerAlert('Update Failed', err.message || 'Failed to update category.', 'destructive');
    }
  };

  const handleStartEditSub = (sub: any) => {
    setEditingSubId(sub.id);
    setEditSubName(sub.name);
  };

  const handleSaveEditSub = async (subId: string) => {
    if (!editSubName.trim()) return;
    try {
      await updateSubcategory(subId, editSubName.trim());
      setEditingSubId(null);
    } catch (err: any) {
      triggerAlert('Failed', err.message || 'Failed to rename subcategory.');
    }
  };

  const handleEditPickImage = async () => {
    try {
      const ImagePicker = require('expo-image-picker');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          const mime = asset.mimeType || 'image/jpeg';
          setEditCatIcon(`data:${mime};base64,${asset.base64}`);
        } else {
          setEditCatIcon(`uri:${asset.uri}`);
        }
      }
    } catch (err) {
      console.error('Image picker not available:', err);
    }
  };

  return (
    <View style={{ paddingTop: insets.top }} className={`flex-1 ${theme.bg} px-5`}>
      {/* HEADER */}
      <View className="mt-3 mb-6">
        <Text className={`text-3xl font-extrabold tracking-tight ${theme.text}`}>
          Settings
        </Text>

      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 110 + keyboardHeight }}
        keyboardShouldPersistTaps="handled"
      >

        {/* APPEARANCE SECTION (THEME TOGGLE) */}
        <Text className="text-indigoAcc-light text-[10px] font-extrabold uppercase tracking-widest ml-1 mb-2.5">
          Appearance
        </Text>

        <View className={`${theme.card} border ${theme.border} rounded-[24px] p-5 mb-5 shadow-sm flex-row justify-between items-center`}>
          <View className="flex-row items-center">
            <View className="bg-indigoAcc/10 p-2.5 rounded-xl mr-3">
              {isDarkMode ? <Icons.Moon size={16} color="#6366F1" /> : <Icons.Sun size={16} color="#6366F1" />}
            </View>
            <View>
              <Text className={`${theme.text} text-sm font-bold`}>Dark Theme</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={toggleTheme}
            className={`px-4 py-2 rounded-xl border ${isDarkMode ? 'bg-indigoAcc border-indigoAcc' : 'bg-white/5 border-[#E5E7EB] active:bg-[#F3F4F6]'}`}
          >
            <Text className={`text-[10px] font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-[#6366F1]'}`}>
              {isDarkMode ? 'Switch to Light' : 'Switch to Dark'}
            </Text>
          </TouchableOpacity>
        </View>



        {/* CUSTOM CATEGORIES CONFIG */}
        <Text className="text-indigoAcc-light text-[10px] font-extrabold uppercase tracking-widest ml-1 mb-2.5">
          Category Settings
        </Text>

        <View className={`${theme.card} border ${theme.border} rounded-[24px] p-5 mb-5 shadow-sm`}>
          <View className="flex-row items-center mb-3">
            <View className="bg-indigoAcc/10 p-2.5 rounded-xl mr-3">
              <Icons.FolderEdit size={16} color="#6366F1" />
            </View>
            <View className="flex-1">
              <Text className={`${theme.text} text-sm font-bold`}>Manage Categories</Text>
              <Text className={`text-[10px] ${theme.subtext} mt-0.5`}>Add or delete transaction categories</Text>
            </View>
          </View>

          <Text className={`${theme.subtext} text-xs leading-5 mb-4`}>
            Customize the default expense and income categories.
          </Text>

          {/* INLINE CATEGORY ADD SUB-FORM */}
          <View className={`${theme.inputBg} rounded-2xl p-4 mb-4 border ${theme.border}`}>
            <Text className={`${theme.text} text-xs font-extrabold mb-3`}>Add Custom Category</Text>

            <TextInput
              value={newCatName}
              onChangeText={setNewCatName}
              placeholder="Category Name (e.g. Health)"
              placeholderTextColor={theme.isDark ? '#4B5563' : '#9CA3AF'}
              className={`${theme.card} border ${theme.border} rounded-xl px-3 py-2 ${theme.text} text-xs font-medium mb-3`}
            />

            <View className={`${theme.card} border ${theme.border} p-1 rounded-xl mb-3 flex-row`}>
              {(['expense', 'income'] as const).map(type => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setNewCatType(type)}
                  className={`flex-1 py-2 items-center rounded-lg ${newCatType === type ? 'bg-indigoAcc' : ''
                    }`}
                >
                  <Text className={`text-[10px] uppercase font-bold tracking-wider ${newCatType === type ? 'text-white' : theme.subtext
                    }`}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View className="flex-row justify-between items-center mb-2.5">
              <Text className={`${theme.subtext} text-[9px] font-bold uppercase tracking-wider`}>Select Icon</Text>
              <TouchableOpacity onPress={handlePickImage} className="bg-indigoAcc/10 border border-indigoAcc/30 px-2.5 py-1.5 rounded-lg active:bg-indigoAcc/20 flex-row items-center">
                <Icons.Upload size={11} color="#6366F1" />
                <Text className="text-indigoAcc text-[10px] font-bold ml-1">Upload from Gallery</Text>
              </TouchableOpacity>
            </View>
            
            <View className="flex-row flex-wrap items-center mb-4">
              {(newCatIcon.startsWith('uri:') || newCatIcon.startsWith('data:')) && (
                <View style={{ borderColor: '#6366F1', borderWidth: 1.5 }} className="p-1 bg-indigoAcc/10 rounded-xl m-1 relative justify-center items-center h-[38px] w-[38px]">
                  <Image source={{ uri: newCatIcon.startsWith('uri:') ? newCatIcon.replace('uri:', '') : newCatIcon }} style={{ width: 26, height: 26, borderRadius: 6 }} />
                  <TouchableOpacity 
                    onPress={() => setNewCatIcon('ShoppingBag')} 
                    className="absolute -top-1.5 -right-1.5 bg-coral rounded-full p-0.5"
                  >
                    <Icons.X size={10} color="#FFF" />
                  </TouchableOpacity>
                </View>
              )}
              {CATEGORY_ICONS.map(iconName => {
                const IconComp = (Icons as any)[iconName] || Icons.HelpCircle;
                const isSelected = newCatIcon === iconName;
                return (
                  <TouchableOpacity
                    key={iconName}
                    onPress={() => setNewCatIcon(iconName)}
                    style={{ borderColor: isSelected ? '#6366F1' : 'transparent', borderWidth: 1.5 }}
                    className={`p-2.5 bg-white/5 rounded-xl m-1 ${isSelected ? 'bg-indigoAcc/15' : ''}`}
                  >
                    <IconComp size={16} color={isSelected ? '#6366F1' : theme.isDark ? '#E5E7EB' : '#4B5563'} />
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text className={`${theme.subtext} text-[9px] font-bold uppercase tracking-wider mb-2`}>Select Color</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-4">
              {CATEGORY_COLORS.map(colorObj => {
                const isSelected = newCatColor === colorObj.value;
                return (
                  <TouchableOpacity
                    key={colorObj.value}
                    onPress={() => setNewCatColor(colorObj.value)}
                    style={{
                      backgroundColor: colorObj.value,
                      borderColor: isSelected ? (theme.isDark ? '#FFFFFF' : '#000000') : 'transparent',
                      borderWidth: isSelected ? 2 : 0
                    }}
                    className="w-6 h-6 rounded-full mr-3 items-center justify-center"
                  />
                );
              })}
            </ScrollView>

            <TouchableOpacity
              onPress={handleAddCategory}
              className="bg-mint py-3.5 rounded-xl items-center active:scale-98"
            >
              <Text className="text-white text-xs font-extrabold uppercase tracking-wide">Create Category</Text>
            </TouchableOpacity>
          </View>

          {/* COLLAPSIBLE CATEGORIES LIST */}
          <TouchableOpacity
            onPress={() => setCategoriesExpanded(!categoriesExpanded)}
            className={`flex-row justify-between items-center py-3 px-4 ${theme.inputBg} rounded-xl border ${theme.border}`}
          >
            <Text className={`${theme.text} text-xs font-bold`}>
              {categoriesExpanded ? 'Hide Existing Categories' : `View / Delete Categories (${categories.length})`}
            </Text>
            <Text className="text-indigoAcc font-bold text-xs">
              {categoriesExpanded ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>

          {categoriesExpanded && (
            <View className="mt-3">
              {categories.map(item => {
                const CatIcon = (Icons as any)[item.icon] || Icons.HelpCircle;
                return (
                  <View key={item.id} className={`flex-col ${theme.inputBg} border ${theme.border} rounded-xl p-3.5 mb-2`}>
                    <TouchableOpacity 
                      className="flex-row justify-between items-center"
                      onPress={() => {
                        setExpandedCategoryForSub(expandedCategoryForSub === item.id ? null : item.id);
                        setNewSubName('');
                      }}
                    >
                      <View className="flex-row items-center">
                        <View style={{ backgroundColor: item.color + '15', overflow: 'hidden' }} className="p-2 rounded-xl mr-3">
                          {(item.icon.startsWith('uri:') || item.icon.startsWith('data:')) ? (
                            <Image source={{ uri: item.icon.startsWith('uri:') ? item.icon.replace('uri:', '') : item.icon }} style={{ width: 14, height: 14 }} />
                          ) : (
                            <CatIcon size={14} color={item.color} />
                          )}
                        </View>
                        <View>
                          <Text className={`${theme.text} text-xs font-bold`}>{item.name}</Text>
                          <Text className={`text-[9px] ${theme.subtext} uppercase tracking-wider mt-0.5`}>{item.type}</Text>
                        </View>
                      </View>
                      <View className="flex-row items-center space-x-2">
                        <Text className="text-indigoAcc font-bold text-[10px]">
                          {expandedCategoryForSub === item.id ? 'Hide Subs' : 'Subcategories'}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleStartEditCategory(item)}
                          className="p-2 bg-indigoAcc/10 rounded-xl border border-indigoAcc/20 active:bg-indigoAcc/20 ml-1"
                        >
                          <Icons.Pencil size={12} color="#6366F1" strokeWidth={1.5} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteCategory(item.id, item.name)}
                          className="p-2 bg-coral-dim rounded-xl border border-coral/5 active:bg-coral/20 ml-1"
                        >
                          <Icons.Trash2 size={12} color="#EF4444" strokeWidth={1.5} />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>

                    {expandedCategoryForSub === item.id && (
                      <View className="mt-3 pt-3 border-t border-white/5">
                        {subcategories.filter(sub => sub.categoryId === item.id).map(sub => (
                          <View key={sub.id} className="flex-row justify-between items-center bg-white/5 rounded-lg p-2.5 mb-1.5">
                            {editingSubId === sub.id ? (
                              <View className="flex-row flex-1 items-center">
                                <TextInput
                                  value={editSubName}
                                  onChangeText={setEditSubName}
                                  autoFocus
                                  className={`${theme.text} text-[10px] font-semibold flex-1 px-2 py-1 ${theme.card} border ${theme.border} rounded-lg mr-2`}
                                  onSubmitEditing={() => handleSaveEditSub(sub.id)}
                                />
                                <TouchableOpacity onPress={() => handleSaveEditSub(sub.id)} className="p-1 mr-1">
                                  <Icons.Check size={12} color="#10B981" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setEditingSubId(null)} className="p-1">
                                  <Icons.X size={12} color="#6B7280" />
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <>
                                <Text className={`${theme.text} text-[10px] font-semibold ml-1 flex-1`}>{sub.name}</Text>
                                <View className="flex-row items-center">
                                  <TouchableOpacity onPress={() => handleStartEditSub(sub)} className="p-1 mr-1">
                                    <Icons.Pencil size={10} color="#6366F1" />
                                  </TouchableOpacity>
                                  <TouchableOpacity onPress={() => handleDeleteSubcategory(sub.id, sub.name)} className="p-1">
                                    <Icons.X size={12} color="#EF4444" />
                                  </TouchableOpacity>
                                </View>
                              </>
                            )}
                          </View>
                        ))}
                        
                        <View className="flex-row mt-2">
                          <TextInput
                            value={newSubName}
                            onChangeText={setNewSubName}
                            placeholder="New Subcategory..."
                            placeholderTextColor={theme.isDark ? '#4B5563' : '#9CA3AF'}
                            className={`${theme.card} border ${theme.border} rounded-lg px-3 py-1.5 ${theme.text} text-[10px] font-medium flex-1`}
                          />
                          <TouchableOpacity 
                            onPress={() => handleAddSubcategory(item.id)}
                            className="bg-indigoAcc rounded-lg px-3 py-1.5 ml-2 justify-center"
                          >
                            <Text className="text-white text-[10px] font-bold">Add</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* BACKUP & RESTORE SECTION */}
        <Text className="text-indigoAcc-light text-[10px] font-extrabold uppercase tracking-widest ml-1 mb-2.5">
          Backup & Restore
        </Text>

        <View className={`${theme.card} border ${theme.border} rounded-[24px] p-5 mb-5 shadow-sm`}>
          <View className="flex-row items-center mb-3">
            <View className="bg-indigoAcc/10 p-2.5 rounded-xl mr-3">
              <Icons.Clock size={16} color="#6366F1" />
            </View>
            <View className="flex-1">
              <Text className={`${theme.text} text-sm font-bold`}>Daily Automatic Backup</Text>
              <Text className={`text-[10px] ${theme.subtext} mt-0.5`}>Automatically saves your data every night</Text>
            </View>
          </View>
          <Text className={`${theme.subtext} text-xs leading-5 mb-4`}>
            {autoBackupEnabled 
              ? `Automatic daily backup is ON. A fresh copy of your data is automatically saved to your chosen phone folder each day after 8 PM.` 
              : `Turn on automatic backups to safely keep a daily copy of your financial records in your phone folder without needing to export manually.`}
          </Text>
          <TouchableOpacity
            onPress={handleToggleAutoBackup}
            className={`w-full py-3.5 rounded-xl items-center active:scale-98 ${autoBackupEnabled ? 'bg-coral-dim border border-coral/20' : 'bg-indigoAcc'}`}
          >
            <Text className={`text-xs font-extrabold ${autoBackupEnabled ? 'text-coral' : 'text-white'}`}>
              {autoBackupEnabled ? 'Disable Auto Backup' : 'Enable Auto Backup'}
            </Text>
          </TouchableOpacity>
        </View>

        <View className={`${theme.card} border ${theme.border} rounded-[24px] p-5 mb-5 shadow-sm`}>
          <View className="flex-row items-center mb-3">
            <View className="bg-indigoAcc/10 p-2.5 rounded-xl mr-3">
              <Icons.UploadCloud size={16} color="#6366F1" />
            </View>
            <View className="flex-1">
              <Text className={`${theme.text} text-sm font-bold`}>Save Backup to Phone</Text>
              <Text className={`text-[10px] ${theme.subtext} mt-0.5`}>Export a copy of all your financial records</Text>
            </View>
          </View>
          <Text className={`${theme.subtext} text-xs leading-5 mb-4`}>
            Save a backup file containing all your transactions, accounts, budgets, and subscriptions to your phone storage or share it to keep your records safe.
          </Text>
          <TouchableOpacity
            onPress={handleExport}
            className="w-full py-3.5 bg-indigoAcc rounded-xl items-center active:scale-98"
          >
            <Text className="text-white text-xs font-extrabold">Export Backup File</Text>
          </TouchableOpacity>
        </View>

        <View className={`${theme.card} border ${theme.border} rounded-[24px] p-5 mb-5 shadow-sm`}>
          <View className="flex-row items-center mb-3">
            <View className="bg-mint/10 p-2.5 rounded-xl mr-3">
              <Icons.DownloadCloud size={16} color="#10B981" />
            </View>
            <View className="flex-1">
              <Text className={`${theme.text} text-sm font-bold`}>Restore from Backup</Text>
              <Text className={`text-[10px] ${theme.subtext} mt-0.5`}>Recover your previously saved data</Text>
            </View>
          </View>
          <Text className={`${theme.subtext} text-xs leading-5 mb-4`}>
            Select a backup file from your phone storage to restore all your previous transactions, budgets, and account records.
          </Text>
          <TouchableOpacity
            onPress={handleImport}
            className="w-full py-3.5 bg-mint rounded-xl items-center active:scale-98"
          >
            <Text className="text-white text-xs font-extrabold">Choose Backup File</Text>
          </TouchableOpacity>
        </View>

        {/* DANGER ZONE / WIPE DATABASE */}
        <Text className="text-coral text-[10px] font-extrabold uppercase tracking-widest ml-1 mb-2.5 mt-2">
          Danger Zone
        </Text>

        <View className="bg-coral-dim/10 border border-coral/10 rounded-[24px] p-5 mb-5">
          <View className="flex-row items-center mb-3">
            <View className="bg-coral-dim p-2.5 rounded-xl mr-3">
              <Icons.Trash2 size={16} color="#EF4444" />
            </View>
            <View className="flex-1">
              <Text className="text-coral text-sm font-bold">Reset All Data</Text>
              <Text className="text-[10px] text-coral/60 mt-0.5">Permanently delete everything and start fresh</Text>
            </View>
          </View>
          <Text className={`${theme.subtext} text-xs leading-5 mb-4`}>
            This will permanently erase all your transactions, budgets, and subscriptions, and reset your account balances to ₹0.00. Please export a backup first if you want to keep your data.
          </Text>
          <TouchableOpacity
            onPress={handleClear}
            className="w-full py-3.5 bg-coral/15 border border-coral/30 rounded-xl items-center active:bg-coral/25"
          >
            <Text className="text-coral text-xs font-extrabold">Delete All & Reset App</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* EDIT CATEGORY MODAL */}
      <Modal visible={!!editingCategory} transparent={true} animationType="fade" onRequestClose={() => setEditingCategory(null)}>
        <View className="flex-1 justify-center items-center bg-black/80 px-5">
          <Animated.View style={{ marginBottom: animatedKeyboardHeight }} className={`${theme.card} border ${theme.border} rounded-[28px] p-6 w-full shadow-2xl`}>
            <View className="flex-row justify-between items-center mb-4">
              <Text className={`${theme.text} text-lg font-bold`}>Edit Category</Text>
              <TouchableOpacity onPress={() => setEditingCategory(null)} className="p-1">
                <Icons.X size={18} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <TextInput
              value={editCatName}
              onChangeText={setEditCatName}
              placeholder="Category Name"
              placeholderTextColor={theme.isDark ? '#4B5563' : '#9CA3AF'}
              className={`${theme.inputBg} border ${theme.border} rounded-xl px-3 py-2.5 ${theme.text} text-xs font-medium mb-4`}
            />

            <View className="flex-row justify-between items-center mb-2">
              <Text className={`${theme.subtext} text-[9px] font-bold uppercase tracking-wider`}>Select Icon</Text>
              <TouchableOpacity onPress={handleEditPickImage} className="bg-indigoAcc/10 border border-indigoAcc/30 px-2.5 py-1.5 rounded-lg flex-row items-center">
                <Icons.Upload size={11} color="#6366F1" />
                <Text className="text-indigoAcc text-[10px] font-bold ml-1">Upload</Text>
              </TouchableOpacity>
            </View>

            <View className="flex-row flex-wrap items-center mb-4">
              {(editCatIcon.startsWith('uri:') || editCatIcon.startsWith('data:')) && (
                <View style={{ borderColor: '#6366F1', borderWidth: 1.5 }} className="p-1 bg-indigoAcc/10 rounded-xl m-1 relative justify-center items-center h-[38px] w-[38px]">
                  <Image source={{ uri: editCatIcon.startsWith('uri:') ? editCatIcon.replace('uri:', '') : editCatIcon }} style={{ width: 26, height: 26, borderRadius: 6 }} />
                  <TouchableOpacity onPress={() => setEditCatIcon('ShoppingBag')} className="absolute -top-1.5 -right-1.5 bg-coral rounded-full p-0.5">
                    <Icons.X size={10} color="#FFF" />
                  </TouchableOpacity>
                </View>
              )}
              {CATEGORY_ICONS.map(iconName => {
                const IconComp = (Icons as any)[iconName] || Icons.HelpCircle;
                const isSelected = editCatIcon === iconName;
                return (
                  <TouchableOpacity
                    key={iconName}
                    onPress={() => setEditCatIcon(iconName)}
                    style={{ borderColor: isSelected ? '#6366F1' : 'transparent', borderWidth: 1.5 }}
                    className={`p-2.5 bg-white/5 rounded-xl m-1 ${isSelected ? 'bg-indigoAcc/15' : ''}`}
                  >
                    <IconComp size={16} color={isSelected ? '#6366F1' : theme.isDark ? '#E5E7EB' : '#4B5563'} />
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text className={`${theme.subtext} text-[9px] font-bold uppercase tracking-wider mb-2`}>Select Color</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-5">
              {CATEGORY_COLORS.map(colorObj => {
                const isSelected = editCatColor === colorObj.value;
                return (
                  <TouchableOpacity
                    key={colorObj.value}
                    onPress={() => setEditCatColor(colorObj.value)}
                    style={{
                      backgroundColor: colorObj.value,
                      borderColor: isSelected ? (theme.isDark ? '#FFFFFF' : '#000000') : 'transparent',
                      borderWidth: isSelected ? 2 : 0
                    }}
                    className="w-6 h-6 rounded-full mr-3 items-center justify-center"
                  />
                );
              })}
            </ScrollView>

            <View className="flex-row justify-between space-x-3">
              <TouchableOpacity
                onPress={() => setEditingCategory(null)}
                className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl items-center"
              >
                <Text className={`${theme.text} text-xs font-bold`}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveEditCategory}
                className="flex-1 py-3 bg-indigoAcc rounded-xl items-center active:scale-98"
              >
                <Text className="text-white text-xs font-extrabold">Save Changes</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* CUSTOM ALERT COMPONENT */}
      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        confirmText={alertConfig.confirmText}
        cancelText={alertConfig.cancelText}
        onConfirm={alertConfig.onConfirm}
        onCancel={alertConfig.onCancel}
      />
    </View>
  );
};
