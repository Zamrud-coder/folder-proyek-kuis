// --- KONFIGURASI TAILWIND ---
tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: { 500: '#6366f1', 600: '#4f46e5' }
      }
    }
  }
};

// --- DATABASE BAWAAN (LocalStorage) ---
const defaultQuestions = [
  {
    id: 1,
    type: "pg", // <--- Tambahkan tipe pg
    question: "Bahasa pemrograman manakah yang berjalan langsung di browser tanpa instalasi?",
    options: ["Python", "JavaScript", "C++", "Java"],
    answer: 1
  },
  {
    id: 2,
    type: "essay", // <--- Contoh soal essay
    question: "Jelaskan kelebihan utama bahasa JavaScript!"
  }
];

let questions = JSON.parse(localStorage.getItem('qm_questions')) || defaultQuestions;
let quizResults = JSON.parse(localStorage.getItem('qm_results')) || [];

// --- STATE KUIS ---
let currentUser = null;
let currentQuestionIndex = 0;
let userAnswers = {};

function saveQuestions() {
  localStorage.setItem('qm_questions', JSON.stringify(questions));
}
function saveResults() {
  localStorage.setItem('qm_results', JSON.stringify(quizResults));
}

// --- LOGIC AUTHENTICATION & VIEWS ---
function switchView(viewId) {
  ['view-login', 'view-quiz', 'view-result', 'view-admin'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  document.getElementById(viewId).classList.remove('hidden');
}

function switchLoginTab(role) {
  const pesertaBtn = document.getElementById('tab-peserta-btn');
  const adminBtn = document.getElementById('tab-admin-btn');
  const formPeserta = document.getElementById('form-login-peserta');
  const formAdmin = document.getElementById('form-login-admin');

  if (role === 'peserta') {
    pesertaBtn.className = "flex-1 py-3 text-center border-b-2 border-indigo-500 text-indigo-400 font-semibold";
    adminBtn.className = "flex-1 py-3 text-center border-b-2 border-transparent text-slate-400 hover:text-slate-200";
    formPeserta.classList.remove('hidden');
    formAdmin.classList.add('hidden');
  } else {
    adminBtn.className = "flex-1 py-3 text-center border-b-2 border-emerald-500 text-emerald-400 font-semibold";
    pesertaBtn.className = "flex-1 py-3 text-center border-b-2 border-transparent text-slate-400 hover:text-slate-200";
    formAdmin.classList.remove('hidden');
    formPeserta.classList.add('hidden');
  }
}

function handleLoginPeserta(e) {
  e.preventDefault();
  if (questions.length === 0) {
    alert("Belum ada soal yang tersedia! Minta Admin untuk menambah soal terlebih dahulu.");
    return;
  }

  currentUser = {
    name: document.getElementById('input-nama').value,
    email: document.getElementById('input-email').value,
    info: document.getElementById('input-instansi').value
  };

  document.getElementById('quiz-user-name').textContent = currentUser.name;
  document.getElementById('quiz-user-info').textContent = `${currentUser.email} • ${currentUser.info}`;

  currentQuestionIndex = 0;
  userAnswers = {};
  renderQuestion();
  switchView('view-quiz');
}

function handleLoginAdmin(e) {
  e.preventDefault();
  const pass = document.getElementById('input-admin-pass').value;
  
  if (pass === 'Jangandicoba') {
    renderAdminDashboard();
    switchView('view-admin');
  } else {
    alert("Password Admin Salah!");
  }
}

function logout() {
  currentUser = null;
  document.getElementById('form-login-peserta').reset();
  document.getElementById('form-login-admin').reset();
  switchView('view-login');
}

// --- LOGIC KERJAKAN KUIS ---
function renderQuestion() {
  const q = questions[currentQuestionIndex];
  document.getElementById('quiz-progress').textContent = `Soal ${currentQuestionIndex + 1} dari ${questions.length}`;
  document.getElementById('question-text').textContent = q.question;

  const optionsContainer = document.getElementById('options-container');
  optionsContainer.innerHTML = '';

  // CEK TIPE SOAL (ESSAY / PG)
  if (q.type === 'essay') {
    const currentEssayAns = userAnswers[currentQuestionIndex] || '';
    optionsContainer.innerHTML = `
      <textarea 
        id="input-essay"
        rows="4"
        placeholder="Tuliskan jawaban kamu di sini..."
        class="w-full p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
      >${currentEssayAns}</textarea>
    `;

    document.getElementById('input-essay').addEventListener('input', (e) => {
      userAnswers[currentQuestionIndex] = e.target.value;
    });
  } else {
    // TAMPILAN PG (KODE LAMA)
    q.options.forEach((opt, idx) => {
      const isSelected = userAnswers[currentQuestionIndex] === idx;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `w-full p-4 text-left rounded-xl border transition flex items-center justify-between cursor-pointer ${
        isSelected 
          ? 'bg-indigo-600/20 border-indigo-500 text-white font-semibold' 
          : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800/50'
      }`;
      
      btn.innerHTML = `
        <span><strong class="mr-2 text-indigo-400">${String.fromCharCode(65 + idx)}.</strong> ${opt}</span>
        ${isSelected ? '<i class="fa-solid fa-circle-check text-indigo-400"></i>' : ''}
      `;
      
      btn.onclick = () => selectOption(idx);
      optionsContainer.appendChild(btn);
    });
  }

  document.getElementById('btn-prev').disabled = (currentQuestionIndex === 0);
  
  if (currentQuestionIndex === questions.length - 1) {
    document.getElementById('btn-next').classList.add('hidden');
    document.getElementById('btn-submit').classList.remove('hidden');
  } else {
    document.getElementById('btn-next').classList.remove('hidden');
    document.getElementById('btn-submit').classList.add('hidden');
  }
}

function selectOption(index) {
  userAnswers[currentQuestionIndex] = index;
  renderQuestion();
}

function changeQuestion(direction) {
  currentQuestionIndex += direction;
  renderQuestion();
}

function submitQuiz() {
  let correctCount = 0;
  // Menghitung jumlah soal PG saja
  const totalPG = questions.filter(q => q.type !== 'essay').length;

  questions.forEach((q, idx) => {
    if (q.type !== 'essay' && userAnswers[idx] === q.answer) {
      correctCount++;
    }
  });

  const finalScore = totalPG > 0 ? Math.round((correctCount / totalPG) * 100) : 100;

  quizResults.push({
    name: currentUser.name,
    email: currentUser.email,
    info: currentUser.info,
    score: finalScore,
    date: new Date().toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' })
  });
  saveResults();

  document.getElementById('final-score').textContent = finalScore;
  document.getElementById('final-detail').textContent = totalPG > 0 
    ? `Menjawab benar ${correctCount} dari ${totalPG} soal PG` 
    : `Semua soal berupa Essay (jawaban berhasil dikirim)`;
  switchView('view-result');
}

// --- LOGIC PEMBUAT SOAL (ADMIN) ---
function renderAdminDashboard() {
  questions = JSON.parse(localStorage.getItem('qm_questions')) || defaultQuestions;
  quizResults = JSON.parse(localStorage.getItem('qm_results')) || [];

  document.getElementById('count-questions').textContent = questions.length;
  document.getElementById('count-results').textContent = quizResults.length;

  const listContainer = document.getElementById('admin-questions-list');
  listContainer.innerHTML = '';
  
  if (questions.length === 0) {
    listContainer.innerHTML = '<p class="text-xs text-slate-500 italic text-center py-4">Belum ada soal terpasang.</p>';
  } else {
    questions.forEach((q, idx) => {
      const item = document.createElement('div');
      item.className = 'bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs space-y-2';
      item.innerHTML = `
        <div class="flex justify-between items-start gap-2">
          <span class="font-bold text-slate-200">#${idx + 1}. ${q.question}</span>
          <button onclick="deleteQuestion(${idx})" class="text-rose-400 hover:text-rose-300 p-1">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
        <div class="grid grid-cols-2 gap-1 text-slate-400">
          ${q.options.map((opt, oIdx) => `
            <div class="${oIdx === q.answer ? 'text-emerald-400 font-semibold' : ''}">
              ${String.fromCharCode(65 + oIdx)}. ${opt}${oIdx === q.answer ? '✓' : ''}
            </div>
          `).join('')}
        </div>
      `;
      listContainer.appendChild(item);
    });
  }

  const tableBody = document.getElementById('admin-scores-table-body');
  tableBody.innerHTML = '';
  
  if (quizResults.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-500 italic">Belum ada peserta yang menyelesaikan kuis.</td></tr>';
  } else {
    quizResults.forEach((r, idx) => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-900/50';
      row.innerHTML = `
        <td class="p-3 font-semibold text-slate-200">${r.name}</td>
        <td class="p-3 text-slate-400">${r.email}</td>
        <td class="p-3 text-slate-400">${r.info}</td>
        <td class="p-3 text-center"><span class="px-2 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-md font-bold">${r.score}</span></td>
        <td class="p-3 text-right text-slate-500">${r.date}</td>
        <td class="p-3 text-center">
          <button onclick="deleteResult(${idx})" title="Hapus Riwayat Ini" class="text-rose-400 hover:text-rose-300 p-1">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      `;
      tableBody.appendChild(row);
    });
  }
}

