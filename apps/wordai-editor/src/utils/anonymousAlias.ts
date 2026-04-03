/**
 * anonymousAlias - Generate and persist a random animal alias for non-authenticated users.
 * The alias is stored in localStorage so it stays consistent across sessions.
 */

const ALIAS_KEY = 'wordai_anonymous_alias';

const ADJECTIVES = [
  'Brave', 'Calm', 'Daring', 'Eager', 'Fierce', 'Gentle', 'Happy', 'Jolly',
  'Kind', 'Lively', 'Merry', 'Noble', 'Proud', 'Quick', 'Rosy', 'Swift',
  'Tender', 'Vivid', 'Warm', 'Witty', 'Zesty', 'Bold', 'Clever', 'Dazzling',
  'Elegant', 'Fluffy', 'Graceful', 'Humble', 'Icy', 'Jumpy',
];

const ANIMALS = [
  'Axolotl', 'Binturong', 'Capybara', 'Dingo', 'Echidna', 'Fennec', 'Genet',
  'Hamster', 'Ibis', 'Jackalope', 'Kinkajou', 'Lemur', 'Meerkat', 'Narwhal',
  'Okapi', 'Pangolin', 'Quokka', 'Raccoon', 'Serval', 'Tapir', 'Uakari',
  'Vombat', 'Wallaby', 'Xerus', 'Yapok', 'Zorilla', 'Alpaca', 'Bongo',
  'Caracal', 'Dhole', 'Eland', 'Fossa', 'Gemsbok', 'Hoopoe', 'Impala',
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Returns a persistent animal alias for the anonymous user.
 * Creates and stores one on first call; returns the same on subsequent calls.
 */
export function getAnonymousAlias(): string {
  const stored = localStorage.getItem(ALIAS_KEY);
  if (stored) return stored;

  const alias = `${pickRandom(ADJECTIVES)} ${pickRandom(ANIMALS)}`;
  localStorage.setItem(ALIAS_KEY, alias);
  return alias;
}

/** Clears the stored alias (e.g. on sign-out). */
export function clearAnonymousAlias(): void {
  localStorage.removeItem(ALIAS_KEY);
}
