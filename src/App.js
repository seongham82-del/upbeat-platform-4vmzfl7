import React, { useState, useEffect } from "react";
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Plus,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  UserCircle2,
  LogOut,
  Check,
  X,
  HelpCircle,
  MapPin,
  Trash2,
  Settings,
} from "lucide-react";

// === Firebase 실시간 연동 도구 불러오기 ===
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  deleteField,
} from "firebase/firestore";

// 👇 보내주신 넷볼 동아리 전용 Firebase 설정 키 👇
const firebaseConfig = {
  apiKey: "AIzaSyBZBDmb1GDozLbQkKIZzrUwyQTCMZzcSYE",
  authDomain: "netter-dc342.firebaseapp.com",
  projectId: "netter-dc342",
  storageBucket: "netter-dc342.firebasestorage.app",
  messagingSenderId: "279269370081",
  appId: "1:279269370081:web:25459726af9de2d0b52fa0",
};

// Firebase 실행 및 데이터베이스(db) 연결
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ==========================================
// 1. 최상위 App 컴포넌트 (데이터베이스 관리)
// ==========================================
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);

  // 클라우드 서버와 동기화될 상태들
  const [allUsers, setAllUsers] = useState([]);
  const [trainings, setTrainings] = useState([]);
  const [reservations, setReservations] = useState({});
  const [schedules, setSchedules] = useState([]);

  // Firebase 실시간 리스너 (서버의 데이터가 바뀌면 내 화면도 즉시 바뀜)
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      setAllUsers(snap.docs.map((d) => d.data()));
    });
    const unsubTrainings = onSnapshot(collection(db, "trainings"), (snap) => {
      setTrainings(
        snap.docs
          .map((d) => d.data())
          .sort((a, b) => new Date(a.date) - new Date(b.date))
      );
    });
    const unsubSchedules = onSnapshot(collection(db, "schedules"), (snap) => {
      setSchedules(snap.docs.map((d) => d.data()));
    });
    const unsubReservations = onSnapshot(
      doc(db, "system", "reservations"),
      (snap) => {
        if (snap.exists()) setReservations(snap.data());
        else setReservations({});
      }
    );

    return () => {
      unsubUsers();
      unsubTrainings();
      unsubSchedules();
      unsubReservations();
    };
  }, []);

  // 자동 로그인 로직 및 관리자에 의한 정보 변경/삭제 실시간 감지
  useEffect(() => {
    const savedId = localStorage.getItem("netter_student_id");

    if (allUsers.length > 0) {
      if (!currentUser && savedId) {
        // 첫 로딩 시 로컬스토리지 학번으로 로그인
        const user = allUsers.find((u) => u.studentId === savedId);
        if (user) setCurrentUser(user);
      } else if (currentUser) {
        // 이미 로그인 중인데, 서버에서 내 정보가 바뀌었거나 삭제되었을 경우
        const serverMe = allUsers.find(
          (u) => u.studentId === currentUser.studentId
        );
        if (!serverMe) {
          alert("관리자에 의해 계정이 삭제(추방)되었습니다.");
          setCurrentUser(null);
          localStorage.removeItem("netter_student_id");
        } else if (
          serverMe.role !== currentUser.role ||
          serverMe.name !== currentUser.name
        ) {
          setCurrentUser(serverMe); // 이름이나 권한이 변경되면 즉시 내 화면에도 반영
        }
      }
    }
  }, [allUsers, currentUser]);

  // 회원가입 및 첫 로그인 (Firebase 저장)
  const handleAuth = async (studentId, name, role) => {
    const existingUser = allUsers.find((u) => u.studentId === studentId);
    let userObj;
    if (existingUser) {
      userObj = {
        ...existingUser,
        name: name || existingUser.name,
        role: existingUser.role,
      }; // 기존 회원이면 로그인 처리
    } else {
      userObj = { id: `u${Date.now()}`, studentId, name, role }; // 신규 가입
    }
    // 클라우드 서버의 'users' 서랍에 내 정보 저장
    await setDoc(doc(db, "users", studentId), userObj, { merge: true });
    setCurrentUser(userObj);
  };

  // 클라우드 서버 데이터 조작 함수들
  const fbAddTraining = async (training) =>
    setDoc(doc(db, "trainings", training.id.toString()), training);
  const fbDeleteTraining = async (id) =>
    deleteDoc(doc(db, "trainings", id.toString()));
  const fbUpdateTrainingVote = async (id, attendees, absentees, undecided) => {
    setDoc(
      doc(db, "trainings", id.toString()),
      { attendees, absentees, undecided },
      { merge: true }
    );
  };

  const fbAddReservation = async (key, name) =>
    setDoc(doc(db, "system", "reservations"), { [key]: name }, { merge: true });
  const fbDeleteReservation = async (key) =>
    setDoc(
      doc(db, "system", "reservations"),
      { [key]: deleteField() },
      { merge: true }
    );

  const fbAddSchedule = async (schedule) =>
    setDoc(doc(db, "schedules", schedule.id.toString()), schedule);
  const fbDeleteSchedule = async (id) =>
    deleteDoc(doc(db, "schedules", id.toString()));

  // 부원 관리용 함수 (관리자 전용)
  const fbUpdateUser = async (studentId, updatedData) =>
    setDoc(doc(db, "users", studentId), updatedData, { merge: true });
  const fbDeleteUser = async (studentId) =>
    deleteDoc(doc(db, "users", studentId));

  // 아직 로그인을 안 했다면 로그인 화면 띄우기
  if (!currentUser) {
    return <AuthScreen onAuth={handleAuth} />;
  }

  // 로그인에 성공했다면 메인 화면 띄우기
  return (
    <MainApp
      currentUser={currentUser}
      onLogout={() => {
        setCurrentUser(null);
        localStorage.removeItem("netter_student_id");
      }}
      allUsers={allUsers}
      trainings={trainings}
      reservations={reservations}
      schedules={schedules}
      fbAddTraining={fbAddTraining}
      fbDeleteTraining={fbDeleteTraining}
      fbUpdateTrainingVote={fbUpdateTrainingVote}
      fbAddReservation={fbAddReservation}
      fbDeleteReservation={fbDeleteReservation}
      fbAddSchedule={fbAddSchedule}
      fbDeleteSchedule={fbDeleteSchedule}
      fbUpdateUser={fbUpdateUser}
      fbDeleteUser={fbDeleteUser}
    />
  );
}

