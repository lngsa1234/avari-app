/**
 * Generate a unique username from a user's name.
 *
 * Strategy: lowercase, replace spaces with dots, strip non-alphanumeric.
 * If taken, append incrementing number: lynn.wang → lynn.wang2 → lynn.wang3
 *
 * @param {string} name - The user's display name
 * @param {object} supabase - Supabase client
 * @returns {Promise<string>} A unique username
 */
export async function generateUsername(name, supabase) {
  // Normalize: lowercase, replace spaces/special chars with dots, strip extras
  const base = (name || 'user')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '.')        // spaces → dots
    .replace(/[^a-z0-9.]/g, '')  // strip non-alphanumeric (keep dots)
    .replace(/\.{2,}/g, '.')     // collapse multiple dots
    .replace(/^\.+|\.+$/g, '')   // trim leading/trailing dots
    || 'user';

  // Check if base is available
  const { data: existing } = await supabase
    .from('profiles')
    .select('username')
    .like('username', `${base}%`)
    .order('username');

  const takenSet = new Set((existing || []).map(p => p.username));

  if (!takenSet.has(base)) return base;

  // Append incrementing number
  let counter = 2;
  while (takenSet.has(`${base}${counter}`)) {
    counter++;
  }
  return `${base}${counter}`;
}
