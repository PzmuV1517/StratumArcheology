import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';

/**
 * TabLayout - Main navigation tabs
 * Tab order: Overview (landing), Projects, Profile, Settings
 * Auth is handled by AuthRedirector at the root level
 * 
 * Uses iOS-style transitions with liquid glass aesthetic
 */
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#FF2A2A',
        tabBarInactiveTintColor: '#9A9A9A',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: Platform.OS === 'ios' ? 'rgba(26, 26, 26, 0.85)' : '#1A1A1A',
          borderTopColor: '#2A2A2A',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 60,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          // iOS liquid glass effect
          ...(Platform.OS === 'ios' && {
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.3,
          marginTop: 2,
        },
        // Smooth slide transition for tab content
        animation: 'shift',
      }}
    >
      {/* Overview - Landing tab */}
      <Tabs.Screen
        name="overview"
        options={{
          title: 'Overview',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="house.fill" color={color} />
          ),
        }}
      />
      
      {/* Projects - All projects list */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Projects',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="folder.fill" color={color} />
          ),
        }}
      />
      
      {/* Profile - User profile */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="person.fill" color={color} />
          ),
        }}
      />
      
      {/* Settings - App settings */}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="gearshape.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
