import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Icons from 'lucide-react-native';

interface DeleteConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  itemCount?: number;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  visible,
  onClose,
  onConfirm,
  title = "Confirm Deletion",
  message = "Are you sure you want to permanently delete this item? This action will reverse all associated account balances.",
  itemCount = 1
}) => {
  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-center items-center bg-black/85 px-6">
        <View 
          style={styles.modalCard}
          className="bg-obsidian-card border border-coral/30 rounded-[32px] p-6 w-full max-w-[340px]"
        >
          {/* Warning Icon Banner */}
          <View className="items-center mb-5 mt-2">
            <View className="p-4 bg-coral/10 rounded-full justify-center items-center border border-coral/20">
              <Icons.AlertTriangle size={32} color="#EF4444" strokeWidth={1.5} />
            </View>
          </View>

          {/* Heading */}
          <Text className="text-white text-center text-xl font-bold tracking-tight mb-2">
            {title}
          </Text>

          {/* Subtitle */}
          <Text className="text-mutedText text-center text-xs leading-relaxed mb-6 px-2">
            {itemCount > 1 
              ? `You have selected ${itemCount} transactions for batch deletion. This will permanently delete these items and update all account totals.`
              : message}
          </Text>

          {/* Action Buttons */}
          <View className="flex-row justify-between space-x-3 mt-2">
            <TouchableOpacity 
              onPress={onClose}
              className="flex-1 py-3.5 bg-white/5 border border-white/10 rounded-2xl items-center active:bg-white/10"
            >
              <Text className="text-white text-xs font-bold">Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => {
                onConfirm();
                onClose();
              }}
              className="flex-1 py-3.5 bg-coral rounded-2xl items-center active:scale-95 shadow-md shadow-coral/20"
            >
              <Text className="text-white text-xs font-extrabold">Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.5,
    shadowRadius: 25,
    elevation: 12,
  }
});
