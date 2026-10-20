import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Icons from 'lucide-react-native';

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  type?: 'info' | 'confirm' | 'destructive';
  confirmText?: string;
  cancelText?: string;
  cancelOnRight?: boolean;
  cancelHighlight?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export const CustomAlert: React.FC<CustomAlertProps> = ({
  visible,
  title,
  message,
  type = 'info',
  confirmText = 'OK',
  cancelText = 'Cancel',
  cancelOnRight = false,
  cancelHighlight = false,
  onConfirm,
  onCancel,
}) => {
  let AlertIcon = Icons.AlertCircle;
  let iconColor = '#6366F1'; // Indigo
  let confirmBtnBg = 'bg-indigoAcc';

  if (type === 'destructive') {
    AlertIcon = Icons.AlertTriangle;
    iconColor = '#EF4444'; // Coral Red
    confirmBtnBg = 'bg-coral';
  } else if (type === 'confirm') {
    AlertIcon = Icons.HelpCircle;
    iconColor = '#10B981'; // Mint Green
    confirmBtnBg = 'bg-mint';
  }

  const renderCancelBtn = () => (
    <TouchableOpacity
      onPress={onCancel}
      className={`flex-1 py-3.5 rounded-xl items-center active:opacity-90 ${
        cancelHighlight
          ? 'bg-coral shadow-lg shadow-coral/30'
          : 'bg-white/5 border border-white/10 active:bg-white/10'
      }`}
    >
      <Text className={`text-xs ${cancelHighlight ? 'text-white font-extrabold' : 'text-white font-bold'}`}>
        {cancelText}
      </Text>
    </TouchableOpacity>
  );

  const renderConfirmBtn = (isNeutral: boolean = false) => (
    <TouchableOpacity
      onPress={onConfirm}
      className={`flex-1 py-3.5 rounded-xl items-center active:opacity-90 ${
        isNeutral ? 'bg-white/10 border border-white/15' : `${confirmBtnBg}`
      }`}
    >
      <Text className="text-white text-xs font-extrabold">{confirmText}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay} className="flex-1 justify-center items-center bg-black/80 px-6">
        <View className="bg-obsidian border border-obsidian-border rounded-[28px] p-6 w-full max-w-[340px] items-center shadow-2xl">
          {/* ICON */}
          <View style={{ backgroundColor: iconColor + '15' }} className="p-3.5 rounded-full mb-4">
            <AlertIcon size={24} color={iconColor} strokeWidth={2} />
          </View>

          {/* TITLE */}
          <Text className="text-white text-base font-extrabold text-center tracking-tight mb-2">
            {title}
          </Text>

          {/* MESSAGE */}
          <Text className="text-mutedText text-xs leading-5 text-center mb-6">
            {message}
          </Text>

          {/* BUTTONS */}
          <View className="flex-row w-full space-x-3">
            {type === 'info' ? (
              renderConfirmBtn(false)
            ) : cancelOnRight ? (
              <>
                {renderConfirmBtn(true)}
                {renderCancelBtn()}
              </>
            ) : (
              <>
                {renderCancelBtn()}
                {renderConfirmBtn(false)}
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
});
