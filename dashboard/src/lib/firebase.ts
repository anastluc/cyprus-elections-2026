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
  apiKey: "AIzaSyDmwj-BEeUpa-xaJQDz_4r3kfZMQhjDhF8",
  authDomain: "cyprus-elections-2026.firebaseapp.com",
  projectId: "cyprus-elections-2026",
  storageBucket: "cyprus-elections-2026.firebasestorage.app",
  messagingSenderId: "101847253943",
  appId: "1:101847253943:web:6656487f5d66132df35e32",
  measurementId: "G-64QSFCL8CJ"
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
