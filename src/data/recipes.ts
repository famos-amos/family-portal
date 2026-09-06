// Starter recipe library — a small curated set so Recipes and Suggestions
// have real content on first launch. Every recipe here can be sent straight
// to the meal planner from Recipes or Suggestions, and can be edited or
// deleted like any user-added recipe once the app is backed by Supabase.
import { Recipe } from '../store/types';

export const seedRecipes: Recipe[] = [
  {
    id: 'r1',
    name: 'Spaghetti & Meatballs',
    slot: 'dinner',
    time: '40 min',
    ingredients: [
      { amount: '1 lb', name: 'ground beef' },
      { amount: '', name: 'Spaghetti' },
      { amount: '', name: 'Marinara sauce' },
      { amount: '', name: 'Breadcrumbs' },
      { amount: '1', name: 'egg' },
      { amount: '', name: 'Parmesan' },
    ],
    steps: [
      'Mix ground beef, breadcrumbs, egg, and a handful of parmesan; roll into meatballs.',
      'Brown meatballs in a hot pan, then simmer in marinara sauce for 20 minutes.',
      'Boil spaghetti according to package directions.',
      'Serve meatballs and sauce over spaghetti, topped with extra parmesan.',
    ],
  },
  {
    id: 'r2',
    name: 'Sheet-Pan Fajitas',
    slot: 'dinner',
    time: '30 min',
    ingredients: [
      { amount: '', name: 'Chicken breast, sliced' },
      { amount: '', name: 'Bell peppers' },
      { amount: '', name: 'Onion' },
      { amount: '', name: 'Fajita seasoning' },
      { amount: '', name: 'Tortillas' },
    ],
    steps: [
      'Toss sliced chicken, peppers, and onion with fajita seasoning and oil.',
      'Spread on a sheet pan and roast at 425°F for 18-20 minutes.',
      'Warm tortillas and serve with the chicken and veggies, plus your favorite toppings.',
    ],
  },
  {
    id: 'r3',
    name: 'Veggie Fried Rice',
    slot: 'dinner',
    time: '20 min',
    ingredients: [
      { amount: '', name: 'Cooked rice (day-old is best)' },
      { amount: '', name: 'Frozen peas & carrots' },
      { amount: '2', name: 'eggs' },
      { amount: '', name: 'Soy sauce' },
      { amount: '', name: 'Green onion' },
    ],
    steps: [
      'Scramble eggs in a hot wok or pan, then set aside.',
      'Stir-fry peas and carrots for 2-3 minutes.',
      'Add rice, breaking up clumps, and stir-fry until heated through.',
      'Stir in soy sauce and eggs, top with sliced green onion.',
    ],
  },
  {
    id: 'r4',
    name: 'Overnight Oats',
    slot: 'breakfast',
    time: '5 min (+overnight)',
    ingredients: [
      { amount: '', name: 'Rolled oats' },
      { amount: '', name: 'Milk' },
      { amount: '', name: 'Yogurt' },
      { amount: '', name: 'Honey' },
      { amount: '', name: 'Fruit of choice' },
    ],
    steps: [
      'Combine oats, milk, yogurt, and honey in a jar.',
      'Refrigerate overnight.',
      'Top with fresh fruit before serving.',
    ],
  },
  {
    id: 'r5',
    name: 'Turkey Club Wraps',
    slot: 'lunch',
    time: '15 min',
    ingredients: [
      { amount: '', name: 'Tortillas' },
      { amount: '', name: 'Sliced turkey' },
      { amount: '', name: 'Bacon' },
      { amount: '', name: 'Lettuce' },
      { amount: '', name: 'Tomato' },
      { amount: '', name: 'Mayo' },
    ],
    steps: [
      'Lay out tortillas and spread with mayo.',
      'Layer turkey, bacon, lettuce, and tomato.',
      'Roll tightly and slice in half to serve.',
    ],
  },
  {
    id: 'r6',
    name: 'Homemade Pizza Night',
    slot: 'dinner',
    time: '35 min',
    ingredients: [
      { amount: '', name: 'Pizza dough' },
      { amount: '', name: 'Marinara sauce' },
      { amount: '', name: 'Mozzarella' },
      { amount: '', name: 'Toppings of choice' },
    ],
    steps: [
      'Stretch dough onto a floured pan or pizza stone.',
      'Spread sauce, then cheese and toppings.',
      'Bake at 475°F for 12-15 minutes, until the crust is golden.',
    ],
  },
];
