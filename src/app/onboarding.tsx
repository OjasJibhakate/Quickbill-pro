import OnboardingScreen from '@/screens/OnboardingScreen';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = 'rasoi_onboarding_done';

export default function OnboardingRoute() {
  const router = useRouter();

  const handleDone = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    router.replace('/(tabs)');
  };

  return <OnboardingScreen onDone={handleDone} />;
}