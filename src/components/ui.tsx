import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
  ActivityIndicator,
  TextInput,
  TextInputProps,
  Platform,
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';

// ─── Card ────────────────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, style, onPress }) => {
  const { colors } = useTheme();

  const cardStyle = [
    styles.card,
    {
      backgroundColor: colors.card,
      borderColor: colors.border,
      ...Platform.select({
        web: {
          boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
        },
        default: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
          elevation: 2,
        },
      }),
    },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.92} onPress={onPress} style={cardStyle}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
};

// ─── Button ──────────────────────────────────────────────────────────────────

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'success' | 'danger' | 'outline' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
  icon,
  size = 'md',
}) => {
  const { colors } = useTheme();

  const bg =
    variant === 'success' ? colors.success
    : variant === 'danger' ? colors.danger
    : variant === 'outline' || variant === 'ghost' ? 'transparent'
    : colors.primary;

  const fg =
    variant === 'outline' || variant === 'ghost' ? colors.primary : '#FFFFFF';

  const paddingV = size === 'sm' ? 9 : size === 'lg' ? 17 : 13;
  const fontSize = size === 'sm' ? 13 : size === 'lg' ? 17 : 15;

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        {
          backgroundColor: bg,
          borderColor: variant === 'outline' ? colors.primary : 'transparent',
          borderWidth: variant === 'outline' ? 1.5 : 0,
          opacity: disabled ? 0.45 : 1,
          paddingVertical: paddingV,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          {icon}
          <Text style={[styles.buttonText, { color: fg, fontSize }]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// ─── Field ───────────────────────────────────────────────────────────────────

interface FieldProps extends TextInputProps {
  label?: string;
  containerStyle?: ViewStyle;
  hint?: string;
}

export const Field: React.FC<FieldProps> = ({ label, containerStyle, style, hint, ...rest }) => {
  
  const { colors } = useTheme();
  return (
    <View style={[{ marginBottom: 16 }, containerStyle]}>
      {label ? (
        <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          {
            backgroundColor: colors.card,
            color: colors.text,
            borderColor: colors.border,
          },
          style as TextStyle,
        ]}
        {...rest}
      />
      {hint ? (
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>{hint}</Text>
      ) : null}
    </View>
  );
};

// ─── EmptyState ───────────────────────────────────────────────────────────────

export const EmptyState: React.FC<{
  icon?: string;
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}> = ({ icon = '📭', title, subtitle, action }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIconCircle, { backgroundColor: colors.border + '55' }]}>
        <Text style={{ fontSize: 38 }}>{icon}</Text>
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.emptySub, { color: colors.textMuted }]}>{subtitle}</Text>
      ) : null}
      {action ? (
        <TouchableOpacity
          onPress={action.onPress}
          style={[styles.emptyAction, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}
        >
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>
            {action.label}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

// ─── Badge ────────────────────────────────────────────────────────────────────

export const Badge: React.FC<{
  label: string;
  color?: string;
  bg?: string;
  size?: 'sm' | 'md';
}> = ({ label, color = '#FFFFFF', bg = '#2563EB', size = 'md' }) => (
  <View
    style={[
      styles.badge,
      {
        backgroundColor: bg,
        paddingHorizontal: size === 'sm' ? 7 : 10,
        paddingVertical: size === 'sm' ? 2 : 4,
      },
    ]}
  >
    <Text style={{ color, fontSize: size === 'sm' ? 10 : 12, fontWeight: '700' }}>
      {label}
    </Text>
  </View>
);

// ─── SectionHeader ────────────────────────────────────────────────────────────

export const SectionHeader: React.FC<{
  title: string;
  action?: { label: string; onPress: () => void };
}> = ({ title, action }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {action ? (
        <TouchableOpacity onPress={action.onPress}>
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>
            {action.label}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

// ─── Divider ──────────────────────────────────────────────────────────────────

export const Divider: React.FC<{ style?: ViewStyle }> = ({ style }) => {
  const { colors } = useTheme();
  return (
    <View
      style={[{ height: 1, backgroundColor: colors.border, marginVertical: 12 }, style]}
    />
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  button: {
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  buttonText: { fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 7 },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 56, paddingHorizontal: 24 },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  emptySub: { fontSize: 14, marginTop: 6, textAlign: 'center', lineHeight: 20 },
  emptyAction: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  badge: { borderRadius: 20, alignSelf: 'flex-start' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
});