import 'react-native';

// react-native-web expõe `hovered` no estado do Pressable (usado para hover no navegador).
declare module 'react-native' {
  interface PressableStateCallbackType {
    readonly hovered?: boolean;
  }
}
