import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';

type Lang = 'en' | 'hi';

interface Slide {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  en: { title: string; points: string[] };
  hi: { title: string; points: string[] };
}

const SLIDES: Slide[] = [
  {
    icon: 'restaurant',
    iconColor: '#F97316',
    en: {
      title: '👋 Welcome to RasoiGo!',
      points: [
        'RasoiGo is your all-in-one restaurant billing and management app.',
        'Manage tables, take orders, accept payments and track your business — all offline.',
        'No internet needed for day-to-day billing. Data stays safe on your device.',
        'Swipe through these slides to learn how everything works.',
      ],
    },
    hi: {
      title: '👋 RasoiGo में आपका स्वागत है!',
      points: [
        'RasoiGo आपका सम्पूर्ण रेस्टोरेंट बिलिंग और मैनेजमेंट ऐप है।',
        'टेबल मैनेज करें, ऑर्डर लें, पेमेंट स्वीकार करें — सब कुछ बिना इंटरनेट के।',
        'रोज़ की बिलिंग के लिए इंटरनेट की ज़रूरत नहीं। डेटा आपके डिवाइस पर सुरक्षित रहता है।',
        'ऐप कैसे इस्तेमाल करें — यह जानने के लिए आगे स्वाइप करें।',
      ],
    },
  },
  {
    icon: 'grid',
    iconColor: '#2563EB',
    en: {
      title: '🪑 Orders — Tables & P2P',
      points: [
        'Tap the Orders tab at the bottom to start a new order.',
        'Tables: Select a table → add items → settle the bill. Perfect for dine-in customers.',
        'P2P: For takeaway or walk-in customers. Enter their name and phone → add items → pay.',
        'Open P2P orders are saved automatically — resume them anytime from the Orders screen.',
        'Each table shows green (Available) or orange (Occupied) so you always know what\'s free.',
      ],
    },
    hi: {
      title: '🪑 ऑर्डर — टेबल और P2P',
      points: [
        'नया ऑर्डर शुरू करने के लिए नीचे Orders टैब पर टैप करें।',
        'Tables: टेबल चुनें → आइटम जोड़ें → बिल सेटल करें। डाइन-इन ग्राहकों के लिए।',
        'P2P: टेकअवे या वॉक-इन ग्राहकों के लिए। नाम और फोन डालें → आइटम जोड़ें → पेमेंट करें।',
        'Open P2P ऑर्डर अपने आप सेव होते हैं — Orders स्क्रीन से कभी भी resume करें।',
        'हर टेबल पर हरा (Available) या नारंगी (Occupied) रंग दिखता है।',
      ],
    },
  },
  {
    icon: 'fast-food',
    iconColor: '#10B981',
    en: {
      title: '🍽️ Menu & Adding Items',
      points: [
        'Go to the Menu tab to add, edit or remove dishes.',
        'Set a name, price and category for each dish (e.g. Starters, Main Course, Drinks).',
        'While on a table or P2P order, search for any dish and tap + to add it.',
        'Change quantities using the + / − buttons on the order screen.',
        'Dishes are untracked by default. Enable stock tracking only for packaged items like bottles.',
      ],
    },
    hi: {
      title: '🍽️ मेनू और आइटम जोड़ना',
      points: [
        'डिश जोड़ने, एडिट करने या हटाने के लिए Menu टैब पर जाएं।',
        'हर डिश का नाम, कीमत और कैटेगरी सेट करें (जैसे Starters, Main Course, Drinks)।',
        'टेबल या P2P ऑर्डर पर किसी भी डिश को सर्च करें और + टैप करके जोड़ें।',
        'ऑर्डर स्क्रीन पर + / − बटन से मात्रा बदलें।',
        'डिश डिफ़ॉल्ट रूप से untracked होती हैं। बोतल जैसे पैकेज्ड आइटम के लिए ही ट्रैकिंग चालू करें।',
      ],
    },
  },
  {
    icon: 'cash',
    iconColor: '#F59E0B',
    en: {
      title: '💰 Payments & Settlement',
      points: [
        'Once items are added, tap Settle & Pay to collect payment.',
        'Choose from: Cash, UPI, Card or Pay Later (Udhaar).',
        'Pay Later: Bill amount is added to the customer\'s Udhaar. Customer is auto-created in Customers & Udhaar.',
        'Apply a discount (in ₹) before settling.',
        'GST and Service Charge (configured in Settings) are automatically added.',
        'After payment, share the invoice via WhatsApp or download it.',
      ],
    },
    hi: {
      title: '💰 पेमेंट और सेटलमेंट',
      points: [
        'आइटम जोड़ने के बाद Settle & Pay टैप करें।',
        'पेमेंट का तरीका चुनें: Cash, UPI, Card या Pay Later (उधार)।',
        'Pay Later: बिल की राशि ग्राहक के उधार में जुड़ जाती है। ग्राहक अपने आप Customers & Udhaar में बन जाता है।',
        'सेटल करने से पहले ₹ में डिस्काउंट लगा सकते हैं।',
        'GST और Service Charge (Settings में कॉन्फ़िगर होने पर) अपने आप जुड़ते हैं।',
        'पेमेंट के बाद WhatsApp से इनवॉइस शेयर करें या डाउनलोड करें।',
      ],
    },
  },
  {
    icon: 'people',
    iconColor: '#8B5CF6',
    en: {
      title: '👥 Customers & Udhaar',
      points: [
        'View all customers and their outstanding dues in the Customers & Udhaar section.',
        'When a P2P order is paid with Pay Later, the customer is automatically added here.',
        'Tap a customer to see their full ledger — all credit sales and payments.',
        'Record a payment when a customer clears their due — balance reduces automatically.',
        'Send a WhatsApp reminder to customers with pending dues directly from the app.',
      ],
    },
    hi: {
      title: '👥 ग्राहक और उधार',
      points: [
        'सभी ग्राहक और उनका बकाया Customers & Udhaar में देखें।',
        'जब P2P ऑर्डर Pay Later से settle होता है तो ग्राहक अपने आप यहाँ जुड़ जाता है।',
        'ग्राहक पर टैप करें — सभी उधार और पेमेंट का पूरा हिसाब देखें।',
        'ग्राहक पेमेंट करे तो Record Payment टैप करें — बैलेंस अपने आप कम होगा।',
        'बकाया ग्राहकों को WhatsApp रिमाइंडर सीधे ऐप से भेजें।',
      ],
    },
  },
  {
    icon: 'layers',
    iconColor: '#06B6D4',
    en: {
      title: '📦 Stock Management',
      points: [
        'Go to the Stock tab to see all items with tracked inventory.',
        'Items with stock below 5 are flagged as Low Stock on the Home screen.',
        'Use Stock-In to record new stock received from suppliers.',
        'Link stock-in to a supplier to track what you owe them (payables).',
        'Restaurant dishes are untracked by default — only enable tracking for bottles, packaged goods, etc.',
      ],
    },
    hi: {
      title: '📦 स्टॉक मैनेजमेंट',
      points: [
        'Stock टैब पर जाएं और tracked inventory वाले सभी आइटम देखें।',
        'जिन आइटम का स्टॉक 5 से कम हो, वे Home स्क्रीन पर Low Stock में दिखते हैं।',
        'नया स्टॉक मिलने पर Stock-In करें।',
        'Stock-In को सप्लायर से लिंक करें ताकि उनका हिसाब रहे।',
        'रेस्टोरेंट डिश डिफ़ॉल्ट रूप से untracked हैं — बोतल जैसे आइटम के लिए ही ट्रैकिंग चालू करें।',
      ],
    },
  },
  {
    icon: 'stats-chart',
    iconColor: '#EF4444',
    en: {
      title: '📊 Reports, Shifts & Settings',
      points: [
        'Reports tab (owner only): See Profit & Loss, Sales Trend, Best Sellers and Dead Stock.',
        'Filter by Today, 7 Days, 30 Days, 90 Days or any custom number of days.',
        'Shifts: Open at start of day, close at end. Get a Z-report with cash summary.',
        'Settings: Configure store name, GST rate, service charge, staff PINs and permissions.',
        'Staff access can be limited — restrict employees from editing bills or viewing reports.',
      ],
    },
    hi: {
      title: '📊 रिपोर्ट, शिफ्ट और सेटिंग्स',
      points: [
        'Reports टैब (सिर्फ Owner): Profit & Loss, Sales Trend, Best Sellers और Dead Stock देखें।',
        'Today, 7 Days, 30 Days, 90 Days या कोई भी कस्टम दिन डालकर फ़िल्टर करें।',
        'Shifts: दिन की शुरुआत में shift खोलें, अंत में बंद करें। Z-report मिलेगा।',
        'Settings: स्टोर का नाम, GST, सर्विस चार्ज, स्टाफ PIN और परमिशन सेट करें।',
        'Staff की एक्सेस सीमित हो सकती है — employees को बिल एडिट या रिपोर्ट से restrict करें।',
      ],
    },
  },
];

