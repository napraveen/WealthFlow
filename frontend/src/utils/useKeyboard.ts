import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, Dimensions, Animated, KeyboardEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useKeyboard() {
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const animatedKeyboardHeight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: KeyboardEvent) => {
      const height = e.endCoordinates ? e.endCoordinates.height : 0;
      setKeyboardHeight(height);
      setIsKeyboardVisible(true);
      Animated.timing(animatedKeyboardHeight, {
        toValue: height,
        duration: Platform.OS === 'ios' ? (e.duration || 250) : 180,
        useNativeDriver: false,
      }).start();
    };

    const onHide = (e: KeyboardEvent) => {
      setKeyboardHeight(0);
      setIsKeyboardVisible(false);
      Animated.timing(animatedKeyboardHeight, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? (e.duration || 250) : 180,
        useNativeDriver: false,
      }).start();
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [animatedKeyboardHeight]);

  const windowHeight = Dimensions.get('window').height;
  // Calculate maximum height allowed for a bottom sheet modal so it never clips off-screen when keyboard is visible
  const maxModalHeight = Math.max(280, windowHeight - keyboardHeight - (insets.top || 20) - 24);

  return {
    keyboardHeight,
    isKeyboardVisible,
    animatedKeyboardHeight,
    maxModalHeight,
  };
}
