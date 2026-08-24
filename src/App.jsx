import { useState, useEffect, useMemo } from "react";
import { fetchVerse, YV_TRANSLATIONS, FALLBACK_TRANSLATIONS } from "./bibleUtils.js";
import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, addDoc, getDocs, deleteDoc, doc,
  orderBy, query, where, setDoc, getDoc, serverTimestamp, limit
} from "firebase/firestore";
import {
  getAuth, onAuthStateChanged, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, GoogleAuthProvider, signInWithPopup
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBaF6KSZRTCe_Ifft_Olv6ENPv1jTWx8rg",
  authDomain: "hear-bible-study-56f67.firebaseapp.com",
  projectId: "hear-bible-study-56f67",
  storageBucket: "hear-bible-study-56f67.firebasestorage.app",
  messagingSenderId: "1000066720489",
  appId: "1:1000066720489:web:767ce84bceed68e96e0678",
  measurementId: "G-Y0CXXV7HTC",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

const ALL_TRANSLATIONS = [...YV_TRANSLATIONS, ...FALLBACK_TRANSLATIONS];
const HEAR_COLORS = { H: "#b5813a", E: "#5a8a6a", A: "#4a7aaa", R: "#8a5aaa" };
const USER_COLORS = ["#b5813a","#5a8a6a","#4a7aaa","#8a5aaa","#c0504d","#4bacc6","#f79646","#9bbb59"];

const BIBLE_BOOKS = [
  "Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth",
  "1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra",
  "Nehemiah","Esther","Job","Psalms","Proverbs","Ecclesiastes","Song of Solomon",
  "Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos",
  "Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah",
  "Malachi","Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians",
  "2 Corinthians","Galatians","Ephesians","Philippians","Colossians","1 Thessalonians",
  "2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James",
  "1 Peter","2 Peter","1 John","2 John","3 John","Jude","Revelation"
];

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function truncateTitle(text, max) {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function getBookFromPassage(passage) {
  if (!passage) return null;
  for (const book of BIBLE_BOOKS) {
    if (passage.toLowerCase().startsWith(book.toLowerCase())) return book;
  }
  return null;
}

function getChapterFromPassage(passage) {
  if (!passage) return null;
  const match = passage.match(/(\d+):/);
  return match ? parseInt(match[1]) : null;
}

const MOBILE_BREAKPOINT = 768;

function useWindowSize() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    function onResize() { setWidth(window.innerWidth); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return width;
}

// ── Auth Screen ───────────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const width = useWindowSize();
  const isMobile = width < MOBILE_BREAKPOINT;
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState("");

  async function handleGoogle() {
    setError(""); setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await ensureUserProfile(result.user);
      onAuth(result.user);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleEmailAuth() {
    setError(""); setLoading(true);
    try {
      if (mode === "signup") {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(result.user);
        await ensureUserProfile(result.user, displayName);
        setVerifyEmail(email);
        setMode("verify");
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        if (!result.user.emailVerified) {
          setVerifyEmail(email);
          setMode("verify");
          await signOut(auth);
          return;
        }
        await ensureUserProfile(result.user);
        onAuth(result.user);
      }
    } catch (e) { setError(friendlyError(e.code)); }
    finally { setLoading(false); }
  }

  async function resendVerification() {
    setError(""); setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(result.user);
      await signOut(auth);
      setError("Verification email resent!");
    } catch (e) { setError(friendlyError(e.code)); }
    finally { setLoading(false); }
  }

  function friendlyError(code) {
    const map = {
      "auth/email-already-in-use": "That email is already registered. Try signing in.",
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/weak-password": "Password must be at least 6 characters.",
      "auth/user-not-found": "No account found with that email.",
      "auth/wrong-password": "Incorrect password.",
      "auth/invalid-credential": "Incorrect email or password.",
    };
    return map[code] || "Something went wrong. Please try again.";
  }

  if (mode === "verify") {
    return (
      <div style={s.authRoot}>
        <div style={{ ...s.authCard, ...(isMobile ? { padding: "28px 22px" } : {}) }}>
          <div style={s.logoText}>H.E.A.R.</div>
          <div style={s.logoSub}>Bible Journal</div>
          <div style={{ marginTop: 32, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✉️</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#2c2416", marginBottom: 8 }}>Check your email</div>
            <div style={{ fontSize: 14, color: "#8a7a5a", lineHeight: 1.6, marginBottom: 24 }}>
              We sent a verification link to <strong>{verifyEmail}</strong>.<br />
              Click the link, then come back and sign in.
            </div>
            <button style={s.authBtn} onClick={() => setMode("signin")}>Go to Sign In</button>
            <button style={{ ...s.authBtnSecondary, marginTop: 10 }} onClick={resendVerification} disabled={loading}>
              Resend verification email
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.authRoot}>
      <div style={s.authCard}>
        <div style={s.logoText}>H.E.A.R.</div>
        <div style={s.logoSub}>Bible Journal</div>
        <div style={s.authTitle}>{mode === "signup" ? "Create account" : "Welcome back"}</div>
        <button style={s.googleBtn} onClick={handleGoogle} disabled={loading}>
          <span style={{ marginRight: 8 }}>G</span> Continue with Google
        </button>
        <div style={s.divider}><span>or</span></div>
        {mode === "signup" && (
          <input style={s.authInput} placeholder="Your name" value={displayName} onChange={e => setDisplayName(e.target.value)} />
        )}
        <input style={s.authInput} placeholder="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleEmailAuth()} />
        <input style={s.authInput} placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleEmailAuth()} />
        {error && <div style={s.authError}>{error}</div>}
        <button style={s.authBtn} onClick={handleEmailAuth} disabled={loading}>
          {loading ? "..." : mode === "signup" ? "Create account" : "Sign in"}
        </button>
        <div style={s.authSwitch}>
          {mode === "signin"
            ? <>Don't have an account? <span style={s.authLink} onClick={() => { setMode("signup"); setError(""); }}>Sign up</span></>
            : <>Already have an account? <span style={s.authLink} onClick={() => { setMode("signin"); setError(""); }}>Sign in</span></>
          }
        </div>
      </div>
    </div>
  );
}

async function ensureUserProfile(user, displayName) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists() === false) {
    await setDoc(ref, {
      displayName: displayName || user.displayName || user.email.split("@")[0],
      email: user.email,
      createdAt: serverTimestamp(),
    });
  }
  const entriesSnap = await getDocs(query(collection(db, "users", user.uid, "entries"), limit(1)));
  if (entriesSnap.empty) {
    await addDoc(collection(db, "users", user.uid, "entries"), {
      date: new Date().toISOString(),
      passage: "John 3:16",
      title: "What a Promise",
      translation: 111,
      verseText: "For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.",
      highlight: "For God so loved the world, that he gave his only Son",
      explain: "God's love for humanity is so vast that he gave the most precious thing he had — his own Son — so that anyone who believes would have eternal life rather than perish.",
      apply: "In my life, I will remember that God's love is not conditional on my performance. It is a gift freely given to anyone who believes.",
      respond: "Lord God - you are amazing and awesome. Your love exceeds anything I could imagine. Thank you for the gift of your Son. Help me to live in the wonder of that love every day.",
      ownerEmail: user.email,
      sharedWith: [],
    });
  }
  const sharedEntriesSnap = await getDocs(query(collection(db, "users", user.uid, "sharedEntries"), where("originalEntryId", "==", "welcome"), limit(1)));
  if (sharedEntriesSnap.empty) {
    await addDoc(collection(db, "users", user.uid, "sharedEntries"), {
      date: new Date().toISOString(),
      passage: "John 3:16",
      title: "What a Promise",
      translation: 111,
      verseText: "For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.",
      highlight: "For God so loved the world, that he gave his only Son",
      explain: "God's love for humanity is so vast that he gave the most precious thing he had — his own Son — so that anyone who believes would have eternal life rather than perish.",
      apply: "In my life, I will remember that God's love is not conditional on my performance. It is a gift freely given to anyone who believes.",
      respond: "Lord God - you are amazing and awesome. Your love exceeds anything I could imagine. Thank you for the gift of your Son. Help me to live in the wonder of that love every day.",
      sharedBy: "FX0V9MN6d9U9QiIWqU5gi394V8v2",
      sharedByEmail: "rodsalyer@gmail.com",
      originalEntryId: "welcome",
      sharedAt: serverTimestamp(),
      ownerEmail: user.email,
      sharedWith: [],
    });
  }
}

