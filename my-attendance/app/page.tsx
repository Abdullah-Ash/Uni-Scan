"use client";
import React, { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, get } from "firebase/database";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from "firebase/firestore";
import QRCode from "react-qr-code";
import { Html5QrcodeScanner } from "html5-qrcode";
import { MapPin, ShieldCheck, User, School, RefreshCw } from "lucide-react";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDYAhZWf97ukgzWvkhKHGayt1HPgkC8_90",
  authDomain: "scanfrr.firebaseapp.com",
  projectId: "scanfrr",
  storageBucket: "scanfrr.firebasestorage.app",
  messagingSenderId: "59816099239",
  appId: "1:59816099239:web:46f78a84c602ed3070ca82",
  measurementId: "G-7XQ7C8PCXM"
};

const app = initializeApp(firebaseConfig);
const rtdb = getDatabase(app);
const db = getFirestore(app);

export default function AttendanceApp() {
  const [role, setRole] = useState<'none' | 'professor' | 'student'>('none');
  const [token, setToken] = useState("");
  const [profLocation, setProfLocation] = useState<{lat: number, lng: number} | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [stuInfo, setStuInfo] = useState({ name: "", id: "" });
  const [msg, setMsg] = useState("Ready");

  // --- PROFESSOR LOGIC ---
  useEffect(() => {
    if (role !== 'professor') return;
    
    // Rotate QR Token every 3 seconds
    const interval = setInterval(() => {
      const newToken = Math.random().toString(36).substring(7);
      setToken(newToken);
      set(ref(rtdb, 'active_session'), { 
        token: newToken, 
        lat: profLocation?.lat, 
        lng: profLocation?.lng 
      });
    }, 3000);

    // Watch live attendance
    const q = query(collection(db, "attendance"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setStudents(snap.docs.map(doc => doc.data()));
    });

    return () => { clearInterval(interval); unsub(); };
  }, [role, profLocation]);

  const captureClassroomLocation = () => {
    navigator.geolocation.getCurrentPosition((pos) => {
      setProfLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      alert("Classroom Location Fixed!");
    });
  };

  // --- STUDENT LOGIC ---
  const startScanner = () => {
    if (!stuInfo.name || !stuInfo.id) return alert("Fill details first");
    const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
    scanner.render(async (decodedText) => {
      const data = JSON.parse(decodedText);
      setMsg("Verifying location and token...");
      
      // 1. Check Token
      const snap = await get(ref(rtdb, 'active_session'));
      if (snap.val().token !== data.token) {
        setMsg("❌ QR Expired!");
        return;
      }

      // 2. Check GPS (Haversine Formula)
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const dist = calculateDistance(pos.coords.latitude, pos.coords.longitude, data.lat, data.lng);
        if (dist > 0.05) { // 50 Meters
          setMsg("❌ You are too far from the classroom!");
        } else {
          await addDoc(collection(db, "attendance"), { ...stuInfo, timestamp: serverTimestamp() });
          setMsg("✅ Success! Attendance Marked.");
          scanner.clear();
        }
      });
    }, () => {});
  };

  function calculateDistance(lat1:any, lon1:any, lat2:any, lon2:any) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  // --- UI VIEWS ---
  if (role === 'none') return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 p-6">
      <School size={64} className="text-indigo-600 mb-4" />
      <h1 className="text-3xl font-bold mb-8 text-slate-800">University Attendance</h1>
      <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
        <button onClick={() => setRole('professor')} className="p-6 bg-white border-2 border-indigo-500 rounded-2xl flex flex-col items-center hover:bg-indigo-50 transition">
          <ShieldCheck className="text-indigo-600 mb-2" />
          <span className="font-bold">Professor</span>
        </button>
        <button onClick={() => setRole('student')} className="p-6 bg-white border-2 border-emerald-500 rounded-2xl flex flex-col items-center hover:bg-emerald-50 transition">
          <User className="text-emerald-600 mb-2" />
          <span className="font-bold">Student</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      {role === 'professor' ? (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-white p-8 rounded-3xl shadow-sm text-center border">
            <h2 className="text-xl font-bold mb-4">Classroom Monitor</h2>
            {!profLocation ? (
              <button onClick={captureClassroomLocation} className="bg-orange-500 text-white px-6 py-2 rounded-full flex items-center gap-2 mx-auto">
                <MapPin size={18} /> Set Classroom Location
              </button>
            ) : (
              <div className="flex flex-col items-center">
                <div className="p-4 bg-white border-4 border-slate-100 rounded-xl mb-4">
                  <QRCode value={JSON.stringify({token, lat: profLocation.lat, lng: profLocation.lng})} size={200} />
                </div>
                <div className="flex items-center gap-2 text-indigo-600 font-mono text-sm animate-pulse">
                  <RefreshCw size={14} /> Rotating Token: {token}
                </div>
              </div>
            )}
          </div>
          <div className="bg-white rounded-3xl shadow-sm border overflow-hidden">
            <div className="bg-slate-800 text-white p-4 font-bold uppercase text-xs tracking-widest">Live Logs</div>
            <div className="divide-y max-h-64 overflow-y-auto">
              {students.map((s, i) => (
                <div key={i} className="p-4 flex justify-between">
                  <span>{s.name} <span className="text-slate-400">({s.id})</span></span>
                  <span className="text-emerald-500 font-bold">Present</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-md mx-auto space-y-4">
          <div className="bg-white p-6 rounded-3xl shadow-sm border">
            <h2 className="text-xl font-bold mb-4">Student Check-in</h2>
            <input placeholder="Your Full Name" onChange={e => setStuInfo({...stuInfo, name: e.target.value})} className="w-full mb-2 p-3 border rounded-xl" />
            <input placeholder="Student ID" onChange={e => setStuInfo({...stuInfo, id: e.target.value})} className="w-full mb-4 p-3 border rounded-xl" />
            <div id="reader" className="overflow-hidden rounded-xl border"></div>
            <button onClick={startScanner} className="w-full mt-4 bg-emerald-600 text-white p-4 rounded-xl font-bold">Start Scanning</button>
            <p className="text-center mt-4 text-sm font-medium text-slate-500">{msg}</p>
          </div>
        </div>
      )}
      <button onClick={() => setRole('none')} className="block mx-auto mt-8 text-slate-400 text-sm">Back to Home</button>
    </div>
  );
}