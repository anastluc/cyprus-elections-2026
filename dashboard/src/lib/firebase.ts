import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBKEZQy8Yl1pPvXsUr9i7yGMRk1BmG_4gk',
  authDomain: 'cyprus-elections-2026.firebaseapp.com',
  projectId: 'cyprus-elections-2026',
  storageBucket: 'cyprus-elections-2026.firebasestorage.app',
  messagingSenderId: '1072903990680',
  appId: '1:1072903990680:web:a0b4f0e2c0d1e2f3a4b5c6',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export const predictionsCol = collection(db, 'predictions');

export async function savePredictionToFirebase(id: string, data: Record<string, unknown>) {
  await setDoc(doc(db, 'predictions', id), data);
}

export async function loadPredictionFromFirebase(id: string) {
  const snap = await getDoc(doc(db, 'predictions', id));
  if (!snap.exists()) return null;
  return snap.data();
}

export async function listPredictionsFromFirebase(max = 100) {
  const q = query(predictionsCol, orderBy('timestamp', 'desc'), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