function handleAddQuestion(e) {
  e.preventDefault();
  const qText = document.getElementById('add-q-text').value;
  const opt0 = document.getElementById('add-opt-0').value;
  const opt1 = document.getElementById('add-opt-1').value;
  const opt2 = document.getElementById('add-opt-2').value;
  const opt3 = document.getElementById('add-opt-3').value;
  const correctIdx = parseInt(document.getElementById('add-correct-index').value);

  const newQ = {
    id: Date.now(),
    question: qText,
    options: [opt0, opt1, opt2, opt3],
    answer: correctIdx
  };

  questions.push(newQ);
  saveQuestions();
  e.target.reset();
  renderAdminDashboard();
}

function deleteQuestion(index) {
  if (confirm('Hapus soal ini?')) {
    questions.splice(index, 1);
    saveQuestions();
    renderAdminDashboard();
  }
}

function deleteResult(index) {
  if (confirm('Hapus riwayat nilai peserta ini?')) {
    quizResults.splice(index, 1);
    saveResults();
    renderAdminDashboard();
  }
}

function clearAllResults() {
  if (quizResults.length === 0) {
    alert('Tabel hasil sudah kosong.');
    return;
  }
  
  if (confirm('Yakin ingin menghapus SEMUA riwayat peserta? Data yang dihapus tidak bisa dikembalikan.')) {
    quizResults = [];
    saveResults();
    renderAdminDashboard();
  }
}

function switchAdminSubTab(sub) {
  const qDiv = document.getElementById('admin-sub-questions');
  const sDiv = document.getElementById('admin-sub-scores');
  const qBtn = document.getElementById('tab-manage-questions');
  const sBtn = document.getElementById('tab-manage-scores');

  if (sub === 'questions') {
    qDiv.classList.remove('hidden');
    sDiv.classList.add('hidden');
    qBtn.className = "px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white";
    sBtn.className = "px-4 py-2 rounded-xl text-sm font-semibold bg-slate-800 text-slate-400 hover:text-white";
  } else {
    qDiv.classList.add('hidden');
    sDiv.classList.remove('hidden');
    sBtn.className = "px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white";
    qBtn.className = "px-4 py-2 rounded-xl text-sm font-semibold bg-slate-800 text-slate-400 hover:text-white";
  }
}