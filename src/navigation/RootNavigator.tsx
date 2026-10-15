import React, { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { HomeScreen } from '../screens/HomeScreen';
import { CalendarScreen } from '../screens/CalendarScreen';
import { ChoresScreen } from '../screens/ChoresScreen';
import { MealPlansScreen } from '../screens/MealPlansScreen';
import { BoardsScreen } from '../screens/BoardsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { GroceryListScreen } from '../screens/GroceryListScreen';
import { RecipesScreen } from '../screens/RecipesScreen';
import { SuggestionsScreen } from '../screens/SuggestionsScreen';
import { TabSwipeWrapper } from './TabSwipeWrapper';
import { Sidebar } from '../components/Sidebar';
import { BottomTabBar } from '../components/BottomTabBar';
import { NARROW_BREAKPOINT } from '../lib/layout';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { width } = useWindowDimensions();
  const isWide = width >= NARROW_BREAKPOINT;
  // Sidebar sits beside Stack.Navigator, not inside one of its screens, so
  // useRoute()/useNavigationState() don't work there (both need to be a
  // descendant of the Navigator itself, not just inside NavigationContainer
  // — confirmed the hard way: "Couldn't get the navigation state"). Track
  // the active route name here instead, via the one hook that does work at
  // this level, and pass it down as a prop.
  const [activeRouteName, setActiveRouteName] = useState<string | undefined>('Home');

  return (
    <NavigationContainer onStateChange={(state) => setActiveRouteName(state?.routes[state.index ?? 0]?.name)}>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {isWide && <Sidebar activeRouteName={activeRouteName} />}
        <View style={{ flex: 1, minWidth: 0, flexDirection: 'column' }}>
          <View style={{ flex: 1, minHeight: 0 }}>
            <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Home">
              {/* The 5 main tabs are wrapped in TabSwipeWrapper so a horizontal
                  swipe moves between them (looping) on the narrow/mobile layout —
                  see TabSwipeWrapper.tsx. It's a no-op on the wide/desktop layout. */}
              <Stack.Screen name="Home">{() => <TabSwipeWrapper><HomeScreen /></TabSwipeWrapper>}</Stack.Screen>
              <Stack.Screen name="Calendar">{() => <TabSwipeWrapper><CalendarScreen /></TabSwipeWrapper>}</Stack.Screen>
              <Stack.Screen name="Chores">{() => <TabSwipeWrapper><ChoresScreen /></TabSwipeWrapper>}</Stack.Screen>
              <Stack.Screen name="MealPlans">{() => <TabSwipeWrapper><MealPlansScreen /></TabSwipeWrapper>}</Stack.Screen>
              <Stack.Screen name="Boards">{() => <TabSwipeWrapper><BoardsScreen /></TabSwipeWrapper>}</Stack.Screen>
              <Stack.Screen name="Settings" component={SettingsScreen} />
              <Stack.Screen name="GroceryList" component={GroceryListScreen} />
              <Stack.Screen name="Recipes" component={RecipesScreen} />
              <Stack.Screen name="Suggestions" component={SuggestionsScreen} />
            </Stack.Navigator>
          </View>
          {/* Narrow/mobile layout's primary nav — see BottomTabBar.tsx. The
              wide layout's equivalent is Sidebar, rendered beside this column
              instead of inside it. */}
          {!isWide && <BottomTabBar activeRouteName={activeRouteName} />}
        </View>
      </View>
    </NavigationContainer>
  );
}
