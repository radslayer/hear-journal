import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBaF6KSZRTCe_Ifft_Olv6ENPv1jTWx8rg',
  authDomain: 'hear-bible-study-56f67.firebaseapp.com',
  projectId: 'hear-bible-study-56f67',
  storageBucket: 'hear-bible-study-56f67.firebasestorage.app',
  messagingSenderId: '1000066720489',
  appId: '1:1000066720489:web:767ce84bceed68e96e0678',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const UID = 'FX0V9MN6d9U9QiIWqU5gi394V8v2';
const OLD_IDS = ['0o4c4o7bR82UCyZYC9qS', '8z0VO9VR2GeVyQXS2d11'];

async function migrate() {
  for (const id of OLD_IDS) {
    const oldRef = doc(db, 'entries', id);
    const snap = await getDoc(oldRef);
    if (snap.exists() === false) { console.log('Not found:', id); continue; }
    const data = snap.data();
    const newRef = doc(db, 'users', UID, 'entries', id);
    await setDoc(newRef, { ...data, ownerEmail: 'rodsalyer@gmail.com', sharedWith: [] });
    await deleteDoc(oldRef);
    console.log('Migrated:', id);
  }
  console.log('Done!');
  process.exit(0);
}

migrate().catch(e => { console.error(e); process.exit(1); });
