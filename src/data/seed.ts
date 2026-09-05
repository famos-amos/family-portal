// Placeholder starter data so the app has something to show on first launch.
// Everything here is fully editable/removable from within the app (Settings,
// and each screen's own add/remove controls) — nothing is hardcoded at runtime.
import { BoardColumn, BoardItem, CalendarEvent, Chore, FamilyMember, Meal } from '../store/types';

export const seedFamily: FamilyMember[] = [
  { id: 'mom', name: 'Mom', color: '#D98CA6', initials: 'M', birthday: '1988-04-12' },
  { id: 'dad', name: 'Dad', color: '#7FA8D9', initials: 'D', birthday: '1986-11-03' },
  { id: 'milo', name: 'Milo', color: '#5FB8A8', initials: 'Mi', birthday: '2016-06-28' },
  { id: 'kaya', name: 'Kaya', color: '#E3A94C', initials: 'K', birthday: '2018-02-15' },
];

export const seedChores: Chore[] = [
  { id: 'c1', title: 'Sweep the porch', assigneeId: null, points: 2, done: false },
  { id: 'c2', title: 'Water the plants', assigneeId: null, points: 1, done: false },
  { id: 'c3', title: 'Take out trash', assigneeId: 'milo', points: 1, done: true },
  { id: 'c4', title: 'Do the dishes', assigneeId: 'milo', points: 2, done: false },
  { id: 'c5', title: 'Feed the cat', assigneeId: 'kaya', points: 1, done: true },
  { id: 'c6', title: 'Make bed', assigneeId: 'kaya', points: 1, done: true },
  { id: 'c7', title: 'Fold laundry', assigneeId: 'kaya', points: 2, done: false },
  { id: 'c8', title: 'Plan grocery list', assigneeId: 'mom', points: 0, done: false },
  { id: 'c9', title: 'Pay bills', assigneeId: 'dad', points: 0, done: false },
];

export const seedMeals: Meal[] = [
  { id: 'm1', day: 'mon', slot: 'lunch', name: 'Leftovers', chefIds: ['dad'] },
  { id: 'm2', day: 'tue', slot: 'lunch', name: 'Grilled Cheese', chefIds: ['milo'] },
  { id: 'm3', day: 'thu', slot: 'lunch', name: 'Turkey Sandwiches', chefIds: ['mom'] },
  { id: 'm4', day: 'fri', slot: 'lunch', name: 'Pizza Slices', chefIds: ['dad'] },
  { id: 'm5', day: 'sun', slot: 'lunch', name: 'Pancake Brunch', chefIds: ['mom'] },
  { id: 'm6', day: 'mon', slot: 'dinner', name: 'Taco Night', chefIds: ['kaya'] },
  { id: 'm7', day: 'tue', slot: 'dinner', name: 'BBQ Chicken', chefIds: ['dad'] },
  { id: 'm8', day: 'wed', slot: 'dinner', name: 'Homemade Pizza', chefIds: ['milo'] },
  { id: 'm9', day: 'thu', slot: 'dinner', name: 'Veggie Stir-fry', chefIds: ['mom'] },
  { id: 'm10', day: 'fri', slot: 'dinner', name: 'Grilled Salmon', chefIds: ['dad'] },
  { id: 'm11', day: 'sat', slot: 'dinner', name: 'Roast & Veggies', chefIds: ['mom'] },
  {
    id: 'm12',
    day: 'sun',
    slot: 'dinner',
    name: 'Spaghetti & Meatballs',
    chefIds: ['mom', 'dad'],
    rating: 4,
    notes: "Double the recipe — Milo's friend is staying over for dinner.",
  },
];

export const seedBoardColumns: BoardColumn[] = [
  { id: 'todo', title: 'Family To-Do', color: '#3D6FA8' },
  { id: 'wishlist', title: 'Wishlist', color: '#7A5AA6' },
  { id: 'shopping', title: 'Shopping List', color: '#2E7A4D' },
];

export const seedBoardItems: BoardItem[] = [
  { id: 'b1', columnId: 'todo', title: 'Schedule dentist appointments', ownerId: 'mom', done: false },
  { id: 'b2', columnId: 'todo', title: 'Fix leaky faucet', ownerId: 'dad', done: false },
  { id: 'b3', columnId: 'todo', title: 'Return Amazon package', ownerId: 'kaya', done: false },
  {
    id: 'b4',
    columnId: 'wishlist',
    title: 'Nintendo Switch game',
    description: 'Mario Kart — for birthday',
    ownerId: 'milo',
    done: false,
  },
  {
    id: 'b5',
    columnId: 'wishlist',
    title: 'Roller skates',
    description: 'Pink ones from the mall',
    ownerId: 'kaya',
    done: false,
  },
  { id: 'b6', columnId: 'shopping', title: 'Milk', ownerId: 'mom', done: false },
  { id: 'b7', columnId: 'shopping', title: 'AA batteries', ownerId: 'dad', done: false },
  {
    id: 'b8',
    columnId: 'shopping',
    title: 'Poster board',
    description: 'For the school project',
    ownerId: 'milo',
    done: false,
  },
];