// ==========================================
// 2. 로그인 & 회원가입 화면
// ==========================================
function AuthScreen({ onAuth }) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("member");
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    const savedId = localStorage.getItem("netter_remembered_id");
    if (savedId) {
      setStudentId(savedId);
      setRemember(true);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!studentId.trim()) return;

    if (remember) {
      localStorage.setItem("netter_remembered_id", studentId.trim());
    } else {
      localStorage.removeItem("netter_remembered_id");
    }

    if (isRegisterMode) {
      if (!name.trim()) return;
      onAuth(studentId.trim(), name.trim(), role);
    } else {
      onAuth(studentId.trim(), null, null);
    }

    localStorage.setItem("netter_student_id", studentId.trim());
  };

  return (
    <div className="min-h-screen bg-emerald-900 flex flex-col items-center justify-center p-4 font-sans selection:bg-emerald-500 selection:text-white">
      {/* 둥근 이미지 로고 대신 텍스트 타이포그래피 적용 */}
      <div className="mb-10 text-center">
        <h1 className="text-white font-black text-6xl tracking-tighter drop-shadow-lg">
          NETTER
        </h1>
        <p className="text-emerald-300 font-bold text-sm tracking-widest mt-2 uppercase">
          Netball Club
        </p>
      </div>

      <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl">
        <div className="flex border-b border-slate-100 pb-4 mb-6">
          <button
            type="button"
            onClick={() => setIsRegisterMode(false)}
            className={`flex-1 pb-2 font-black text-base transition-colors border-b-2 ${
              !isRegisterMode
                ? "text-emerald-700 border-emerald-600"
                : "text-slate-300 border-transparent"
            }`}
          >
            기존 부원 로그인
          </button>
          <button
            type="button"
            onClick={() => setIsRegisterMode(true)}
            className={`flex-1 pb-2 font-black text-base transition-colors border-b-2 ${
              isRegisterMode
                ? "text-emerald-700 border-emerald-600"
                : "text-slate-300 border-transparent"
            }`}
          >
            신규 등록
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              학번
            </label>
            <input
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="예: 20260001"
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-emerald-500 font-bold text-slate-800 transition-colors"
              required
            />
          </div>

          {isRegisterMode && (
            <>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  이름 (실명)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="홍길동"
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-emerald-500 font-bold text-slate-800 transition-colors"
                  required={isRegisterMode}
                />
              </div>

              <div className="pt-2">
                <label className="block text-sm font-bold text-slate-700 mb-3">
                  가입 유형
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole("member")}
                    className={`p-4 rounded-2xl font-bold flex flex-col items-center gap-2 border-2 transition-all ${
                      role === "member"
                        ? "border-emerald-600 bg-emerald-50 text-emerald-700 shadow-sm"
                        : "border-slate-100 bg-slate-50 text-slate-400 hover:bg-slate-100"
                    }`}
                  >
                    <UserCircle2 size={24} />
                    <span>일반 부원</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("admin")}
                    className={`p-4 rounded-2xl font-bold flex flex-col items-center gap-2 border-2 transition-all ${
                      role === "admin"
                        ? "border-emerald-600 bg-emerald-50 text-emerald-700 shadow-sm"
                        : "border-slate-100 bg-slate-50 text-slate-400 hover:bg-slate-100"
                    }`}
                  >
                    <BarChart3 size={24} />
                    <span>관리자</span>
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="flex items-center gap-2 mb-2 pt-2">
            <input
              type="checkbox"
              id="remember"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-slate-300"
            />
            <label
              htmlFor="remember"
              className="text-sm font-bold text-slate-600 cursor-pointer select-none"
            >
              학번 기억하기
            </label>
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl font-black text-lg shadow-lg shadow-emerald-700/30 transition-all mt-6"
          >
            {isRegisterMode ? "가입 및 시작하기" : "앱 시작하기"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 3. 메인 앱 화면 구조
// ==========================================
function MainApp({
  currentUser,
  onLogout,
  allUsers,
  trainings,
  reservations,
  schedules,
  fbAddTraining,
  fbDeleteTraining,
  fbUpdateTrainingVote,
  fbAddReservation,
  fbDeleteReservation,
  fbAddSchedule,
  fbDeleteSchedule,
  fbUpdateUser,
  fbDeleteUser,
}) {
  const [activeTab, setActiveTab] = useState("attendance");

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center font-sans">
      <div className="w-full max-w-md bg-white shadow-2xl relative flex flex-col h-screen overflow-hidden">
        <header className="bg-emerald-900 text-white p-4 flex items-center justify-between relative z-10 shrink-0 shadow-md">
          <h1 className="text-xl font-black text-white tracking-tight">
            NETTER
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold bg-emerald-800/80 px-2.5 py-1 rounded-full text-emerald-100 border border-emerald-700/50">
              {currentUser.name}{" "}
              {currentUser.role === "admin" ? "(관리자)" : ""}
            </span>
            <button
              onClick={onLogout}
              className="text-emerald-300 hover:text-white transition-colors"
              title="로그아웃"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-hidden bg-slate-50 relative">
          <div className="absolute inset-0 overflow-y-auto">
            {activeTab === "attendance" && (
              <AttendanceTab
                currentUser={currentUser}
                trainings={trainings}
                allUsers={allUsers}
                fbAddTraining={fbAddTraining}
                fbDeleteTraining={fbDeleteTraining}
                fbUpdateTrainingVote={fbUpdateTrainingVote}
              />
            )}
            {activeTab === "reservation" && (
              <ReservationTab
                currentUser={currentUser}
                reservations={reservations}
                schedules={schedules}
                fbAddReservation={fbAddReservation}
                fbDeleteReservation={fbDeleteReservation}
                fbAddSchedule={fbAddSchedule}
                fbDeleteSchedule={fbDeleteSchedule}
              />
            )}
            {activeTab === "stats" && (
              <StatsTab
                currentUser={currentUser}
                allUsers={allUsers}
                trainings={trainings}
                fbUpdateUser={fbUpdateUser}
                fbDeleteUser={fbDeleteUser}
              />
            )}
          </div>
        </main>

        <nav className="bg-white border-t border-slate-200 flex justify-around p-2 shrink-0 pb-safe z-20 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
          <NavButton
            id="attendance"
            icon={Users}
            label="훈련 일정"
            isActive={activeTab === "attendance"}
            onClick={() => setActiveTab("attendance")}
          />
          <NavButton
            id="reservation"
            icon={Calendar}
            label="동방 예약"
            isActive={activeTab === "reservation"}
            onClick={() => setActiveTab("reservation")}
          />
          <NavButton
            id="stats"
            icon={BarChart3}
            label={currentUser.role === "admin" ? "부원 통계" : "내 정보"}
            isActive={activeTab === "stats"}
            onClick={() => setActiveTab("stats")}
          />
        </nav>
      </div>
    </div>
  );
}

function NavButton({ id, icon: Icon, label, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2.5 flex flex-col items-center gap-1.5 transition-colors rounded-xl ${
        isActive
          ? "text-emerald-700"
          : "text-slate-400 hover:text-emerald-500 hover:bg-emerald-50/50"
      }`}
    >
      <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}

// ==========================================
// 4. 훈련 일정 탭
// ==========================================
function AttendanceTab({
  currentUser,
  trainings,
  allUsers,
  fbAddTraining,
  fbDeleteTraining,
  fbUpdateTrainingVote,
}) {
  const isAdmin = currentUser.role === "admin";
  const totalClubMembers = allUsers.length > 0 ? allUsers.length : 1;

  const [isAdding, setIsAdding] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [tempVotes, setTempVotes] = useState({});

  const handleAddTraining = () => {
    if (!newDate || !newTime || !newLocation.trim()) return;
    const newTraining = {
      id: Date.now().toString(),
      date: newDate,
      time: newTime,
      location: newLocation.trim(),
      attendees: [],
      absentees: [],
      undecided: [],
    };
    fbAddTraining(newTraining);
    setIsAdding(false);
    setNewDate("");
    setNewTime("");
    setNewLocation("");
  };

  const handleTempVote = (trainingId, statusKey) => {
    setTempVotes((prev) => ({ ...prev, [trainingId]: statusKey }));
  };

  const cancelTempVote = (trainingId) => {
    setTempVotes((prev) => {
      const newVotes = { ...prev };
      delete newVotes[trainingId];
      return newVotes;
    });
  };

  const confirmVote = (trainingId) => {
    const statusKey = tempVotes[trainingId];
    if (!statusKey) return;

    const targetTraining = trainings.find((t) => t.id === trainingId);
    if (!targetTraining) return;

    const newAttendees = (targetTraining.attendees || []).filter(
      (n) => n !== currentUser.name
    );
    const newAbsentees = (targetTraining.absentees || []).filter(
      (n) => n !== currentUser.name
    );
    const newUndecided = (targetTraining.undecided || []).filter(
      (n) => n !== currentUser.name
    );

    if (statusKey === "attendees") newAttendees.push(currentUser.name);
    if (statusKey === "absentees") newAbsentees.push(currentUser.name);
    if (statusKey === "undecided") newUndecided.push(currentUser.name);

    fbUpdateTrainingVote(trainingId, newAttendees, newAbsentees, newUndecided);
    cancelTempVote(trainingId);
  };

  const revokeVote = (trainingId) => {
    const targetTraining = trainings.find((t) => t.id === trainingId);
    if (!targetTraining) return;

    const newAttendees = (targetTraining.attendees || []).filter(
      (n) => n !== currentUser.name
    );
    const newAbsentees = (targetTraining.absentees || []).filter(
      (n) => n !== currentUser.name
    );
    const newUndecided = (targetTraining.undecided || []).filter(
      (n) => n !== currentUser.name
    );

    fbUpdateTrainingVote(trainingId, newAttendees, newAbsentees, newUndecided);
  };

  return (
    <div className="p-4 pb-20 space-y-4">
      <div className="mb-2 flex justify-between items-end">
        <div>
          <h2 className="text-xl font-black text-slate-800">훈련 참석 투표</h2>
          <p className="text-xs font-bold text-slate-500 mt-1">
            예정된 훈련의 참석 여부를 알려주세요.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setIsAdding(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-sm flex items-center gap-1 transition-colors"
          >
            <Plus size={14} /> 일정 추가
          </button>
        )}
      </div>

      {trainings.length === 0 && (
        <div className="bg-white rounded-3xl p-8 text-center border border-slate-100 shadow-sm mt-4">
          <Calendar size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-bold text-sm">
            등록된 훈련 일정이 없습니다.
          </p>
          {isAdmin && (
            <p className="text-emerald-600 font-medium text-xs mt-2">
              우측 상단의 '일정 추가' 버튼을 눌러보세요!
            </p>
          )}
        </div>
      )}

      {trainings.map((t) => {
        const attendees = t.attendees || [];
        const absentees = t.absentees || [];
        const undecided = t.undecided || [];

        const myVote = attendees.includes(currentUser.name)
          ? "attendees"
          : absentees.includes(currentUser.name)
          ? "absentees"
          : undecided.includes(currentUser.name)
          ? "undecided"
          : null;

        const tempVoteStatus = tempVotes[t.id];
        const participationRate = Math.round(
          (attendees.length / totalClubMembers) * 100
        );

        return (
          <div
            key={t.id}
            className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"
          >
            <div className="border-b border-slate-100 pb-4 mb-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-emerald-600" />
                  <span className="font-black text-slate-800 text-lg">
                    {t.date}
                  </span>
                  <span className="text-sm font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                    {t.time}
                  </span>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => {
                      if (window.confirm("삭제하시겠습니까?"))
                        fbDeleteTraining(t.id);
                    }}
                    className="text-rose-400 hover:text-rose-600 p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 text-slate-600 text-sm font-medium">
                <MapPin size={14} /> {t.location}
              </div>
            </div>

            {isAdmin && (
              <div className="mb-5 bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-xs font-bold text-slate-600">
                    전체 부원 대비 참석률
                  </span>
                  <span className="text-emerald-700 font-black">
                    {participationRate}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all"
                    style={{ width: `${participationRate}%` }}
                  ></div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-white border border-emerald-100 p-2 rounded-xl">
                    <div className="font-black text-emerald-700 mb-1">
                      참석 ({attendees.length})
                    </div>
                    <div className="text-slate-500 truncate">
                      {attendees.join(", ") || "-"}
                    </div>
                  </div>
                  <div className="bg-white border border-rose-100 p-2 rounded-xl">
                    <div className="font-black text-rose-600 mb-1">
                      불참 ({absentees.length})
                    </div>
                    <div className="text-slate-500 truncate">
                      {absentees.join(", ") || "-"}
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 p-2 rounded-xl">
                    <div className="font-black text-slate-600 mb-1">
                      미정 ({undecided.length})
                    </div>
                    <div className="text-slate-500 truncate">
                      {undecided.join(", ") || "-"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!isAdmin && (
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-slate-500">
                    현재 참석 확정 인원
                  </span>
                  <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    {attendees.length}명
                  </span>
                </div>
                <div className="text-sm font-medium text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {attendees.join(", ") || "아직 참석자가 없습니다."}
                </div>
              </div>
            )}

            <div className="mt-2">
              {myVote ? (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                  <div className="flex items-center gap-2">
                    {myVote === "attendees" && (
                      <CheckCircle2 className="text-emerald-600" size={20} />
                    )}
                    {myVote === "absentees" && (
                      <XCircle className="text-rose-500" size={20} />
                    )}
                    {myVote === "undecided" && (
                      <HelpCircle className="text-slate-500" size={20} />
                    )}
                    <span className="font-black text-slate-800">
                      내 투표:{" "}
                      {myVote === "attendees"
                        ? "참석"
                        : myVote === "absentees"
                        ? "불참"
                        : "미정"}
                    </span>
                  </div>
                  <button
                    onClick={() => revokeVote(t.id)}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-white px-3 py-1.5 rounded-lg border border-emerald-200 shadow-sm"
                  >
                    취소하기
                  </button>
                </div>
              ) : (
                <div>
                  {tempVoteStatus ? (
                    <div className="bg-slate-50 rounded-2xl p-4 border-2 border-emerald-200 flex flex-col gap-3">
                      <div className="text-center font-bold text-sm text-slate-700">
                        <span
                          className={`px-2 py-0.5 rounded text-white ${
                            tempVoteStatus === "attendees"
                              ? "bg-emerald-500"
                              : tempVoteStatus === "absentees"
                              ? "bg-rose-500"
                              : "bg-slate-500"
                          }`}
                        >
                          {tempVoteStatus === "attendees"
                            ? "참석"
                            : tempVoteStatus === "absentees"
                            ? "불참"
                            : "미정"}
                        </span>{" "}
                        (으)로 투표하시겠습니까?
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => cancelTempVote(t.id)}
                          className="flex-1 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
                        >
                          선택 취소
                        </button>
                        <button
                          onClick={() => confirmVote(t.id)}
                          className="flex-1 py-2.5 rounded-xl font-black text-white bg-emerald-600 hover:bg-emerald-700 shadow-md transition-colors"
                        >
                          완료
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTempVote(t.id, "attendees")}
                        className="flex-1 py-3 rounded-2xl font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Check size={16} /> 참석
                      </button>
                      <button
                        onClick={() => handleTempVote(t.id, "absentees")}
                        className="flex-1 py-3 rounded-2xl font-bold text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <X size={16} /> 불참
                      </button>
                      <button
                        onClick={() => handleTempVote(t.id, "undecided")}
                        className="flex-1 py-3 rounded-2xl font-bold text-slate-600 bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <HelpCircle size={16} /> 미정
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 border border-slate-100">
            <h3 className="text-xl font-black text-slate-800 mb-5">
              새 훈련 일정 추가
            </h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  날짜
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-emerald-600 font-bold text-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  시간
                </label>
                <input
                  type="text"
                  placeholder="예: 18:00 - 20:00"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-emerald-600 font-bold text-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  장소
                </label>
                <input
                  type="text"
                  placeholder="예: 중앙체육관 B코트"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-emerald-600 font-bold text-slate-700"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setIsAdding(false)}
                className="flex-1 py-3.5 rounded-xl font-black text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleAddTraining}
                disabled={!newDate || !newTime || !newLocation.trim()}
                className="flex-1 py-3.5 rounded-xl font-black text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-md shadow-emerald-700/20"
              >
                추가하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 5. 동방 예약 탭
// ==========================================
const TIME_SLOTS = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
];

function ReservationTab({
  currentUser,
  reservations,
  schedules,
  fbAddReservation,
  fbDeleteReservation,
  fbAddSchedule,
  fbDeleteSchedule,
}) {
  const [viewMode, setViewMode] = useState("month");
  const [selectedDateObj, setSelectedDateObj] = useState(new Date());

  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);

  const [selectedSlot, setSelectedSlot] = useState("");
  const [bookingName, setBookingName] = useState(currentUser.name);
  const [scheduleTitle, setScheduleTitle] = useState("");

  const currentYear = selectedDateObj.getFullYear();
  const currentMonthIndex = selectedDateObj.getMonth();
  const currentDate = selectedDateObj.getDate();
  const currentDateStr = `${currentYear}-${String(
    currentMonthIndex + 1
  ).padStart(2, "0")}-${String(currentDate).padStart(2, "0")}`;

  const getDaysInMonth = (year, month) =>
    new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const daysCount = getDaysInMonth(currentYear, currentMonthIndex);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonthIndex);
  const calendarGrid = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysCount }, (_, i) => i + 1),
  ];

  const handlePrevMonth = () =>
    setSelectedDateObj(new Date(currentYear, currentMonthIndex - 1, 1));
  const handleNextMonth = () =>
    setSelectedDateObj(new Date(currentYear, currentMonthIndex + 1, 1));
  const handlePrevDay = () =>
    setSelectedDateObj(
      new Date(currentYear, currentMonthIndex, currentDate - 1)
    );
  const handleNextDay = () =>
    setSelectedDateObj(
      new Date(currentYear, currentMonthIndex, currentDate + 1)
    );

  const openBookingModal = (time = "") => {
    setSelectedSlot(time);
    setBookingName(currentUser.name);
    setBookingModalOpen(true);
  };

  const handleBook = () => {
    if (!bookingName.trim() || !selectedSlot) return;
    const key = `${currentDateStr}-${selectedSlot}`;
    fbAddReservation(key, bookingName);
    setBookingModalOpen(false);
  };

  const handleCancel = (time) => {
    const key = `${currentDateStr}-${time}`;
    fbDeleteReservation(key);
  };

  const handleAddSchedule = () => {
    if (!scheduleTitle.trim()) return;
    const newSchedule = {
      id: Date.now().toString(),
      date: currentDateStr,
      title: scheduleTitle,
      author: currentUser.name,
    };
    fbAddSchedule(newSchedule);
    setScheduleModalOpen(false);
    setScheduleTitle("");
  };

  const handleDeleteSchedule = (id) => {
    fbDeleteSchedule(id);
  };

  const daySchedules = schedules.filter((s) => s.date === currentDateStr);

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex bg-white shadow-sm z-10 relative shrink-0 pt-2 px-2 gap-2">
        <button
          onClick={() => setViewMode("month")}
          className={`flex-1 py-3 text-sm font-black transition-colors rounded-t-xl ${
            viewMode === "month"
              ? "text-emerald-800 bg-emerald-50 border-b-2 border-emerald-600"
              : "text-slate-400 hover:bg-slate-50"
          }`}
        >
          월별 캘린더
        </button>
        <button
          onClick={() => setViewMode("day")}
          className={`flex-1 py-3 text-sm font-black transition-colors rounded-t-xl ${
            viewMode === "day"
              ? "text-emerald-800 bg-emerald-50 border-b-2 border-emerald-600"
              : "text-slate-400 hover:bg-slate-50"
          }`}
        >
          일별 타임라인
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {viewMode === "month" && (
          <div className="p-4 space-y-4">
            <div className="flex justify-between items-center bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
              <button
                onClick={handlePrevMonth}
                className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="font-black text-lg text-slate-800">
                {currentYear}년 {currentMonthIndex + 1}월
              </div>
              <button
                onClick={handleNextMonth}
                className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
                  <div
                    key={d}
                    className={`text-[10px] font-black py-2 ${
                      i === 0
                        ? "text-rose-500"
                        : i === 6
                        ? "text-blue-500"
                        : "text-slate-400"
                    }`}
                  >
                    {d}
                  </div>
                ))}
                {calendarGrid.map((day, idx) => {
                  if (!day) return <div key={`blank-${idx}`} className="p-2" />;

                  const dateStr = `${currentYear}-${String(
                    currentMonthIndex + 1
                  ).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const isSelected = day === currentDate;
                  const hasReservation = TIME_SLOTS.some(
                    (time) => reservations[`${dateStr}-${time}`]
                  );
                  const hasSchedule = schedules.some((s) => s.date === dateStr);

                  return (
                    <button
                      key={idx}
                      onClick={() =>
                        setSelectedDateObj(
                          new Date(currentYear, currentMonthIndex, day)
                        )
                      }
                      className={`relative p-2 rounded-xl w-10 h-10 flex flex-col items-center justify-center mx-auto text-sm transition-all ${
                        isSelected
                          ? "bg-emerald-600 text-white font-black shadow-md shadow-emerald-600/30"
                          : "hover:bg-slate-100 text-slate-700 font-bold"
                      }`}
                    >
                      <span>{day}</span>
                      <div className="absolute bottom-1 flex gap-0.5">
                        {hasSchedule && !isSelected && (
                          <div className="w-1 h-1 bg-amber-400 rounded-full" />
                        )}
                        {hasReservation && !isSelected && (
                          <div className="w-1 h-1 bg-emerald-400 rounded-full" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex justify-center gap-4 text-[10px] font-bold text-slate-400">
                <span className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-amber-400 rounded-full"></div>일정
                  있음
                </span>
                <span className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                  동방 예약됨
                </span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="font-black text-slate-800 mb-5 flex items-center gap-2">
                <Calendar size={18} className="text-emerald-700" />
                {currentMonthIndex + 1}월 {currentDate}일 내역
              </h3>

              <div className="mb-6">
                <h4 className="text-xs font-bold text-amber-600 mb-2 px-1">
                  동아리 일정
                </h4>
                {daySchedules.length > 0 ? (
                  <div className="space-y-2">
                    {daySchedules.map((schedule) => (
                      <div
                        key={schedule.id}
                        className="flex justify-between items-center bg-amber-50 p-3.5 rounded-2xl border border-amber-100"
                      >
                        <span className="font-bold text-amber-900 text-sm">
                          {schedule.title}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-amber-600">
                            {schedule.author}
                          </span>
                          {(schedule.author === currentUser.name ||
                            currentUser.role === "admin") && (
                            <button
                              onClick={() => handleDeleteSchedule(schedule.id)}
                              className="text-[10px] font-bold text-rose-500 bg-white border border-rose-100 px-2.5 py-1.5 rounded-lg shadow-sm hover:bg-rose-50 transition-colors"
                            >
                              삭제
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs font-medium text-slate-400 text-center py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    등록된 일정이 없습니다.
                  </div>
                )}
              </div>

              <div className="mb-6">
                <h4 className="text-xs font-bold text-emerald-700 mb-2 px-1">
                  동방 예약
                </h4>
                <div className="space-y-2">
                  {TIME_SLOTS.filter(
                    (time) => reservations[`${currentDateStr}-${time}`]
                  ).length > 0 ? (
                    TIME_SLOTS.map((time) => {
                      const bookedBy =
                        reservations[`${currentDateStr}-${time}`];
                      if (!bookedBy) return null;
                      const isMyBooking = bookedBy.startsWith(currentUser.name);

                      return (
                        <div
                          key={time}
                          className="flex justify-between items-center bg-slate-50 p-3.5 rounded-2xl border border-slate-100"
                        >
                          <span className="font-black text-slate-700 text-sm">
                            {time}
                          </span>
                          <div className="flex items-center gap-3">
                            <span
                              className={`font-bold text-sm ${
                                isMyBooking
                                  ? "text-emerald-700"
                                  : "text-slate-600"
                              }`}
                            >
                              {bookedBy}
                            </span>
                            {isMyBooking && (
                              <button
                                onClick={() => handleCancel(time)}
                                className="text-[10px] font-bold text-white bg-slate-400 px-2.5 py-1.5 rounded-lg shadow-sm hover:bg-rose-500 transition-colors"
                              >
                                취소
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-xs font-medium text-slate-400 text-center py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      예약된 내역이 없습니다.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setScheduleModalOpen(true)}
                  className="flex-1 py-3.5 bg-white border-2 border-amber-200 text-amber-700 hover:bg-amber-50 rounded-2xl font-black transition-all text-sm flex justify-center items-center gap-1.5"
                >
                  <Plus size={16} /> 일정 추가
                </button>
                <button
                  onClick={() => openBookingModal("")}
                  className="flex-1 py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl font-black shadow-lg shadow-emerald-700/20 transition-all text-sm flex justify-center items-center gap-1.5"
                >
                  <Calendar size={16} /> 동방 예약
                </button>
              </div>
            </div>
          </div>
        )}

        {viewMode === "day" && (
          <div className="flex flex-col h-full">
            <div className="bg-white p-4 flex justify-between items-center shadow-sm z-10 border-b border-slate-100 sticky top-0">
              <button
                onClick={handlePrevDay}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="font-black text-slate-800 text-lg flex items-center gap-2">
                <Clock size={18} className="text-emerald-700" />
                {currentMonthIndex + 1}월 {currentDate}일
              </div>
              <button
                onClick={handleNextDay}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {daySchedules.length > 0 && (
                <div className="mb-5">
                  <h2 className="text-xs font-black text-amber-600 mb-2 px-1">
                    오늘의 동아리 일정
                  </h2>
                  <div className="space-y-2">
                    {daySchedules.map((schedule) => (
                      <div
                        key={schedule.id}
                        className="flex justify-between items-center bg-amber-50 p-3.5 rounded-xl border border-amber-100"
                      >
                        <span className="font-bold text-amber-900">
                          {schedule.title}
                        </span>
                        {(schedule.author === currentUser.name ||
                          currentUser.role === "admin") && (
                          <button
                            onClick={() => handleDeleteSchedule(schedule.id)}
                            className="text-xs font-bold text-rose-500 bg-white border border-rose-200 px-2.5 py-1.5 rounded-lg hover:bg-rose-50 transition-colors shadow-sm"
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-3">
                <h2 className="text-sm font-black text-slate-800 mb-1 px-1">
                  시간대별 예약 타임라인
                </h2>
                <p className="text-xs font-medium text-slate-500 px-1">
                  빈 칸을 탭하여 동방을 예약하세요.
                </p>
              </div>

              {TIME_SLOTS.map((time) => {
                const isBooked = !!reservations[`${currentDateStr}-${time}`];
                const bookedBy = reservations[`${currentDateStr}-${time}`];
                const isMyBooking = bookedBy?.startsWith(currentUser.name);

                return (
                  <div
                    key={time}
                    className={`flex items-center p-4 rounded-2xl border-2 transition-all ${
                      isBooked
                        ? isMyBooking
                          ? "bg-emerald-50 border-emerald-200 shadow-sm"
                          : "bg-slate-50 border-slate-100 opacity-70"
                        : "bg-white border-slate-100 hover:border-emerald-400 hover:shadow-md cursor-pointer group"
                    }`}
                    onClick={() => !isBooked && openBookingModal(time)}
                  >
                    <div
                      className={`w-16 font-black text-lg ${
                        isBooked ? "text-slate-400" : "text-slate-700"
                      }`}
                    >
                      {time}
                    </div>

                    <div className="flex-1 px-3">
                      {isBooked ? (
                        <span
                          className={`font-bold text-sm ${
                            isMyBooking ? "text-emerald-700" : "text-slate-600"
                          }`}
                        >
                          {bookedBy}
                        </span>
                      ) : (
                        <span className="text-emerald-600 text-sm font-bold opacity-0 transition-opacity flex items-center gap-1 group-hover:opacity-100">
                          예약 가능 <Plus size={14} />
                        </span>
                      )}
                    </div>

                    {isBooked && isMyBooking && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancel(time);
                        }}
                        className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-sm hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-colors"
                      >
                        취소
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {bookingModalOpen && (
        <div className="absolute inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 border border-slate-100">
            <h3 className="text-xl font-black text-slate-800 mb-1">
              동방 예약하기
            </h3>
            <p className="text-sm font-bold text-slate-500 mb-5">
              {currentMonthIndex + 1}월 {currentDate}일
            </p>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-600 mb-2">
                시간대
              </label>
              <select
                value={selectedSlot}
                onChange={(e) => setSelectedSlot(e.target.value)}
                className="w-full border-2 border-slate-200 rounded-xl p-3.5 outline-none focus:border-emerald-600 transition-colors font-bold text-slate-700 bg-white"
              >
                <option value="" disabled>
                  시간을 선택해주세요
                </option>
                {TIME_SLOTS.map((time) => {
                  const isBooked = !!reservations[`${currentDateStr}-${time}`];
                  return (
                    <option key={time} value={time} disabled={isBooked}>
                      {time} {isBooked ? "(예약 불가)" : ""}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="mb-8">
              <label className="block text-xs font-bold text-slate-600 mb-2">
                예약자명 또는 목적
              </label>
              <input
                type="text"
                value={bookingName}
                onChange={(e) => setBookingName(e.target.value)}
                placeholder="소모임, 회의 등"
                className="w-full border-2 border-slate-200 rounded-xl p-3.5 outline-none focus:border-emerald-600 transition-colors font-bold text-slate-700"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setBookingModalOpen(false)}
                className="flex-1 py-4 rounded-xl font-black text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                닫기
              </button>
              <button
                onClick={handleBook}
                disabled={!selectedSlot || !bookingName.trim()}
                className="flex-1 py-4 rounded-xl font-black text-white bg-emerald-700 hover:bg-emerald-800 transition-colors shadow-lg shadow-emerald-700/30 disabled:opacity-50 disabled:shadow-none"
              >
                예약 확정
              </button>
            </div>
          </div>
        </div>
      )}

      {scheduleModalOpen && (
        <div className="absolute inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 border-t-8 border-t-amber-400">
            <h3 className="text-xl font-black text-slate-800 mb-1">
              동아리 일정 추가
            </h3>
            <p className="text-sm font-bold text-amber-600 mb-5">
              {currentMonthIndex + 1}월 {currentDate}일
            </p>

            <div className="mb-8">
              <label className="block text-xs font-bold text-slate-600 mb-2">
                일정 내용
              </label>
              <input
                type="text"
                value={scheduleTitle}
                onChange={(e) => setScheduleTitle(e.target.value)}
                placeholder="예: 가을 정기총회, 뒷풀이 등"
                className="w-full border-2 border-slate-200 rounded-xl p-3.5 outline-none focus:border-amber-500 transition-colors font-bold text-slate-700"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setScheduleModalOpen(false)}
                className="flex-1 py-4 rounded-xl font-black text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleAddSchedule}
                disabled={!scheduleTitle.trim()}
                className="flex-1 py-4 rounded-xl font-black text-white bg-amber-500 hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/30 disabled:opacity-50 disabled:shadow-none"
              >
                등록하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 6. 부원 통계 / 관리 탭
// ==========================================
function StatsTab({
  currentUser,
  allUsers,
  trainings,
  fbUpdateUser,
  fbDeleteUser,
}) {
  const isAdmin = currentUser.role === "admin";
  const totalTrainings = trainings.length;

  const [managingUser, setManagingUser] = useState(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");

  const getAttendanceCount = (userName) => {
    return trainings.filter((t) => (t.attendees || []).includes(userName))
      .length;
  };

  const openManageModal = (user) => {
    setManagingUser(user);
    setEditName(user.name);
    setEditRole(user.role);
  };

  const handleSaveUser = () => {
    if (!editName.trim()) return;
    fbUpdateUser(managingUser.studentId, {
      name: editName.trim(),
      role: editRole,
    });
    setManagingUser(null);
  };

  const handleDeleteUser = () => {
    if (
      window.confirm(
        `${managingUser.name} 부원을 정말 추방(삭제)하시겠습니까? 데이터가 완전히 사라집니다.`
      )
    ) {
      fbDeleteUser(managingUser.studentId);
      setManagingUser(null);
    }
  };

  if (isAdmin) {
    const userStats = allUsers
      .map((user) => {
        const attended = getAttendanceCount(user.name);
        const rate =
          totalTrainings > 0
            ? Math.round((attended / totalTrainings) * 100)
            : 0;
        return { ...user, attended, rate };
      })
      .sort((a, b) => b.rate - a.rate);

    return (
      <div className="p-4 pb-24 space-y-4 relative h-full">
        <div className="mb-2">
          <h2 className="text-xl font-black text-slate-800">
            부원 관리 및 통계
          </h2>
          <p className="text-xs font-bold text-slate-500 mt-1">
            총 {allUsers.length}명의 부원 참여율 통계입니다.
          </p>
        </div>

        <div className="space-y-3">
          {userStats.length === 0 && (
            <p className="text-center text-sm font-bold text-slate-400 py-10">
              가입된 부원이 없습니다.
            </p>
          )}
          {userStats.map((user, idx) => (
            <div
              key={user.studentId}
              className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-3"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-black text-emerald-700 bg-emerald-100 w-6 h-6 flex items-center justify-center rounded-full">
                    {idx + 1}
                  </span>
                  <span className="font-black text-slate-800 text-lg">
                    {user.name}
                  </span>
                  {user.role === "admin" && (
                    <span className="text-[10px] font-bold text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded-md">
                      관리자
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm font-black text-emerald-700 text-right">
                    {user.rate}%{" "}
                    <span className="text-xs text-slate-400 font-medium">
                      ({user.attended}/{totalTrainings})
                    </span>
                  </div>
                  <button
                    onClick={() => openManageModal(user)}
                    className="text-slate-400 hover:text-emerald-600 bg-slate-50 p-1.5 rounded-lg border border-slate-100 transition-colors"
                  >
                    <Settings size={16} />
                  </button>
                </div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all"
                  style={{ width: `${user.rate}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>

        {/* 부원 정보 수정 모달 */}
        {managingUser && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 border border-slate-100">
              <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-3">
                <h3 className="text-lg font-black text-slate-800">
                  부원 정보 관리
                </h3>
                <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                  {managingUser.studentId}
                </span>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    이름
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-emerald-600 font-bold text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    권한
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-emerald-600 font-bold text-slate-700 bg-white"
                  >
                    <option value="member">일반 부원</option>
                    <option value="admin">관리자</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => setManagingUser(null)}
                    className="flex-1 py-3 rounded-xl font-black text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSaveUser}
                    className="flex-1 py-3 rounded-xl font-black text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-md"
                  >
                    저장하기
                  </button>
                </div>
                <button
                  onClick={handleDeleteUser}
                  className="w-full py-3 rounded-xl font-bold text-rose-500 bg-white border border-rose-200 hover:bg-rose-50 transition-colors mt-2 text-sm flex items-center justify-center gap-1"
                >
                  <Trash2 size={16} /> 이 부원 추방하기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const myAttended = getAttendanceCount(currentUser.name);
  const myRate =
    totalTrainings > 0 ? Math.round((myAttended / totalTrainings) * 100) : 0;

  return (
    <div className="p-4 pb-24 h-full flex flex-col">
      <div className="mb-2">
        <h2 className="text-xl font-black text-slate-800">내 정보</h2>
        <p className="text-xs font-bold text-slate-500 mt-1">
          나의 훈련 참여 기록입니다.
        </p>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex-1 flex flex-col items-center justify-center mt-4">
        <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4 shadow-inner border-4 border-emerald-100">
          <UserCircle2 size={48} strokeWidth={1.5} />
        </div>
        <h3 className="text-3xl font-black text-slate-800 mb-1">
          {currentUser.name}
        </h3>
        <p className="text-emerald-600 font-bold text-sm mb-10 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
          NETTER 일반 부원
        </p>

        <div className="w-full bg-slate-50 rounded-3xl p-6 border border-slate-100 shadow-sm">
          <div className="text-center mb-6">
            <p className="text-sm font-bold text-slate-500 mb-2">
              나의 훈련 참여율
            </p>
            <p className="text-5xl font-black text-emerald-700">
              {myRate}
              <span className="text-2xl">%</span>
            </p>
          </div>

          <div className="w-full bg-slate-200 rounded-full h-3 mb-5">
            <div
              className="bg-emerald-500 h-3 rounded-full transition-all duration-1000 ease-out shadow-sm"
              style={{ width: `${myRate}%` }}
            ></div>
          </div>

          <div className="flex justify-between text-sm font-black px-2">
            <span className="text-slate-400">
              전체 훈련: {totalTrainings}회
            </span>
            <span className="text-emerald-600">내 참석: {myAttended}회</span>
          </div>
        </div>
      </div>
    </div>
  );
}