function VerifyBanner({ user }) {
  const [sent, setSent] = useState(false);
  async function resend() { await sendEmailVerification(user); setSent(true); }
  return (
    <div style={s.verifyBanner}>
      ⚠️ Please verify your email to use all features.
      {!sent ? <span style={s.authLink} onClick={resend}> Resend email</span> : <span> Email sent!</span>}
    </div>
  );
}

// ── Color Picker ──────────────────────────────────────────────────────────────
function HearMethodContent() {
  const sections = [
    { letter: "H", label: "Highlight", text: "Choose a verse that speaks to you from the passage." },
    { letter: "E", label: "Explain", text: "Explain as best you can what the verse means in its original context." },
    { letter: "A", label: "Apply", text: "Apply that meaning to your life today." },
    { letter: "R", label: "Respond", text: "Respond to what God is saying to you — some days that might be a prayer, others it might be something God is calling you to do." },
  ];
  const sample = {
    passage: "Philippians 4:10-13",
    title: "The Secret of Contentment",
    highlight: "I can do all things through Christ who strengthens me — Philippians 4:13",
    explain: "Paul was telling the church at Philippi that he has discovered the secret of contentment. No matter the situation, he realized that Christ was all he needed.",
    apply: "In my life, I will experience many ups and downs. My contentment is not found in circumstances but in my relationship with Jesus Christ.",
    respond: "Lord Jesus, please help me as I strive to be content in You. Through Your strength, I can make it through any situation.",
  };
  return (
    <>
      <div style={s.modalTitle}>The H.E.A.R. Method</div>
      <p style={{ ...s.modalDesc, marginBottom: 24 }}>
        Reading the Bible is easier when there is a strategy to it. Early Jesus followers developed a strategy called Lectio Divina, practiced since the 6th Century as a way of hearing from God through the Scriptures. This ancient practice has been updated for modern readers into what is called the H.E.A.R. Method.
      </p>
      {sections.map(({ letter, label, text }) => (
        <HearField key={letter} letter={letter} label={label} color={HEAR_COLORS[letter]} value={text} readOnly />
      ))}
      <div style={{ ...s.modalTitle, fontSize: 16, marginTop: 28, marginBottom: 12 }}>Sample Entry</div>
      <div style={{ marginBottom: 16 }}>
        <div style={s.readTitle}>{sample.title}</div>
        <div style={s.readPassage}>{sample.passage}</div>
      </div>
      <div style={s.verseBox}><span style={s.verseQuote}>"</span>{sample.highlight}<span style={s.verseQuote}>"</span></div>
      {[
        { letter: "H", label: "Highlight", val: sample.highlight },
        { letter: "E", label: "Explain", val: sample.explain },
        { letter: "A", label: "Apply", val: sample.apply },
        { letter: "R", label: "Respond", val: sample.respond },
      ].map(({ letter, label, val }) => (
        <HearField key={letter} letter={letter} label={label} color={HEAR_COLORS[letter]} value={val} readOnly />
      ))}
    </>
  );
}