// A handful of sample events on the current month so the calendar isn't empty
// on first launch. Real usage replaces these via Add Event / calendar sync.
function isoDateInCurrentMonth(day: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), day);
  return d.toISOString().slice(0, 10);
}

export const seedEvents: CalendarEvent[] = [
  { id: 'e1', date: isoDateInCurrentMonth(5), title: 'Beach day', personIds: ['dad'], source: 'local' },
  { id: 'e2', date: isoDateInCurrentMonth(15), title: 'Business trip', personIds: ['dad'], source: 'local' },
  { id: 'e3', date: isoDateInCurrentMonth(new Date().getDate()), time: '9:00 AM', endTime: '10:30 AM', title: 'Soccer practice', personIds: ['milo'], source: 'local' },
  { id: 'e4', date: isoDateInCurrentMonth(new Date().getDate()), time: '3:30 PM', title: 'Dentist appointment', personIds: ['kaya'], source: 'local' },
  { id: 'e5', date: isoDateInCurrentMonth(new Date().getDate()), time: '6:00 PM', endTime: '7:30 PM', title: 'Family dinner', personIds: ['dad', 'mom', 'milo', 'kaya'], source: 'local' },
  { id: 'e6', date: isoDateInCurrentMonth(new Date().getDate() + 1), title: 'Book club', personIds: ['mom'], source: 'local' },
  { id: 'e7', date: isoDateInCurrentMonth(Math.min(new Date().getDate() + 3, 28)), title: 'Piano lesson', personIds: ['kaya'], source: 'local' },
];

export const dailyChallenges = [
  { question: 'Would you rather explore outer space or the deep ocean?', tag: 'Would You Rather', optionA: 'Space', optionB: 'Ocean' },
  { question: 'Would you rather have the power of invisibility or flight?', tag: 'Would You Rather', optionA: 'Invisibility', optionB: 'Flight' },
  { question: 'What is one thing you’re grateful for today?', tag: 'Question', optionA: undefined, optionB: undefined },
  { question: 'Would you rather always have to sing instead of speak, or dance everywhere you walk?', tag: 'Would You Rather', optionA: 'Sing', optionB: 'Dance' },
  { question: 'Would you rather be the best player on a losing team or the worst player on a winning team?', tag: 'Would You Rather', optionA: 'Best on losing team', optionB: 'Worst on winning team' },
  { question: 'Would you rather have a pet dragon or a pet unicorn?', tag: 'Would You Rather', optionA: 'Dragon', optionB: 'Unicorn' },
  { question: 'Would you rather live in a treehouse or a houseboat?', tag: 'Would You Rather', optionA: 'Treehouse', optionB: 'Houseboat' },
  { question: 'Would you rather never use social media again or never watch another movie/show?', tag: 'Would You Rather', optionA: 'No social media', optionB: 'No movies/shows' },
  { question: 'Would you rather be able to talk to animals or speak every human language?', tag: 'Would You Rather', optionA: 'Talk to animals', optionB: 'Speak every language' },
  { question: 'Would you rather have unlimited pizza for a year or unlimited ice cream for a year?', tag: 'Would You Rather', optionA: 'Pizza', optionB: 'Ice cream' },
  { question: 'Would you rather be able to fly or be invisible?', tag: 'Would You Rather', optionA: 'Fly', optionB: 'Invisible' },
  { question: 'Would you rather always be 10 minutes late or always be 20 minutes early?', tag: 'Would You Rather', optionA: '10 min late', optionB: '20 min early' },
  { question: "What's the best thing that happened to you this week?", tag: 'Question', optionA: undefined, optionB: undefined },
  { question: 'If you could have dinner with anyone, living or from history, who would it be?', tag: 'Question', optionA: undefined, optionB: undefined },
  { question: 'What is a small thing that made you smile recently?', tag: 'Question', optionA: undefined, optionB: undefined },
  { question: 'If you could instantly master one skill, what would you pick?', tag: 'Question', optionA: undefined, optionB: undefined },
  { question: "What's your favorite family memory from this year so far?", tag: 'Question', optionA: undefined, optionB: undefined },
];

export const verses = [
  { text: 'Trust in the LORD with all your heart, and lean not on your own understanding.', ref: 'Proverbs 3:5' },
  { text: 'I can do all things through him who strengthens me.', ref: 'Philippians 4:13' },
  { text: 'Be strong and courageous. Do not be afraid; do not be discouraged.', ref: 'Joshua 1:9' },
];