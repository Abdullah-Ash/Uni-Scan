"use client";
import React, { useState, useEffect } from 'react';
import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, set, onValue, get, remove } from "firebase/database";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, getDocs, where } from "firebase/firestore";
import QRCode from "react-qr-code";
import { MapPin, ShieldCheck, User, School, RefreshCw, Trash2, CheckCircle2, XCircle } from "lucide-react";

const firebaseConfig = {
    apiKey: "AIzaSyDYAhZwf97ukgzWvkhKHGayt1HPgkC8_90",
    authDomain: "scanfrr.firebaseapp.com",
    projectId: "scanfrr",
    storageBucket: "scanfrr.appspot.com",
    messagingSenderId: "59816099239",
    appId: "1:59816099239:web:46f78a84c602ed3070ca82",
    measurementId: "G-7XQ7C8PCXM"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const rtdb = getDatabase(app);
const db = getFirestore(app);

export default function AttendanceApp() {
  const [role, setRole] = useState<'none' | 'professor' | 'student'>('none');
  const [token, setToken] = useState("");
  const [profLocation, setProfLocation] = useState<{lat: number, lng: number} | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [stuInfo, setStuInfo] = useState({ name: "", id: "" });
  const [msg, setMsg] = useState({ text: "Ready to scan", type: "neutral" });

  // Load student info from local storage (Save time!)
  useEffect(() => {
    const saved = localStorage.getItem('stu_data');
    if (saved) setStuInfo(JSON.parse(saved));
  }, []);

  // --- PROFESSOR LOGIC ---
  useEffect(() => {
    if (role !== 'professor' || !profLocation) return;
    const interval = setInterval(() => {
      const newToken = Math.random().toString(36).substring(7).toUpperCase();
      setToken(newToken);
      set(ref(rtdb, 'active_session'), { token: newToken, lat: profLocation.lat, lng: profLocation.lng, time: Date.now() });
    }, 3000);

    const q = query(collection(db, "attendance"), orderBy("timestamp", "desc"));
    return onSnapshot(q, (snap) => setStudents(snap.docs.map(doc => ({id: doc.id, ...doc.data()}))));
  }, [role, profLocation]);

  const clearAttendance = async () => {
    if(confirm("Clear all attendance logs?")) {
      const q = query(collection(db, "attendance"));
      const snap = await getDocs(q);
      // In a real app, you'd delete them, but for this demo we just notify
      alert("Database cleaning is best done via Firebase Console for safety.");
    }
  };

  // --- STUDENT LOGIC ---
  const startScanner = async () => {
    if (!stuInfo.name || !stuInfo.id) return alert("Please enter your name and ID.");
    localStorage.setItem('stu_data', JSON.stringify(stuInfo));
    
    const { Html5QrcodeScanner } = await import("html5-qrcode");
    const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
    
    scanner.render(async (decodedText) => {
      try {
          const data = JSON.parse(decodedText);
          setMsg({ text: "Verifying...", type: "neutral" });
          
          const snap = await get(ref(rtdb, 'active_session'));
          const session = snap.val();

          // Check Token
          if (session.token !== data.token) {
            setMsg({ text: "❌ QR Expired! Wait for the next one.", type: "error" });
            return;
          }

          // Check if already marked
          const existing = students.find(s => s.studentId === stuInfo.id);
          if (existing) {
             setMsg({ text: "⚠️ You have already marked attendance!", type: "error" });
             scanner.clear();
             return;
          }

          // Check GPS
          navigator.geolocation.getCurrentPosition(async (pos) => {
            const dist = calculateDistance(pos.coords.latitude, pos.coords.longitude, data.lat, data.lng);
            
            if (dist > 0.1) { // 100 Meters
              setMsg({ text: `❌ Too far! You are ${(dist * 1000).toFixed(0)}m away.`, type: "error" });
            } else {
              await addDoc(collection(db, "attendance"), { ...stuInfo, studentId: stuInfo.id, timestamp: serverTimestamp() });
              setMsg({ text: "✅ Success! Attendance Marked.", type: "success" });
              scanner.clear();
            }
          }, () => alert("Enable GPS to mark attendance"));
      } catch (e) {
          setMsg({ text: "Invalid QR Code", type: "error" });
      }
    }, () => {});
  };

  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  // --- STYLING HELPERS ---
  const cardClass = "bg-white p-6 rounded-3xl shadow-xl border border-slate-200";

  if (role === 'none') return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="text-center mb-10">
        <div className="bg-indigo-600 p-4 rounded-3xl inline-block mb-4 shadow-lg shadow-indigo-200">
            <School size={48} className="text-white" />
        </div>
        <h1 className="text-4xl font-black tracking-tight italic">UNI-SCAN</h1>
        <p className="text-slate-500 font-medium">Secure Presence Protocol</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
        <button onClick={() => setRole('professor')} className="p-8 bg-white border-2 border-slate-100 rounded-3xl flex flex-col items-center hover:border-indigo-500 hover:scale-105 transition-all">
          <ShieldCheck size={32} className="text-indigo-600 mb-2" />
          <span className="font-bold text-lg">Professor</span>
        </button>
        <button onClick={() => setRole('student')} className="p-8 bg-white border-2 border-slate-100 rounded-3xl flex flex-col items-center hover:border-emerald-500 hover:scale-105 transition-all">
          <User size={32} className="text-emerald-600 mb-2" />
          <span className="font-bold text-lg">Student</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900 font-sans">
        <div className="max-w-4xl mx-auto flex justify-between items-center mb-6">
            <button onClick={() => setRole('none')} className="flex items-center gap-2 text-slate-500 font-bold bg-white px-4 py-2 rounded-full shadow-sm">← Exit</button>
            <div className="text-xs font-black uppercase tracking-widest text-slate-400">University System v3.0</div>
        </div>

      {role === 'professor' ? (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className={`${cardClass} text-center relative overflow-hidden`}>
            <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600"></div>
            <h2 className="text-2xl font-bold mb-4">Lecture Session</h2>
            {!profLocation ? (
              <button onClick={captureClassroomLocation} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 mx-auto hover:bg-indigo-700 transition">
                <MapPin size={20} /> Open Classroom Here
              </button>
            ) : (
              <div className="flex flex-col items-center">
                <div className="p-6 bg-white border-[12px] border-slate-50 rounded-3xl shadow-inner mb-4">
                    {token && <QRCode value={JSON.stringify({token, lat: profLocation.lat, lng: profLocation.lng})} size={220} level="H" />}
                </div>
                <div className="flex items-center gap-2 text-indigo-600 font-mono font-bold bg-indigo-50 px-4 py-1 rounded-full">
                   <RefreshCw size={14} className="animate-spin" /> {token}
                </div>
              </div>
            )}
          </div>

          <div className={cardClass}>
             <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-xl uppercase tracking-tighter">Verified Logs ({students.length})</h3>
                <button onClick={clearAttendance} className="text-rose-500 p-2 hover:bg-rose-50 rounded-lg transition"><Trash2 size={20} /></button>
             </div>
             <div className="space-y-3">
                {students.map((s, i) => (
                    <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center gap-3">
                            <div className="bg-emerald-100 p-2 rounded-full text-emerald-600"><CheckCircle2 size={18}/></div>
                            <div>
                                <p className="font-bold text-slate-800 leading-none">{s.name}</p>
                                <p className="text-xs text-slate-500 mt-1 font-mono uppercase">{s.studentId}</p>
                            </div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-1 rounded-md border shadow-sm">
                            {s.timestamp?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                    </div>
                ))}
                {students.length === 0 && <p className="text-center py-10 text-slate-400 italic">Waiting for students to scan...</p>}
             </div>
          </div>
        </div>
      ) : (
        <div className="max-w-md mx-auto space-y-4">
          <div className={cardClass}>
            <h2 className="text-2xl font-black mb-6 tracking-tight">STUDENT PORTAL</h2>
            <div className="space-y-3 mb-6">
                <div className="relative">
                    <User className="absolute left-3 top-3.5 text-slate-400" size={18} />
                    <input value={stuInfo.name} placeholder="Full Name" onChange={e => setStuInfo({...stuInfo, name: e.target.value})} className="w-full pl-10 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 ring-indigo-500 outline-none transition" />
                </div>
                <div className="relative">
                    <School className="absolute left-3 top-3.5 text-slate-400" size={18} />
                    <input value={stuInfo.id} placeholder="Student ID Number" onChange={e => setStuInfo({...stuInfo, id: e.target.value})} className="w-full pl-10 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 ring-indigo-500 outline-none transition" />
                </div>
            </div>
            
            <div id="reader" className="overflow-hidden rounded-3xl bg-slate-900 shadow-inner border-4 border-white aspect-square"></div>
            
            <button onClick={startScanner} className="w-full mt-6 bg-slate-900 text-white p-4 rounded-2xl font-bold shadow-lg hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2">
                Launch Scanner
            </button>
            
            <div className={`mt-6 p-4 rounded-2xl flex items-center gap-3 ${
                msg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 
                msg.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-slate-50 text-slate-600'
            }`}>
                {msg.type === 'success' ? <CheckCircle2 size={20}/> : msg.type === 'error' ? <XCircle size={20}/> : <RefreshCw size={20} className="animate-spin-slow"/>}
                <p className="font-bold text-sm leading-tight">{msg.text}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}