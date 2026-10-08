import React from 'react';
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

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
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
    </NavigationContainer>
  );
}
