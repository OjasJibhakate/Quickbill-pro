import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  TextInput,
  TextInputProps,
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';

export const Card: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({
  children,
  style,
}) => {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
};

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'success' | 'danger' | 'outline';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
}) => {
  const { colors } = useTheme();
  const bg =
    variant === 'success'
      ? colors.success
      : variant === 'danger'
      ? colors.danger
      : variant === 'outline'
      ? 'transparent'
      : colors.primary;
  const fg = variant === 'outline' ? colors.text : '#FFFFFF';

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        {
          backgroundColor: bg,
          borderColor: variant === 'outline' ? colors.border : 'transparent',
          borderWidth: variant === 'outline' ? 1 : 0,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

export const Field: React.FC<
  TextInputProps & { label?: string; containerStyle?: ViewStyle }
> = ({ label, containerStyle, style, ...rest }) => {
  const { colors } = useTheme();
  return (
    <View style={[{ marginBottom: 14 }, containerStyle]}>
      {label ? (
        <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          { backgroundColor: colors.card, color: colors.text, borderColor: colors.border },
          style as TextStyle,
        ]}
        {...rest}
      />
    </View>
  );
};

export const EmptyState: React.FC<{ icon?: string; title: string; subtitle?: string }> = ({
  icon = '📭',
  title,
  subtitle,
}) => {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <Text style={{ fontSize: 44, marginBottom: 8 }}>{icon}</Text>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.emptySub, { color: colors.textMuted }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptySub: { fontSize: 14, marginTop: 4, textAlign: 'center', paddingHorizontal: 24 },
});