function AboutModal({ onClose }) {
  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={{ ...s.modalCard, maxWidth: 480, maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <HearMethodContent />
        <button style={s.cancelBtn} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function ColorPickerModal({ sharedUsers, colorMap, onSave, onClose }) {
  const [localMap, setLocalMap] = useState({ ...colorMap });
  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={s.modalCard} onClick={e => e.stopPropagation()}>
        <div style={s.modalTitle}>Shared User Colors</div>
        <div style={s.modalDesc}>Choose a color to identify each person's entries.</div>
        {sharedUsers.map(u => (
          <div key={u.id} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "#2c2416", marginBottom: 8, fontWeight: 600 }}>{u.label || u.email}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {USER_COLORS.map(color => (
                <div key={color} onClick={() => setLocalMap(prev => ({ ...prev, [u.id]: color }))}
                  style={{ width: 28, height: 28, borderRadius: "50%", background: color, cursor: "pointer",
                    border: localMap[u.id] === color ? "3px solid #2c2416" : "3px solid transparent", boxSizing: "border-box" }}
                />
              ))}
            </div>
          </div>
        ))}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button style={s.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={s.saveBtn} onClick={() => { onSave(localMap); onClose(); }}>Save Colors</button>
        </div>
      </div>
    </div>
  );
}

// ── Filter Panel ──────────────────────────────────────────────────────────────
function FilterPanel({ filters, onChange, sharedUsers, showMineOnly, onToggleMineOnly, sidebarTab, onClose, sortOrder, onSortOrderChange }) {
  const [bookInput, setBookInput] = useState(filters.book || "");
  const [bookSuggestions, setBookSuggestions] = useState([]);

  function handleBookInput(val) {
    setBookInput(val);
    if (val.length < 2) { setBookSuggestions([]); return; }
    setBookSuggestions(BIBLE_BOOKS.filter(b => b.toLowerCase().startsWith(val.toLowerCase())).slice(0, 5));
  }

  function selectBook(book) {
    setBookInput(book);
    setBookSuggestions([]);
    onChange({ ...filters, book });
  }

  function clearBook() {
    setBookInput("");
    setBookSuggestions([]);
    const { book, chapter, ...rest } = filters;
    onChange(rest);
  }

  const hasFilters = filters.book || filters.dateFrom || filters.dateTo || filters.creator;

  return (
    <div style={s.filterPanel}>
      <div style={s.filterHeader}>
        <span style={s.filterTitle}>Filters</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {hasFilters && <button style={s.clearBtn} onClick={() => { onChange({}); setBookInput(""); }}>Clear all</button>}
          <button style={s.filterCloseBtn} onClick={onClose} title="Close filters" aria-label="Close filters">✕</button>
        </div>
      </div>

      {/* Sort by date created */}
      <div style={s.filterRow}>
        <label style={s.filterLabel}>Sort by date created</label>
        <div style={s.toggleRow}>
          <button style={{ ...s.toggleBtn, ...(sortOrder === "desc" ? s.toggleBtnActive : {}) }} onClick={() => onSortOrderChange("desc")}>Newest first</button>
          <button style={{ ...s.toggleBtn, ...(sortOrder === "asc" ? s.toggleBtnActive : {}) }} onClick={() => onSortOrderChange("asc")}>Oldest first</button>
        </div>
      </div>

      {/* Mine only toggle — only shown in shared tab */}
      {sidebarTab === "shared" && sharedUsers.length > 0 && (
        <div style={s.filterRow}>
          <label style={s.filterLabel}>Show</label>
          <div style={s.toggleRow}>
            <button style={{ ...s.toggleBtn, ...(showMineOnly ? s.toggleBtnActive : {}) }} onClick={() => onToggleMineOnly(true)}>Mine only</button>
            <button style={{ ...s.toggleBtn, ...(!showMineOnly ? s.toggleBtnActive : {}) }} onClick={() => onToggleMineOnly(false)}>All</button>
          </div>
        </div>
      )}

      {/* Book filter */}
      <div style={s.filterRow}>
        <label style={s.filterLabel}>Book</label>
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", gap: 4 }}>
            <input style={s.filterInput} placeholder="e.g. Psalms" value={bookInput} onChange={e => handleBookInput(e.target.value)} />
            {bookInput && <button style={s.clearXBtn} onClick={clearBook}>✕</button>}
          </div>
          {bookSuggestions.length > 0 && (
            <div style={s.suggestions}>
              {bookSuggestions.map(b => (
                <div key={b} style={s.suggestion} onClick={() => selectBook(b)}>{b}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chapter filter */}
      {filters.book && (
        <div style={s.filterRow}>
          <label style={s.filterLabel}>Chapter</label>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input style={{ ...s.filterInput, width: 60 }} placeholder="e.g. 3" type="number" min="1"
              value={filters.chapter || ""}
              onChange={e => {
                const val = e.target.value;
                if (!val) { const { chapter, ...rest } = filters; onChange(rest); }
                else onChange({ ...filters, chapter: parseInt(val) });
              }}
            />
            {filters.chapter && <button style={s.clearXBtn} onClick={() => { const { chapter, ...rest } = filters; onChange(rest); }}>✕</button>}
          </div>
        </div>
      )}

      {/* Date range */}
      <div style={s.filterRow}>
        <label style={s.filterLabel}>From</label>
        <input style={s.filterInput} type="date" value={filters.dateFrom || ""}
          onChange={e => { if (!e.target.value) { const { dateFrom, ...rest } = filters; onChange(rest); } else onChange({ ...filters, dateFrom: e.target.value }); }}
        />
      </div>
      <div style={s.filterRow}>
        <label style={s.filterLabel}>To</label>
        <input style={s.filterInput} type="date" value={filters.dateTo || ""}
          onChange={e => { if (!e.target.value) { const { dateTo, ...rest } = filters; onChange(rest); } else onChange({ ...filters, dateTo: e.target.value }); }}
        />
      </div>

      {/* Creator filter — shared tab only */}
      {sidebarTab === "shared" && sharedUsers.length > 0 && !showMineOnly && (
        <div style={s.filterRow}>
          <label style={s.filterLabel}>Creator</label>
          <select style={s.filterInput} value={filters.creator || ""}
            onChange={e => { if (!e.target.value) { const { creator, ...rest } = filters; onChange(rest); } else onChange({ ...filters, creator: e.target.value }); }}
          >
            <option value="">Anyone</option>
            {sharedUsers.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
          </select>
        </div>
      )}

      {/* Active filter tags */}
      {hasFilters && (
        <div style={s.filterSummary}>
          {filters.book && <span style={s.filterTag}>{filters.book}{filters.chapter ? ` ${filters.chapter}` : ""}</span>}
          {filters.dateFrom && <span style={s.filterTag}>From {filters.dateFrom}</span>}
          {filters.dateTo && <span style={s.filterTag}>To {filters.dateTo}</span>}
          {filters.creator && <span style={s.filterTag}>{sharedUsers.find(u => u.id === filters.creator)?.email}</span>}
        </div>
      )}

      <button style={s.applyFiltersBtn} onClick={onClose}>Apply Filters</button>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function VerseDisplay({ text, loading, error }) {
  if (loading) return <div style={s.verseBox}><em style={{ color: "#b5813a" }}>Fetching verse...</em></div>;
  if (error) return (
    <div style={s.verseError}>
      {error.split("\n\n").map((line, i) => (
        <p key={i} style={{ margin: i === 0 ? 0 : "8px 0 0 0" }}>{line}</p>
      ))}
    </div>
  );
  if (!text) return null;
  return <div style={s.verseBox}><span style={s.verseQuote}>"</span>{text}<span style={s.verseQuote}>"</span></div>;
}

function HearField({ letter, label, color, value, onChange, readOnly }) {
  return (
    <div style={{ ...s.hearField, borderLeftColor: color }}>
      <div style={s.hearLabelRow}>
        <span style={{ ...s.hearLetter, color }}>{letter}</span>
        <span style={s.hearLabel}>{label}</span>
      </div>
      {readOnly
        ? <p style={s.readText}>{value}</p>
        : <textarea style={{ ...s.hearTextarea, outlineColor: color }} value={value} onChange={e => onChange(e.target.value)} rows={4} />
      }
    </div>
  );
}

function EntryCard({ entry, onSelect, onDelete, onShare, isActive, accentColor, ownerLabel, compact }) {
  if (compact) {
    return (
      <div style={{ ...s.entryCardCompact, ...(isActive ? s.entryCardActive : {}), borderLeft: `3px solid ${accentColor || "#3a2e1e"}` }}
        onClick={() => onSelect(entry)}>
        {ownerLabel ? (
          <>
            <span style={s.entryCardCompactPassage}>{entry.passage}</span>
            <span style={s.entryCardCompactSep}>·</span>
            <span style={{ ...s.entryCardCompactOwner, color: accentColor }}>{ownerLabel}</span>
            <span style={s.entryCardCompactSep}>·</span>
            <span style={s.entryCardCompactTitle}>{truncateTitle(entry.title || "Untitled", 20)}</span>
          </>
        ) : (
          <>
            <span style={s.entryCardCompactPassage}>{entry.passage}</span>
            <span style={{ ...s.entryCardCompactTitle, flex: 1 }}>{truncateTitle(entry.title || "Untitled", 20)}</span>
          </>
        )}
      </div>
    );
  }
  return (
    <div style={{ ...s.entryCard, ...(isActive ? s.entryCardActive : {}), borderLeft: `3px solid ${accentColor || "#3a2e1e"}` }}>
      <div style={{ flex: 1 }} onClick={() => onSelect(entry)}>
        {ownerLabel && <div style={{ ...s.ownerLabel, color: accentColor }}>{ownerLabel}</div>}
        <div style={s.entryCardDate}>{formatDate(entry.date)}</div>
        <div style={s.entryCardTitle}>{entry.title || "Untitled"}</div>
        <div style={s.entryCardPassage}>{entry.passage}</div>
        {entry.sharedWith?.length > 0 && <div style={s.sharedBadge}>Shared</div>}
      </div>
      {onDelete && onShare && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button style={s.iconBtn} onClick={e => { e.stopPropagation(); onShare(entry); }} title="Share">⤴</button>
          <button style={s.iconBtn} onClick={e => { e.stopPropagation(); onDelete(entry); }} title="Delete">✕</button>
        </div>
      )}
    </div>
  );
}

function CommentSection({ entryId, user }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadComments(); }, [entryId]);

  async function loadComments() {
    setLoading(true);
    try {
      const q = query(collection(db, "comments", entryId, "messages"), orderBy("createdAt", "asc"));
      const snap = await getDocs(q);
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function postComment() {
    if (!text.trim()) return;
    await addDoc(collection(db, "comments", entryId, "messages"), {
      text: text.trim(), authorId: user.uid,
      authorName: user.displayName || user.email,
      createdAt: serverTimestamp(),
    });
    setText(""); loadComments();
  }

  return (
    <div style={s.commentSection}>
      <div style={s.commentTitle}>Comments</div>
      {loading && <div style={{ color: "#a09070", fontSize: 13 }}>Loading...</div>}
      {comments.map(c => (
        <div key={c.id} style={s.comment}>
          <div style={s.commentAuthor}>{c.authorName}</div>
          <div style={s.commentText}>{c.text}</div>
        </div>
      ))}
      <div style={s.commentInputRow}>
        <input style={s.commentInput} placeholder="Add a comment..." value={text}
          onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && postComment()} />
        <button style={s.commentBtn} onClick={postComment}>Post</button>
      </div>
    </div>
  );
}

function ShareModal({ entry, user, onClose }) {
  const [shareEmail, setShareEmail] = useState("");
  const [shareType, setShareType] = useState("entry");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function shareEntry() {
    if (!shareEmail.trim()) return;
    setLoading(true); setStatus("");
    try {
      const q = query(collection(db, "users"), where("email", "==", shareEmail.trim()));
      const snap = await getDocs(q);
      if (snap.empty) { setStatus("No user found with that email."); setLoading(false); return; }
      const recipientId = snap.docs[0].id;
      if (shareType === "entry") {
        const entryRef = doc(db, "users", user.uid, "entries", entry.id);
        const entrySnap = await getDoc(entryRef);
        if (entrySnap.exists() === false) { setStatus("Entry not found."); setLoading(false); return; }
        const sharedWith = entrySnap.data().sharedWith || [];
        if (sharedWith.includes(recipientId) === false) {
          await setDoc(entryRef, { sharedWith: [...sharedWith, recipientId] }, { merge: true });
        }
        await addDoc(collection(db, "users", recipientId, "sharedEntries"), {
          ...entrySnap.data(), sharedBy: user.uid, sharedByEmail: user.email,
          originalEntryId: entry.id, sharedAt: serverTimestamp(),
        });
        setStatus("Entry shared successfully!");
      } else {
        await setDoc(doc(db, "journalShares", `${user.uid}_${recipientId}`), {
          ownerId: user.uid, ownerEmail: user.email, recipientId,
          recipientEmail: shareEmail.trim(), sharedAt: serverTimestamp(),
        });
        setStatus("Journal shared successfully!");
      }
    } catch (e) { setStatus("Something went wrong. Please try again."); console.error(e); }
    finally { setLoading(false); }
  }

  const isSuccess = status.includes("successfully");
  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={s.modalCard} onClick={e => e.stopPropagation()}>
        <div style={s.modalTitle}>Share</div>
        <div style={s.modalDesc}>Enter the email of the person you want to share with. They must have a H.E.A.R. account.</div>
        <div style={s.shareTypeRow}>
          <button style={{ ...s.shareTypeBtn, ...(shareType === "entry" ? s.shareTypeBtnActive : {}) }} onClick={() => setShareType("entry")}>This entry</button>
          <button style={{ ...s.shareTypeBtn, ...(shareType === "journal" ? s.shareTypeBtnActive : {}) }} onClick={() => setShareType("journal")}>Entire journal</button>
        </div>
        <input style={s.authInput} placeholder="Their email address" type="email" value={shareEmail}
          onChange={e => setShareEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && shareEntry()} />
        {status && <div style={{ ...s.authError, background: isSuccess ? "#e8f5e9" : "#fdecea", color: isSuccess ? "#2e7d32" : "#b04040", border: isSuccess ? "1px solid #a5d6a7" : "1px solid #f0c0c0" }}>{status}</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button style={s.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={s.saveBtn} onClick={shareEntry} disabled={loading}>{loading ? "Sharing..." : "Share"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function HearJournal() {
  const width = useWindowSize();
  const isMobile = width < MOBILE_BREAKPOINT;
  const [showSidebar, setShowSidebar] = useState(false);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [entries, setEntries] = useState([]);
  const [sharedEntries, setSharedEntries] = useState([]);
  const [sharedJournals, setSharedJournals] = useState([]);
  const [sharedUsers, setSharedUsers] = useState([]);
  const [userColorMap, setUserColorMap] = useState({});
  const [displayNameCache, setDisplayNameCache] = useState({});
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [view, setView] = useState("list");
  const [selected, setSelected] = useState(null);
  const [shareTarget, setShareTarget] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [sidebarTab, setSidebarTab] = useState("mine");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [compactViewMine, setCompactViewMine] = useState(() => {
    const saved = localStorage.getItem("compactViewMine");
    return saved === null ? true : saved === "true";
  });
  const [compactViewShared, setCompactViewShared] = useState(() => {
    const saved = localStorage.getItem("compactViewShared");
    return saved === null ? true : saved === "true";
  });
  const [filters, setFilters] = useState({});
  const [showMineOnly, setShowMineOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState("desc");

  // Form state
  const [passage, setPassage] = useState("");
  const [title, setTitle] = useState("");
  const [translation, setTranslation] = useState(111);
  const [verseText, setVerseText] = useState("");
  const [verseLoading, setVerseLoading] = useState(false);
  const [verseError, setVerseError] = useState("");
  const [highlight, setHighlight] = useState("");
  const [explain, setExplain] = useState("");
  const [apply, setApply] = useState("");
  const [respond, setRespond] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u); setAuthReady(true);
      if (u && u.emailVerified) {
        await loadEntries(u);
        await loadSharedContent(u);
        loadColorPrefs(u);
      }
    });
    return unsub;
  }, []);

  function loadColorPrefs(u) {
    const saved = localStorage.getItem(`colorMap_${u.uid}`);
    if (saved) setUserColorMap(JSON.parse(saved));
  }

  function saveColorPrefs(map) {
    setUserColorMap(map);
    localStorage.setItem(`colorMap_${user.uid}`, JSON.stringify(map));
  }

  async function loadEntries(u) {
    setLoadingEntries(true);
    try {
      const q = query(collection(db, "users", u.uid, "entries"), orderBy("date", "desc"));
      const snap = await getDocs(q);
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
    finally { setLoadingEntries(false); }
  }

  async function loadSharedContent(u) {
    try {
      const q1 = query(collection(db, "users", u.uid, "sharedEntries"), orderBy("sharedAt", "desc"));
      const snap1 = await getDocs(q1);
      const shared = snap1.docs.map(d => ({ id: d.id, ...d.data() }));
      setSharedEntries(shared);
      const userMap = {};
      shared.forEach(e => { if (e.sharedBy && e.sharedByEmail) userMap[e.sharedBy] = e.sharedByEmail; });
      setSharedUsers(Object.entries(userMap).map(([id, email]) => ({ id, email })));
      await loadDisplayNames(Object.keys(userMap));
      const q2 = query(collection(db, "journalShares"), where("recipientId", "==", u.uid));
      const snap2 = await getDocs(q2);
      setSharedJournals(snap2.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
  }

  async function loadDisplayNames(uids) {
    if (uids.length === 0) return;
    const results = await Promise.all(uids.map(async uid => {
      try {
        const snap = await getDoc(doc(db, "users", uid));
        return [uid, snap.exists() ? snap.data().displayName : null];
      } catch (e) { return [uid, null]; }
    }));
    setDisplayNameCache(prev => {
      const next = { ...prev };
      results.forEach(([uid, name]) => { if (name) next[uid] = name; });
      return next;
    });
  }

  function getDisplayLabel(uid, fallbackEmail) {
    return (uid && displayNameCache[uid]) || fallbackEmail;
  }

  // ── Universal filter logic ─────────────────────────────────────────────────
  function applyFilters(entryList, isShared) {
    return entryList.filter(entry => {
      if (isShared && showMineOnly && entry.sharedBy) return false;
      if (isShared && filters.creator && entry.sharedBy !== filters.creator) return false;
      if (filters.book) {
        const book = getBookFromPassage(entry.passage);
        if (!book || book.toLowerCase() !== filters.book.toLowerCase()) return false;
      }
      if (filters.chapter && filters.book) {
        const chapter = getChapterFromPassage(entry.passage);
        if (chapter !== filters.chapter) return false;
      }
      if (filters.dateFrom && new Date(entry.date) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo) {
        const to = new Date(filters.dateTo); to.setHours(23, 59, 59);
        if (new Date(entry.date) > to) return false;
      }
      return true;
    });
  }

  function sortByDate(entryList) {
    return [...entryList].sort((a, b) => {
      const diff = new Date(a.date) - new Date(b.date);
      return sortOrder === "asc" ? diff : -diff;
    });
  }

  const filteredEntries = useMemo(() => sortByDate(applyFilters(entries, false)), [entries, filters, sortOrder]);
  const filteredSharedEntries = useMemo(() => sortByDate(applyFilters(sharedEntries, true)), [sharedEntries, filters, showMineOnly, sortOrder]);

  const activeFilterCount = Object.keys(filters).length + (showMineOnly && sidebarTab === "shared" ? 1 : 0);

  function getEntryAccent(entry) {
    if (entry.sharedBy) return userColorMap[entry.sharedBy] || "#5a9a6a";
    return "#b5813a";
  }

  const compactView = sidebarTab === "shared" ? compactViewShared : compactViewMine;

  function toggleCompactView() {
    if (sidebarTab === "shared") {
      setCompactViewShared(v => {
        const next = !v;
        localStorage.setItem("compactViewShared", String(next));
        return next;
      });
    } else {
      setCompactViewMine(v => {
        const next = !v;
        localStorage.setItem("compactViewMine", String(next));
        return next;
      });
    }
  }

  async function saveEntry() {
    if (!passage || !highlight || !user) return;
    setSaving(true);
    const entry = {
      date: new Date().toISOString(),
      passage, title, verseText, highlight, explain, apply, respond, translation,
      ownerEmail: user.email, sharedWith: [],
    };
    try {
      const ref = await addDoc(collection(db, "users", user.uid, "entries"), entry);
      setEntries(prev => [{ id: ref.id, ...entry }, ...prev]);
      setView("list"); resetForm();
      if (isMobile) setShowSidebar(true);
    } catch (e) { alert("Failed to save entry."); console.error(e); }
    finally { setSaving(false); }
  }

  async function deleteEntry(entry) {
    if (!confirm(`Delete "${entry.title || entry.passage}"?`)) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "entries", entry.id));
      setEntries(prev => prev.filter(e => e.id !== entry.id));
      if (selected?.id === entry.id) { setSelected(null); setView("list"); if (isMobile) setShowSidebar(true); }
    } catch (e) { alert("Failed to delete."); }
  }

  async function fetchVerse_() {
    if (!passage.trim()) return;
    setVerseLoading(true); setVerseError(""); setVerseText("");
    try {
      const text = await fetchVerse(passage, translation);
      setVerseText(text);
    } catch (e) { setVerseError(e.message || "Could not fetch verse."); }
    finally { setVerseLoading(false); }
  }

  function resetForm() {
    setPassage(""); setTitle(""); setVerseText(""); setVerseError("");
    setHighlight(""); setExplain(""); setApply(""); setRespond("");
  }

  function selectEntry(entry, targetView) {
    setSelected(entry); setView(targetView);
    if (isMobile) setShowSidebar(false);
  }

  function startNewEntry() {
    setView("new"); setSelected(null); resetForm();
    if (isMobile) setShowSidebar(false);
  }

  if (!authReady) return <div style={s.loading}>Loading...</div>;
  if (!user) return <AuthScreen onAuth={setUser} />;

  const needsVerification = !user.emailVerified && user.providerData[0]?.providerId === "password";

  return (
    <div style={s.root}>
      {isMobile && (
        <div style={s.mobileTopBar}>
          <button style={s.hamburgerBtn} onClick={() => setShowSidebar(v => !v)} aria-label="Toggle menu">☰</button>
          <span style={s.mobileTopBarTitle}>H.E.A.R.</span>
        </div>
      )}
      {needsVerification && <VerifyBanner user={user} />}
      {shareTarget && <ShareModal entry={shareTarget} user={user} onClose={() => setShareTarget(null)} />}
      {showInvite && (
        <div style={s.modalOverlay} onClick={() => setShowInvite(false)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>Invite a Friend</div>
            <div style={s.modalDesc}>Share the H.E.A.R. Bible Journal with someone you'd like to journal with.</div>
            <div style={{ marginBottom: 20 }}>
              <div style={s.filterLabel}>Share a link</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={{ ...s.authInput, marginBottom: 0, fontSize: 12, color: "#8a7a5a" }}
                  value={window.location.origin} readOnly />
                <button style={s.shareEntryBtn}
                  onClick={() => { navigator.clipboard.writeText(window.location.origin); }}>
                  Copy
                </button>
              </div>
            </div>
            <div style={s.divider}><span>or</span></div>
            <div style={{ marginBottom: 20 }}>
              <div style={s.filterLabel}>Send an email invite</div>
              <button style={{ ...s.saveBtn, display: "block", width: "100%", textAlign: "center", marginTop: 8, cursor: "pointer" }}
                onClick={() => {
                  const subject = encodeURIComponent("Join me on H.E.A.R. Bible Journal");
                  const body = encodeURIComponent("I've been using H.E.A.R. Bible Journal to study the Bible and wanted to invite you to join me. You can access it here: https://hearjournal.upshiftholdings.com\r\n\r\nOnce you create an account, I can share my journal entries with you directly in the app.");
                  window.location.href = `mailto:?subject=${subject}&body=${body}`;
                }}>
                Open Email App
              </button>
              <div style={{ fontSize: 11, color: "#8a7a5a", marginTop: 8 }}>
                If nothing opens, make sure Outlook is set as your default mail app in System Settings → Desktop & Dock → Default web browser (mail).
              </div>
            </div>
            <button style={s.cancelBtn} onClick={() => setShowInvite(false)}>Close</button>
          </div>
        </div>
      )}
      {showColorPicker && (
        <ColorPickerModal
          sharedUsers={sharedUsers.map(u => ({ ...u, label: getDisplayLabel(u.id, u.email) }))}
          colorMap={userColorMap}
          onSave={saveColorPrefs} onClose={() => setShowColorPicker(false)} />
      )}
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}

      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
        {isMobile && showSidebar && (
          <div style={s.sidebarBackdrop} onClick={() => setShowSidebar(false)} />
        )}
        <aside style={isMobile ? {
          ...s.sidebar,
          position: "fixed", top: 52, left: 0, bottom: 0, zIndex: 200, width: "85%", maxWidth: 320, minWidth: 0,
          boxSizing: "border-box",
          transform: showSidebar ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease",
          boxShadow: showSidebar ? "4px 0 20px rgba(0,0,0,0.3)" : "none",
        } : s.sidebar}>
          <div style={s.sidebarTop}>
            <div style={s.logoBlock}>
              <div style={s.logoText}>H.E.A.R.</div>
              <div style={s.logoSub}>Bible Journal</div>
            </div>
            <button style={s.newBtn} onClick={startNewEntry}>+ New Entry</button>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={s.inviteBtn} onClick={() => setShowInvite(true)}>✉ Invite a Friend</button>
              <button style={s.aboutBtn} onClick={() => setShowAbout(true)} title="About the H.E.A.R. Method">?</button>
            </div>
            <div style={s.tabRow}>
              <button style={{ ...s.tab, ...(sidebarTab === "mine" ? s.tabActive : {}) }} onClick={() => setSidebarTab("mine")}>My Journal</button>
              <button style={{ ...s.tab, ...(sidebarTab === "shared" ? s.tabActive : {}) }} onClick={() => setSidebarTab("shared")}>
                Shared{sharedUsers.length > 0 ? ` (${sharedUsers.length})` : ""}
              </button>
            </div>
          </div>

          <div style={s.filterBar}>
            <button
              style={{ ...s.filterToggleBtn, ...(showFilters ? s.filterToggleBtnActive : {}) }}
              onClick={() => setShowFilters(f => !f)}
            >
              ⚙ Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </button>
            <button style={s.colorBtn} onClick={toggleCompactView} title={compactView ? "Switch to card view" : "Switch to compact view"}>
              {compactView ? "▦" : "▤"}
            </button>
            {sharedUsers.length > 0 && (
              <button style={s.colorBtn} onClick={() => setShowColorPicker(true)} title="Set user colors">🎨</button>
            )}
          </div>

          {showFilters && (
            <FilterPanel
              filters={filters}
              onChange={setFilters}
              sharedUsers={sharedUsers}
              showMineOnly={showMineOnly}
              onToggleMineOnly={setShowMineOnly}
              sidebarTab={sidebarTab}
              onClose={() => setShowFilters(false)}
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
            />
          )}

          {/* Entry lists */}
          <div style={s.entryList}>
            {sidebarTab === "mine" && (
              <>
                {loadingEntries && <div style={s.sideMsg}>Loading...</div>}
                {!loadingEntries && filteredEntries.length === 0 && (
                  <div style={s.sideMsg}>{Object.keys(filters).length > 0 ? "No entries match your filters." : "No entries yet."}</div>
                )}
                {filteredEntries.map(e => (
                  <EntryCard key={e.id} entry={e}
                    onSelect={en => selectEntry(en, "read")}
                    onDelete={deleteEntry}
                    onShare={en => setShareTarget(en)}
                    isActive={selected?.id === e.id && view === "read"}
                    accentColor="#b5813a"
                    compact={compactView}
                  />
                ))}
              </>
            )}

            {sidebarTab === "shared" && (
              <>
                {sharedJournals.length > 0 && (
                  <div style={s.sharedSection}>
                    <div style={s.sharedSectionTitle}>Shared Journals</div>
                    {sharedJournals.map(j => (
                      <div key={j.id} style={s.sharedJournalCard}>
                        <div style={{ ...s.entryCardTitle, color: userColorMap[j.ownerId] || "#d4b97a" }}>{j.ownerEmail}</div>
                        <div style={s.entryCardDate}>Full journal access</div>
                      </div>
                    ))}
                  </div>
                )}

                {sharedUsers.length > 0 && (
                  <div style={s.sharedSection}>
                    <div style={s.sharedSectionTitle}>
                      {showMineOnly ? "Your entries" : `All entries · ${filteredSharedEntries.length} shown`}
                    </div>
                    {showMineOnly
                      ? filteredEntries.map(e => (
                          <EntryCard key={e.id} entry={e}
                            onSelect={en => selectEntry(en, "read")}
                            onDelete={deleteEntry}
                            onShare={en => setShareTarget(en)}
                            isActive={selected?.id === e.id}
                            accentColor="#b5813a"
                            compact={compactView}
                          />
                        ))
                      : filteredSharedEntries.map(e => (
                          <EntryCard key={e.id} entry={e}
                            onSelect={en => selectEntry(en, "sharedRead")}
                            onDelete={null} onShare={null}
                            isActive={selected?.id === e.id && view === "sharedRead"}
                            accentColor={getEntryAccent(e)}
                            ownerLabel={getDisplayLabel(e.sharedBy, e.sharedByEmail)}
                            compact={compactView}
                          />
                        ))
                    }
                    {(showMineOnly ? filteredEntries : filteredSharedEntries).length === 0 && (
                      <div style={s.sideMsg}>No entries match your filters.</div>
                    )}
                  </div>
                )}

                {sharedEntries.length === 0 && sharedJournals.length === 0 && (
                  <div style={s.sideMsg}>Nothing shared with you yet.</div>
                )}
              </>
            )}
          </div>

          <div style={s.sidebarFooter}>
            <span style={{ color: "#5a9a6a" }}>☁</span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 10 }}>{user.email}</span>
            <button style={s.signOutBtn} onClick={() => signOut(auth).then(() => { setUser(null); setEntries([]); })}>Sign out</button>
          </div>
        </aside>

        {/* Main panel */}
        <main style={s.main}>
          {view === "list" && (
            <div style={{ ...s.readView, ...(isMobile ? { padding: "20px 16px" } : {}) }}>
              <HearMethodContent />
            </div>
          )}

          {(view === "read" || view === "sharedRead") && selected && (
            <div style={{ ...s.readView, ...(isMobile ? { padding: "20px 16px" } : {}) }}>
              <div style={{ ...s.readHeader, ...(isMobile ? { flexWrap: "wrap", gap: 12 } : {}) }}>
                <div>
                  <div style={s.readDate}>{formatDate(selected.date)}</div>
                  <div style={{ ...s.readTitle, ...(isMobile ? { fontSize: 20 } : {}) }}>{selected.title || "Untitled"}</div>
                  <div style={s.readPassage}>{selected.passage} · {typeof selected.translation === "number"
                    ? ALL_TRANSLATIONS.find(t => t.id === selected.translation)?.label || selected.translation
                    : selected.translation?.toUpperCase()}
                  </div>
                  {view === "sharedRead" && (
                    <div style={{ ...s.sharedByLabel, color: getEntryAccent(selected) }}>Shared by {getDisplayLabel(selected.sharedBy, selected.sharedByEmail)}</div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {view === "read" && <button style={s.shareEntryBtn} onClick={() => setShareTarget(selected)}>⤴ Share</button>}
                  <button style={s.backBtn} onClick={() => { setView("list"); setSelected(null); if (isMobile) setShowSidebar(true); }}>← Back</button>
                </div>
              </div>

              {selected.verseText && (
                <div style={s.verseBox}><span style={s.verseQuote}>"</span>{selected.verseText}<span style={s.verseQuote}>"</span></div>
              )}

              {[
                { letter: "H", label: "Highlight", val: selected.highlight },
                { letter: "E", label: "Explain", val: selected.explain },
                { letter: "A", label: "Apply", val: selected.apply },
                { letter: "R", label: "Respond", val: selected.respond },
              ].map(({ letter, label, val }) => val
                ? <HearField key={letter} letter={letter} label={label} color={HEAR_COLORS[letter]} value={val} readOnly />
                : null
              )}

              <CommentSection entryId={selected.id} user={user} />
            </div>
          )}

          {view === "new" && (
            <div style={{ ...s.newView, ...(isMobile ? { padding: "20px 16px" } : {}) }}>
              <div style={{ ...s.newHeader, ...(isMobile ? { flexWrap: "wrap", gap: 8 } : {}) }}>
                <div style={{ ...s.newTitle, ...(isMobile ? { fontSize: 18 } : {}) }}>New Journal Entry</div>
                <div style={s.newDate}>{formatDate(new Date().toISOString())}</div>
              </div>
              <div style={{ ...s.passageRow, ...(isMobile ? { flexWrap: "wrap" } : {}) }}>
                <div style={{ ...s.passageInputWrap, ...(isMobile ? { minWidth: "100%" } : {}) }}>
                  <input style={s.passageInput} placeholder="Passage (e.g. John 3:16)" value={passage}
                    onChange={e => setPassage(e.target.value)} onKeyDown={e => e.key === "Enter" && fetchVerse_()} />
                  <select style={s.translationSelect} value={translation}
                    onChange={e => setTranslation(isNaN(e.target.value) ? e.target.value : parseInt(e.target.value))}>
                    {ALL_TRANSLATIONS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <button style={{ ...s.fetchBtn, ...(isMobile ? { flex: 1 } : {}) }} onClick={fetchVerse_} disabled={verseLoading}>{verseLoading ? "..." : "Fetch Verse"}</button>
              </div>
              <input style={s.titleInput} placeholder="Entry title (optional)" value={title} onChange={e => setTitle(e.target.value)} />
              <VerseDisplay text={verseText} loading={verseLoading} error={verseError} />
              {[
                { letter: "H", label: "Highlight — a verse that speaks to you", val: highlight, set: setHighlight },
                { letter: "E", label: "Explain — what does the verse mean?", val: explain, set: setExplain },
                { letter: "A", label: "Apply — how does this apply to your life?", val: apply, set: setApply },
                { letter: "R", label: "Respond — your prayer or commitment", val: respond, set: setRespond },
              ].map(({ letter, label, val, set }) => (
                <HearField key={letter} letter={letter} label={label} color={HEAR_COLORS[letter]} value={val} onChange={set} />
              ))}
              <div style={s.actionRow}>
                <button style={s.cancelBtn} onClick={() => { setView("list"); if (isMobile) setShowSidebar(true); }}>Cancel</button>
                <button style={{ ...s.saveBtn, opacity: (!passage || !highlight || saving) ? 0.5 : 1 }}
                  onClick={saveEntry} disabled={!passage || !highlight || saving}>
                  {saving ? "Saving..." : "Save to Cloud ☁"}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  root: { display: "flex", flexDirection: "column", height: "100vh", fontFamily: "'Georgia','Palatino Linotype',serif", background: "#f5f0e8", color: "#2c2416", overflow: "hidden" },
  loading: { display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontSize: 18, color: "#b5813a", fontFamily: "Georgia,serif" },
  authRoot: { display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f5f0e8", padding: 16, boxSizing: "border-box" },
  authCard: { background: "#fff", borderRadius: 12, padding: "40px 36px", width: "100%", maxWidth: 360, boxSizing: "border-box", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", fontFamily: "Georgia,serif" },
  authTitle: { fontSize: 18, fontWeight: 700, color: "#2c2416", margin: "24px 0 20px", textAlign: "center" },
  googleBtn: { width: "100%", minHeight: 44, padding: "11px 0", background: "#fff", border: "1.5px solid #d0c0a0", borderRadius: 7, fontSize: 14, fontFamily: "Georgia,serif", cursor: "pointer", color: "#2c2416", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" },
  divider: { textAlign: "center", color: "#c0b090", fontSize: 12, marginBottom: 16 },
  authInput: { width: "100%", minHeight: 44, padding: "10px 14px", border: "1.5px solid #d0c0a0", borderRadius: 7, fontSize: 16, fontFamily: "Georgia,serif", background: "#faf8f4", color: "#2c2416", marginBottom: 12, outline: "none", boxSizing: "border-box" },
  authBtn: { width: "100%", minHeight: 44, padding: "11px 0", background: "#b5813a", color: "#fff", border: "none", borderRadius: 7, fontSize: 14, fontFamily: "Georgia,serif", cursor: "pointer", marginTop: 4, boxSizing: "border-box" },
  authBtnSecondary: { width: "100%", minHeight: 44, padding: "10px 0", background: "none", color: "#b5813a", border: "1.5px solid #b5813a", borderRadius: 7, fontSize: 13, fontFamily: "Georgia,serif", cursor: "pointer", boxSizing: "border-box" },
  authError: { padding: "10px 12px", background: "#fdecea", border: "1px solid #f0c0c0", borderRadius: 6, fontSize: 13, color: "#b04040", marginBottom: 12 },
  authSwitch: { textAlign: "center", fontSize: 13, color: "#8a7a5a", marginTop: 16 },
  authLink: { color: "#b5813a", cursor: "pointer", textDecoration: "underline" },
  verifyBanner: { background: "#fff3cd", borderBottom: "1px solid #ffc107", padding: "10px 20px", fontSize: 13, color: "#856404", textAlign: "center" },
  sidebar: { width: 300, minWidth: 240, background: "#1e1710", display: "flex", flexDirection: "column", borderRight: "1px solid #3a2e1e", overflow: "hidden" },
  mobileTopBar: { display: "flex", alignItems: "center", gap: 12, padding: "6px 12px", background: "#1e1710", borderBottom: "1px solid #3a2e1e", flexShrink: 0, height: 52, boxSizing: "border-box" },
  hamburgerBtn: { background: "none", border: "1px solid #3a2e1e", borderRadius: 6, color: "#c8a96e", fontSize: 18, padding: 0, cursor: "pointer", lineHeight: 1, minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" },
  mobileTopBarTitle: { color: "#c8a96e", fontSize: 15, fontWeight: 700, letterSpacing: "0.14em", fontFamily: "Georgia,serif" },
  sidebarBackdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 150 },
  sidebarTop: { padding: "24px 20px 0", borderBottom: "1px solid #3a2e1e" },
  logoBlock: { marginBottom: 14 },
  logoText: { fontSize: 24, fontWeight: 700, letterSpacing: "0.18em", color: "#c8a96e", fontFamily: "Georgia,serif" },
  logoSub: { fontSize: 11, letterSpacing: "0.22em", color: "#7a6a50", textTransform: "uppercase", marginTop: 2 },
  newBtn: { width: "100%", padding: "10px 0", background: "#b5813a", color: "#fff", border: "none", borderRadius: 6, fontSize: 14, fontFamily: "Georgia,serif", cursor: "pointer", letterSpacing: "0.04em", marginBottom: 12 },
  tabRow: { display: "flex" },
  tab: { flex: 1, padding: "8px 0", background: "none", border: "none", borderBottom: "2px solid transparent", color: "#7a6a50", fontSize: 12, fontFamily: "Georgia,serif", cursor: "pointer", letterSpacing: "0.05em" },
  tabActive: { color: "#c8a96e", borderBottomColor: "#b5813a" },
  filterBar: { display: "flex", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid #2a2015", gap: 6 },
  filterToggleBtn: { flex: 1, padding: "6px 10px", background: "none", border: "1px solid #3a2e1e", borderRadius: 5, color: "#7a6a50", fontSize: 11, fontFamily: "Georgia,serif", cursor: "pointer", textAlign: "left" },
  filterToggleBtnActive: { background: "#2e2416", color: "#c8a96e", borderColor: "#b5813a" },
  colorBtn: { background: "none", border: "1px solid #3a2e1e", borderRadius: 5, padding: "5px 8px", cursor: "pointer", fontSize: 14 },
  filterPanel: { background: "#181310", borderBottom: "1px solid #2a2015", padding: "12px 16px" },
  filterHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  filterTitle: { fontSize: 11, color: "#7a6a50", letterSpacing: "0.1em", textTransform: "uppercase" },
  clearBtn: { fontSize: 11, color: "#b5813a", background: "none", border: "none", cursor: "pointer", fontFamily: "Georgia,serif", textDecoration: "underline" },
  filterCloseBtn: { background: "none", border: "none", color: "#7a6a50", cursor: "pointer", fontSize: 14, padding: 4, lineHeight: 1, minWidth: 28, minHeight: 28, display: "flex", alignItems: "center", justifyContent: "center" },
  filterRow: { marginBottom: 10 },
  filterLabel: { display: "block", fontSize: 11, color: "#7a6a50", marginBottom: 4, letterSpacing: "0.05em" },
  filterInput: { width: "100%", padding: "6px 8px", background: "#2a2015", border: "1px solid #3a2e1e", borderRadius: 5, color: "#d4b97a", fontSize: 12, fontFamily: "Georgia,serif", outline: "none", boxSizing: "border-box" },
  clearXBtn: { padding: "5px 8px", background: "none", border: "none", color: "#7a6a50", cursor: "pointer", fontSize: 12 },
  suggestions: { position: "absolute", top: "100%", left: 0, right: 0, background: "#2a2015", border: "1px solid #3a2e1e", borderRadius: 5, zIndex: 100, maxHeight: 150, overflowY: "auto" },
  suggestion: { padding: "7px 10px", fontSize: 12, color: "#d4b97a", cursor: "pointer", fontFamily: "Georgia,serif" },
  toggleRow: { display: "flex", gap: 4 },
  toggleBtn: { flex: 1, padding: "5px 0", background: "none", border: "1px solid #3a2e1e", borderRadius: 4, color: "#7a6a50", fontSize: 11, fontFamily: "Georgia,serif", cursor: "pointer" },
  toggleBtnActive: { background: "#b5813a", color: "#fff", borderColor: "#b5813a" },
  filterSummary: { display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 },
  filterTag: { background: "#2e2416", border: "1px solid #b5813a", borderRadius: 10, padding: "2px 8px", fontSize: 10, color: "#c8a96e" },
  applyFiltersBtn: { width: "100%", minHeight: 44, padding: "10px 0", background: "#b5813a", color: "#fff", border: "none", borderRadius: 7, fontSize: 14, fontFamily: "Georgia,serif", cursor: "pointer", letterSpacing: "0.04em", marginTop: 14, boxSizing: "border-box" },
  entryList: { flex: 1, overflowY: "auto", padding: "4px 0" },
  sideMsg: { padding: "16px 20px", fontSize: 13, color: "#7a6a50", fontStyle: "italic" },
  ownerLabel: { fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 },
  entryCard: { padding: "12px 12px 12px 14px", cursor: "pointer", borderBottom: "1px solid #2a2015", display: "flex", alignItems: "center", gap: 6, borderLeft: "3px solid transparent" },
  entryCardCompact: { padding: "8px 12px 8px 14px", cursor: "pointer", borderBottom: "1px solid #2a2015", display: "flex", alignItems: "center", gap: 8, borderLeft: "3px solid transparent" },
  entryCardCompactPassage: { fontSize: 12, color: "#d4b97a", fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 },
  entryCardCompactTitle: { fontSize: 12, color: "#8a7a5a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "right", flexShrink: 0, maxWidth: "45%" },
  entryCardCompactOwner: { fontSize: 12, fontWeight: 600, flex: 1, minWidth: 0, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  entryCardCompactSep: { color: "#5a4e3a", flexShrink: 0 },
  entryCardActive: { background: "#2e2416" },
  entryCardDate: { fontSize: 11, color: "#7a6a50", marginBottom: 3, letterSpacing: "0.05em" },
  entryCardTitle: { fontSize: 13, color: "#d4b97a", fontWeight: 600, marginBottom: 2 },
  entryCardPassage: { fontSize: 12, color: "#5a4e3a" },
  sharedBadge: { fontSize: 10, color: "#5a9a6a", background: "#1a2e1a", borderRadius: 3, padding: "1px 5px", display: "inline-block", marginTop: 3 },
  iconBtn: { background: "none", border: "none", color: "#5a4a3a", cursor: "pointer", fontSize: 15, padding: "6px 8px", borderRadius: 4, opacity: 0.7, minWidth: 32, minHeight: 32 },
  sharedSection: { padding: "4px 0" },
  sharedSectionTitle: { padding: "8px 20px 4px", fontSize: 10, color: "#7a6a50", letterSpacing: "0.1em", textTransform: "uppercase" },
  sharedJournalCard: { padding: "10px 20px", borderBottom: "1px solid #2a2015" },
  sidebarFooter: { padding: "10px 20px", fontSize: 11, color: "#5a4e3a", borderTop: "1px solid #3a2e1e", display: "flex", alignItems: "center", gap: 6 },
  signOutBtn: { background: "none", border: "none", color: "#7a6a50", fontSize: 11, cursor: "pointer", fontFamily: "Georgia,serif", textDecoration: "underline", whiteSpace: "nowrap" },
  main: { flex: 1, overflowY: "auto", background: "#faf6ee" },
  readView: { padding: "36px 48px", maxWidth: 720, margin: "0 auto" },
  readHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, paddingBottom: 18, borderBottom: "1px solid #e0d8c8" },
  readDate: { fontSize: 12, color: "#a09070", letterSpacing: "0.08em", marginBottom: 4 },
  readTitle: { fontSize: 24, fontWeight: 700, color: "#2c2416", marginBottom: 4 },
  readPassage: { fontSize: 13, color: "#8a7a5a", letterSpacing: "0.05em" },
  sharedByLabel: { fontSize: 12, marginTop: 4 },
  backBtn: { background: "none", border: "1px solid #d0c8b8", borderRadius: 5, padding: "7px 14px", fontSize: 13, color: "#8a7a5a", cursor: "pointer", fontFamily: "Georgia,serif", whiteSpace: "nowrap" },
  shareEntryBtn: { background: "#f0e8d4", border: "1px solid #d0c0a0", borderRadius: 5, padding: "7px 14px", fontSize: 13, color: "#b5813a", cursor: "pointer", fontFamily: "Georgia,serif", whiteSpace: "nowrap" },
  readText: { fontSize: 15, lineHeight: 1.75, color: "#3a3020", margin: 0 },
  newView: { padding: "36px 48px", maxWidth: 720, margin: "0 auto" },
  newHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid #e0d8c8" },
  newTitle: { fontSize: 22, fontWeight: 700, color: "#2c2416" },
  newDate: { fontSize: 12, color: "#a09070", letterSpacing: "0.08em" },
  passageRow: { display: "flex", gap: 10, marginBottom: 12, alignItems: "stretch" },
  passageInputWrap: { flex: 1, display: "flex", border: "1.5px solid #d0c0a0", borderRadius: 7, overflow: "hidden", background: "#fff" },
  passageInput: { flex: 1, minWidth: 0, padding: "11px 14px", border: "none", outline: "none", fontSize: 16, fontFamily: "Georgia,serif", background: "transparent", color: "#2c2416" },
  translationSelect: { border: "none", borderLeft: "1.5px solid #d0c0a0", background: "#f5f0e8", padding: "0 10px", fontSize: 12, color: "#7a6a50", fontFamily: "Georgia,serif", cursor: "pointer", outline: "none" },
  fetchBtn: { padding: "11px 20px", background: "#2c2416", color: "#c8a96e", border: "none", borderRadius: 7, fontSize: 14, fontFamily: "Georgia,serif", cursor: "pointer", letterSpacing: "0.04em", whiteSpace: "nowrap" },
  titleInput: { width: "100%", minHeight: 44, padding: "10px 14px", border: "1.5px solid #d0c0a0", borderRadius: 7, fontSize: 16, fontFamily: "Georgia,serif", background: "#fff", color: "#2c2416", marginBottom: 16, outline: "none", boxSizing: "border-box" },
  verseBox: { background: "#f0e8d4", border: "1px solid #d8c8a0", borderRadius: 8, padding: "16px 20px", fontSize: 15, fontStyle: "italic", lineHeight: 1.7, color: "#4a3c24", marginBottom: 20 },
  verseQuote: { fontSize: 22, color: "#b5813a", fontStyle: "normal", lineHeight: 1 },
  verseError: { background: "#fdecea", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#b04040", marginBottom: 16, border: "1px solid #f0c0c0" },
  hearField: { borderLeft: "3px solid #ccc", paddingLeft: 16, marginBottom: 20 },
  hearLabelRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 },
  hearLetter: { fontSize: 22, fontWeight: 700, lineHeight: 1, fontFamily: "Georgia,serif" },
  hearLabel: { fontSize: 12, color: "#8a7a5a", letterSpacing: "0.06em", textTransform: "uppercase" },
  hearTextarea: { width: "100%", padding: "10px 12px", border: "1.5px solid #d0c0a0", borderRadius: 6, fontSize: 16, fontFamily: "Georgia,serif", color: "#2c2416", background: "#fff", resize: "vertical", lineHeight: 1.65, outline: "2px solid transparent", outlineOffset: 2, boxSizing: "border-box" },
  actionRow: { display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 28, paddingTop: 20, borderTop: "1px solid #e0d8c8" },
  cancelBtn: { padding: "10px 22px", background: "none", border: "1.5px solid #d0c0a0", borderRadius: 7, fontSize: 14, color: "#8a7a5a", fontFamily: "Georgia,serif", cursor: "pointer" },
  saveBtn: { padding: "10px 28px", background: "#b5813a", color: "#fff", border: "none", borderRadius: 7, fontSize: 14, fontFamily: "Georgia,serif", cursor: "pointer", letterSpacing: "0.04em", transition: "opacity 0.15s" },
  commentSection: { marginTop: 32, paddingTop: 24, borderTop: "1px solid #e0d8c8" },
  commentTitle: { fontSize: 13, fontWeight: 700, color: "#8a7a5a", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 },
  comment: { marginBottom: 14, padding: "12px 14px", background: "#f0e8d4", borderRadius: 7 },
  commentAuthor: { fontSize: 12, fontWeight: 700, color: "#b5813a", marginBottom: 4 },
  commentText: { fontSize: 14, color: "#3a3020", lineHeight: 1.6 },
  commentInputRow: { display: "flex", gap: 8, marginTop: 12 },
  commentInput: { flex: 1, padding: "9px 12px", border: "1.5px solid #d0c0a0", borderRadius: 6, fontSize: 14, fontFamily: "Georgia,serif", color: "#2c2416", background: "#fff", outline: "none" },
  commentBtn: { padding: "9px 18px", background: "#2c2416", color: "#c8a96e", border: "none", borderRadius: 6, fontSize: 13, fontFamily: "Georgia,serif", cursor: "pointer" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16, boxSizing: "border-box" },
  modalCard: { background: "#fff", borderRadius: 12, padding: "36px 32px", width: "100%", maxWidth: 380, boxSizing: "border-box", boxShadow: "0 8px 40px rgba(0,0,0,0.15)", fontFamily: "Georgia,serif" },
  modalTitle: { fontSize: 20, fontWeight: 700, color: "#2c2416", marginBottom: 8 },
  modalDesc: { fontSize: 13, color: "#8a7a5a", lineHeight: 1.6, marginBottom: 20 },
  shareTypeRow: { display: "flex", gap: 8, marginBottom: 16 },
  shareTypeBtn: { flex: 1, padding: "9px 0", background: "#f5f0e8", border: "1.5px solid #d0c0a0", borderRadius: 6, fontSize: 13, fontFamily: "Georgia,serif", cursor: "pointer", color: "#8a7a5a" },
  shareTypeBtnActive: { background: "#b5813a", color: "#fff", borderColor: "#b5813a" },
  inviteBtn: { flex: 1, padding: "8px 0", background: "none", border: "1px solid #b5813a", borderRadius: 6, fontSize: 13, fontFamily: "Georgia,serif", cursor: "pointer", color: "#b5813a", letterSpacing: "0.04em", marginBottom: 12 },
  aboutBtn: { width: 36, padding: "8px 0", background: "none", border: "1px solid #b5813a", borderRadius: 6, fontSize: 13, fontWeight: 700, fontFamily: "Georgia,serif", cursor: "pointer", color: "#b5813a", marginBottom: 12 },
};
