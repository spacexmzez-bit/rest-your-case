/* File name: ryc-models.js — shared engine preference for Settings and requests. */
const RYCModels = (() => {
  const key = 'rest_your_case_engine_mode';
  const valid = value => value === 'smart' || value === 'light';
  let fallback = 'smart';
  function get() {
    try {const saved = localStorage.getItem(key); return valid(saved) ? saved : fallback;}
    catch (_) {return fallback;}
  }
  function set(value) {
    if (!valid(value)) throw new Error('Choose Smart or Light.');
    localStorage.setItem(key, value);
    fallback = value;
  }
  const label = () => get() === 'light' ? 'Light' : 'Smart';
  return {get, set, label};
})();
if (typeof window !== 'undefined') window.RYCModels = RYCModels;
