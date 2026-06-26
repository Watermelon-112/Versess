// ── VERSES APP CORE ──
const STORAGE_KEYS = {
  USERS: 'verses_users',
  SESSION: 'verses_session',
  LIKES: 'verses_likes',
  REPLIES: 'verses_replies',
};

// ── Utility ──
function getUsers() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
}

function saveUsers(users) {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSION));
  } catch {
    return null;
  }
}

function setSession(user) {
  localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.SESSION);
}

function getLikes() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.LIKES) || '{}');
}

function saveLikes(likes) {
  localStorage.setItem(STORAGE_KEYS.LIKES, JSON.stringify(likes));
}

function getInitials(name) {
  return name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function showToast(msg, duration = 2500) {
  let toast = document.getElementById('verses-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'verses-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), duration);
}

// ── AUTH helpers ──
function requireAuth() {
  const session = getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  return session;
}

function redirectIfLoggedIn() {
  const session = getSession();
  if (session) {
    window.location.href = 'feed.html';
  }
}

function logout() {
  clearSession();
  window.location.href = 'index.html';
}

// ── Demo profiles ──
const DEMO_PROFILES = [
  {
    id: 1,
    name: 'Amara J.',
    age: 27,
    location: 'Brooklyn, NY',
    initials: 'AJ',
    gradient: 'linear-gradient(145deg, #C8A27A, #7B4F3A)',
    prompts: [
      { q: 'My most irrational fear', a: 'That a perfect poem exists somewhere and I\'ll never find it.' },
      { q: 'A life story in five words', a: 'Dreamed, fell, rose, wrote, lived.' },
      { q: 'I geek out on', a: 'The quiet space between a question and its answer — that\'s where I live.' },
    ]
  },
  {
    id: 2,
    name: 'Elias M.',
    age: 30,
    location: 'Austin, TX',
    initials: 'EM',
    gradient: 'linear-gradient(145deg, #B08A60, #4A2C2A)',
    prompts: [
      { q: 'The way to my heart', a: 'Tell me a story you\'ve never told anyone. I promise I\'ll listen.' },
      { q: 'I\'m looking for', a: 'Someone whose silence feels like a conversation.' },
      { q: 'Two truths and a lie', a: 'I once performed at an open mic with shaking hands. I have 47 unfinished journals. Words have never failed me.' },
    ]
  },
  {
    id: 3,
    name: 'Soleil K.',
    age: 25,
    location: 'Portland, OR',
    initials: 'SK',
    gradient: 'linear-gradient(145deg, #EAD9C4, #C8A27A)',
    prompts: [
      { q: 'My love language', a: 'Leaving notes. On mirrors, napkins, receipts — everywhere words can breathe.' },
      { q: 'A non-negotiable', a: 'Morning coffee with zero notifications and at least one good paragraph.' },
      { q: 'Best travel story', a: 'Got lost in Lisbon, found a street poet who said exactly what I needed to hear.' },
    ]
  },
  {
    id: 4,
    name: 'Dayo O.',
    age: 28,
    location: 'Chicago, IL',
    initials: 'DO',
    gradient: 'linear-gradient(145deg, #8B6550, #5C3A30)',
    prompts: [
      { q: 'I\'m convinced that', a: 'Every city has a poem waiting to be heard at 2am in the rain.' },
      { q: 'Change my mind on', a: 'Vulnerability is the bravest thing a person can write.' },
      { q: 'My simple pleasures', a: 'Old bookstores, handwritten letters, and the sound of someone laughing too loud.' },
    ]
  },
  {
    id: 5,
    name: 'Riya P.',
    age: 26,
    location: 'Seattle, WA',
    initials: 'RP',
    gradient: 'linear-gradient(145deg, #D4B896, #9B6E50)',
    prompts: [
      { q: 'Unusual skill', a: 'I can recite Neruda in Spanish even though I\'m still learning the language.' },
      { q: 'A Sunday morning for me looks like', a: 'Slow jazz, chai, and a notebook that asks nothing of me.' },
      { q: 'I want someone who', a: 'Finds beauty in the mundane and says so out loud.' },
    ]
  },
];

// Export for use across pages
window.VersesApp = {
  getSession,
  setSession,
  clearSession,
  getUsers,
  saveUsers,
  getLikes,
  saveLikes,
  requireAuth,
  redirectIfLoggedIn,
  logout,
  getInitials,
  showToast,
  DEMO_PROFILES,
};