interface Props {
  onDone: () => void;
}

export default function OnboardingScreen({ onDone }: Props) {
  const { colors } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lang, setLang] = useState<Lang>('en');

  const isLast = currentIndex === SLIDES.length - 1;
  const slide = SLIDES[currentIndex];
  const content = slide[lang];

  const goNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onDone();
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>

      {/* Top bar: slide count + language toggle */}
      <View style={styles.topBar}>
        <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>
          {currentIndex + 1} / {SLIDES.length}
        </Text>
        <View style={[styles.langToggle, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => setLang('en')}
            style={[styles.langBtn, { backgroundColor: lang === 'en' ? colors.primary : 'transparent' }]}
          >
            <Text style={{ color: lang === 'en' ? '#FFF' : colors.text, fontWeight: '700', fontSize: 13 }}>
              EN
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setLang('hi')}
            style={[styles.langBtn, { backgroundColor: lang === 'hi' ? colors.primary : 'transparent' }]}
          >
            <Text style={{ color: lang === 'hi' ? '#FFF' : colors.text, fontWeight: '700', fontSize: 13 }}>
              हि
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Slide content */}
      <ScrollView
        contentContainerStyle={styles.slide}
        showsVerticalScrollIndicator={false}
      >
        {/* Icon */}
        <View style={[styles.iconCircle, { backgroundColor: slide.iconColor + '22' }]}>
          <Ionicons name={slide.icon} size={52} color={slide.iconColor} />
        </View>

        {/* Title */}
        <Text style={[styles.slideTitle, { color: colors.text }]}>
          {content.title}
        </Text>

        {/* Points */}
        <View style={styles.pointsList}>
          {content.points.map((point, i) => (
            <View key={i} style={styles.pointRow}>
              <View style={[styles.bullet, { backgroundColor: slide.iconColor }]} />
              <Text style={[styles.pointText, { color: colors.text }]}>
                {point}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Dot indicators */}
      <View style={styles.dotsRow}>
        {SLIDES.map((_, i) => (
          <TouchableOpacity key={i} onPress={() => setCurrentIndex(i)}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: i === currentIndex ? colors.primary : colors.border,
                  width: i === currentIndex ? 20 : 8,
                },
              ]}
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* Navigation */}
      <View style={[styles.navRow, { borderTopColor: colors.border }]}>
        {currentIndex > 0 ? (
          <TouchableOpacity
            onPress={goPrev}
            style={[styles.navBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
          >
            <Ionicons name="arrow-back" size={18} color={colors.text} />
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              {lang === 'en' ? 'Back' : 'पीछे'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        <TouchableOpacity
          onPress={goNext}
          style={[styles.navBtn, styles.nextBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>
            {isLast
              ? lang === 'en' ? "Let's Go! 🚀" : 'शुरू करें! 🚀'
              : lang === 'en' ? 'Next' : 'आगे'}
          </Text>
          {!isLast && <Ionicons name="arrow-forward" size={18} color="#FFF" />}
        </TouchableOpacity>
      </View>

      {/* Skip */}
      {!isLast && (
        <TouchableOpacity onPress={onDone} style={styles.skipBtn}>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>
            {lang === 'en' ? 'Skip guide' : 'गाइड छोड़ें'}
          </Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  langToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  langBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  slide: {
    padding: 24,
    paddingBottom: 20,
    alignItems: 'center',
  },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    marginTop: 10,
  },
  slideTitle: {
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 30,
  },
  pointsList: { width: '100%', gap: 14 },
  pointRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  bullet: { width: 8, height: 8, borderRadius: 4, marginTop: 7, flexShrink: 0 },
  pointText: { flex: 1, fontSize: 14, lineHeight: 22 },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  dot: { height: 8, borderRadius: 4 },
  navRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  nextBtn: { borderWidth: 0 },
  skipBtn: { alignItems: 'center', paddingBottom: 14 },
});