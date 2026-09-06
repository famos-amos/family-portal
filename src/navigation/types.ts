export type RootStackParamList = {
  Home: undefined;
  Calendar:
    | {
        /** Which sub-view to open on. */
        view?: 'day' | 'week' | 'month';
        /** ISO date (YYYY-MM-DD) to focus the cursor on. */
        date?: string;
        /** Bump to force a re-sync when navigating to an already-mounted
         * Calendar screen with otherwise-identical params. */
        ts?: number;
      }
    | undefined;
  Chores: undefined;
  MealPlans: undefined;
  Boards: undefined;
  Settings: undefined;
  GroceryList: undefined;
  Recipes: undefined;
  Suggestions: undefined;
};

// Lets `useNavigation()` calls infer route names/params without passing a
// generic everywhere.
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
