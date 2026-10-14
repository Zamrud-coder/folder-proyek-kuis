// --- 1. PENGAMANAN ANTI-XSS & CHECKSUM (ANTI-TAMPERING) ---
const SECRET_SALT = 'QuizMasterPro_Secured_2026';

function sanitizeHTML(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Hash SHA-256 untuk verifikasi password, signature nilai, & kunci jawaban
async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

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

// --- DATABASE BAWAAN (Kunci Jawaban SHA-256) ---
const defaultQuestions = [
  {
    id: 1,
    type: "pg",
    question: "Bahasa pemrograman manakah yang berjalan langsung di browser tanpa instalasi?",
    options: ["Python", "JavaScript", "C++", "Java"],
    answerHash: "cff0978ecd3bc4f392c5ea048ec007944774b090b5af741d3993df94e2cbaca5"
  },
  {
    id: 2,
    type: "essay",
    question: "Jelaskan kelebihan utama bahasa JavaScript!"
  }
];

let questions = JSON.parse(localStorage.getItem('qm_questions')) || defaultQuestions;

// --- STATE APPLICATION ---
let currentUser = null;
let activeQuizQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = {};
let isAdminAuthenticated = false; // Guard variabel status login admin

function saveQuestions() {
  localStorage.setItem('qm_questions', JSON.stringify(questions));
}

async function saveResults(resultsArray) {
  localStorage.setItem('qm_results', JSON.stringify(resultsArray));
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

  // Kunci jawaban (answer/answerHash) dan ID dicabut dari runtime browser peserta
  activeQuizQuestions = questions.map(q => {
    const { answer, answerHash, id, ...cleanQuestion } = q;
    return cleanQuestion;
  });

  currentQuestionIndex = 0;
  userAnswers = {};
  renderQuestion();
  switchView('view-quiz');
}

// Admin Hash Login
async function handleLoginAdmin(e) {
  e.preventDefault();
  const passInput = document.getElementById('input-admin-pass').value;
  const hashedInput = await hashString(passInput);
  const ADMIN_HASH = '70e838fb81cc99f5e191e9c42405c8ee09dbb791886ea26b6ddedc6dc6fd5498';

  if (hashedInput === ADMIN_HASH) {
    isAdminAuthenticated = true; // Aktifkan kunci autentikasi
    await renderAdminDashboard();
    switchView('view-admin');
  } else {
    alert("Password Admin Salah!");
  }
}

function logout() {
  isAdminAuthenticated = false; // Matikan status autentikasi
  currentUser = null;
  document.getElementById('form-login-peserta').reset();
  document.getElementById('form-login-admin').reset();
  
  // Bersihkan DOM agar jika di-unhide paksa tidak ada data sama sekali
  document.getElementById('admin-questions-list').innerHTML = '';
  document.getElementById('admin-scores-table-body').innerHTML = '';
  document.getElementById('count-questions').textContent = '0';
  document.getElementById('count-results').textContent = '0';
  
  switchView('view-login');
}

// --- LOGIC KERJAKAN KUIS ---
function renderQuestion() {
  const q = activeQuizQuestions[currentQuestionIndex];
  document.getElementById('quiz-progress').textContent = `Soal ${currentQuestionIndex + 1} dari ${activeQuizQuestions.length}`;
  document.getElementById('question-text').textContent = q.question;

  const optionsContainer = document.getElementById('options-container');
  optionsContainer.innerHTML = '';

  if (q.type === 'essay') {
    const currentEssayAns = userAnswers[currentQuestionIndex] || '';
    optionsContainer.innerHTML = `
      <textarea 
        id="input-essay"
        rows="4"
        placeholder="Tuliskan jawaban kamu di sini (Wajib diisi)..."
        class="w-full p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
      >${sanitizeHTML(currentEssayAns)}</textarea>
    `;

    document.getElementById('input-essay').addEventListener('input', (e) => {
      userAnswers[currentQuestionIndex] = e.target.value;
    });
  } else {
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
        <span><strong class="mr-2 text-indigo-400">${String.fromCharCode(65 + idx)}.</strong> ${sanitizeHTML(opt)}</span>
        ${isSelected ? '<i class="fa-solid fa-circle-check text-indigo-400"></i>' : ''}
      `;
      
      btn.onclick = () => selectOption(idx);
      optionsContainer.appendChild(btn);
    });
  }

  document.getElementById('btn-prev').disabled = (currentQuestionIndex === 0);
  
  if (currentQuestionIndex === activeQuizQuestions.length - 1) {
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

function isCurrentQuestionAnswered() {
  const q = activeQuizQuestions[currentQuestionIndex];
  const ans = userAnswers[currentQuestionIndex];

  if (q.type === 'essay') {
    return ans && ans.trim().length > 0;
  } else {
    return ans !== undefined && ans !== null;
  }
}

function changeQuestion(direction) {
  if (direction > 0 && !isCurrentQuestionAnswered()) {
    alert("Kamu wajib menjawab soal ini terlebih dahulu sebelum melanjutkan!");
    return;
  }
  currentQuestionIndex += direction;
  renderQuestion();
}

// Submit Kuis & Matching Hash
async function submitQuiz() {
  if (!isCurrentQuestionAnswered()) {
    alert("Kamu wajib mengisi jawaban soal terakhir sebelum mengumpulkan!");
    return;
  }

  let correctPG = 0;
  const pgQuestions = questions.filter(q => q.type !== 'essay');
  const essayQuestions = questions.filter(q => q.type === 'essay');

  for (let idx = 0; idx < questions.length; idx++) {
    const q = questions[idx];
    if (q.type !== 'essay') {
      const userAnsHash = await hashString(`${userAnswers[idx]}_${SECRET_SALT}`);
      const isCorrect = q.answerHash ? (userAnsHash === q.answerHash) : (userAnswers[idx] === q.answer);
      if (isCorrect) {
        correctPG++;
      }
    }
  }

  const totalPG = pgQuestions.length;
  const pgScore = totalPG > 0 ? Math.round((correctPG / totalPG) * 100) : 100;
  
  const essayAnswers = [];
  questions.forEach((q, idx) => {
    if (q.type === 'essay') {
      essayAnswers.push({
        question: q.question,
        userAnswer: userAnswers[idx] || '-'
      });
    }
  });

  const rawResults = JSON.parse(localStorage.getItem('qm_results')) || [];

  const newResult = {
    id: Date.now(),
    name: currentUser.name,
    email: currentUser.email,
    info: currentUser.info,
    score: pgScore,
    hasEssay: essayQuestions.length > 0,
    essayAnswers: essayAnswers,
    date: new Date().toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    signature: await hashString(`${currentUser.name}_${currentUser.email}_${pgScore}_${SECRET_SALT}`)
  };

  rawResults.push(newResult);
  await saveResults(rawResults);

  document.getElementById('final-score').textContent = pgScore;
  
  let detailText = `Pilihan Ganda: Benar ${correctPG} dari ${totalPG} soal.`;
  if (essayQuestions.length > 0) {
    detailText += ` (${essayQuestions.length} Soal Essay telah dikirim ke Admin untuk diperiksa)`;
  }
  
  document.getElementById('final-detail').textContent = detailText;
  switchView('view-result');
}

// --- LOGIC DASHBOARD (ADMIN PROTECTED) ---
async function renderAdminDashboard() {
  const listContainer = document.getElementById('admin-questions-list');
  const tableBody = document.getElementById('admin-scores-table-body');

  // PROTEKSI KETAT: Jika belum terautentikasi, blokir & kosongkan isi DOM!
  if (!isAdminAuthenticated) {
    listContainer.innerHTML = '<p class="text-xs text-rose-400 italic text-center py-4 font-bold">Akses Ditolak! Anda belum login sebagai Admin.</p>';
    tableBody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-rose-400 font-bold italic">Akses Ditolak! Anda belum login sebagai Admin.</td></tr>';
    document.getElementById('count-questions').textContent = '0';
    document.getElementById('count-results').textContent = '0';
    return;
  }

  questions = JSON.parse(localStorage.getItem('qm_questions')) || defaultQuestions;
  const rawResults = JSON.parse(localStorage.getItem('qm_results')) || [];

  let tamperedDetected = false;

  for (let r of rawResults) {
    const expectedSignature = await hashString(`${r.name}_${r.email}_${r.score}_${SECRET_SALT}`);
    
    if (r.signature !== expectedSignature) {
      let restoredScore = null;
      for (let s = 0; s <= 100; s++) {
        const testSig = await hashString(`${r.name}_${r.email}_${s}_${SECRET_SALT}`);
        if (testSig === r.signature) {
          restoredScore = s;
          break;
        }
      }

      if (restoredScore !== null) {
        r.score = restoredScore;
        r.wasTampered = true;
        tamperedDetected = true;
      }
    }
  }

  if (tamperedDetected) {
    await saveResults(rawResults);
    alert("Terdeteksi percobaan manipulasi nilai di LocalStorage! Sistem telah mengembalikan nilai peserta ke skor aslinya secara otomatis.");
  }

  document.getElementById('count-questions').textContent = questions.length;
  document.getElementById('count-results').textContent = rawResults.length;

  // Render Daftar Soal Admin
  listContainer.innerHTML = '';
  if (questions.length === 0) {
    listContainer.innerHTML = '<p class="text-xs text-slate-500 italic text-center py-4">Belum ada soal terpasang.</p>';
  } else {
    for (let idx = 0; idx < questions.length; idx++) {
      const q = questions[idx];
      const item = document.createElement('div');
      item.className = 'bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs space-y-2';
      
      const isEssay = q.type === 'essay' || !q.options;
      const safeQuestion = sanitizeHTML(q.question);

      let optionsHtml = '';
      if (isEssay) {
        optionsHtml = `<p class="text-slate-400 italic">Tipe: Soal Essay (Jawaban Teks Bebas)</p>`;
      } else {
        let optsList = [];
        for (let oIdx = 0; oIdx < q.options.length; oIdx++) {
          const opt = q.options[oIdx];
          const optHash = await hashString(`${oIdx}_${SECRET_SALT}`);
          const isCorrect = q.answerHash ? (optHash === q.answerHash) : (q.answer === oIdx);
          
          optsList.push(`
            <div class="${isCorrect ? 'text-emerald-400 font-semibold' : ''}">
              ${String.fromCharCode(65 + oIdx)}. ${sanitizeHTML(opt)}${isCorrect ? '✓' : ''}
            </div>
          `);
        }
        optionsHtml = `<div class="grid grid-cols-2 gap-1 text-slate-400">${optsList.join('')}</div>`;
      }

      item.innerHTML = `
        <div class="flex justify-between items-start gap-2">
          <span class="font-bold text-slate-200">#${idx + 1}. <span class="text-indigo-400">[${isEssay ? 'ESSAY' : 'PG'}]</span> ${safeQuestion}</span>
          <button onclick="deleteQuestion(${idx})" class="text-rose-400 hover:text-rose-300 p-1">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
        ${optionsHtml}
      `;
      listContainer.appendChild(item);
    }
  }

  // Render Tabel Hasil
  tableBody.innerHTML = '';
  if (rawResults.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-500 italic">Belum ada peserta yang menyelesaikan kuis.</td></tr>';
  } else {
    rawResults.forEach((r, idx) => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-900/50';
      
      const essayBadge = r.hasEssay 
        ? `<br><span class="text-[10px] text-amber-400 cursor-pointer underline" onclick="showEssayAnswers(${idx})">[Lihat Essay]</span>` 
        : '';

      const scoreDisplay = r.wasTampered
        ? `<span class="px-2 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-md font-bold" title="Nilai sempat diubah tapi sudah dipulihkan ke skor asli">${r.score}</span>`
        : `<span class="px-2 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-md font-bold">${r.score}</span>`;

      row.innerHTML = `
        <td class="p-3 font-semibold text-slate-200">
          ${sanitizeHTML(r.name)} 
          ${r.wasTampered ? '<span class="text-amber-400 text-xs ml-1 font-normal">(Sempat Diedit)</span>' : ''}
        </td>
        <td class="p-3 text-slate-400">${sanitizeHTML(r.email)}</td>
        <td class="p-3 text-slate-400">${sanitizeHTML(r.info)}</td>
        <td class="p-3 text-center">
          ${scoreDisplay}
          ${essayBadge}
        </td>
        <td class="p-3 text-right text-slate-500">${sanitizeHTML(r.date)}</td>
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

// Modal Jawaban Essay
function showEssayAnswers(resultIndex) {
  if (!isAdminAuthenticated) return;
  const rawResults = JSON.parse(localStorage.getItem('qm_results')) || [];
  const r = rawResults[resultIndex];
  if (!r || !r.essayAnswers) return;

  let msg = `Jawaban Essay oleh: ${r.name}\n\n`;
  r.essayAnswers.forEach((item, i) => {
    msg += `Soal ${i + 1}: ${item.question}\nJawaban: ${item.userAnswer}\n\n`;
  });
  alert(msg);
}

// --- FUNGSI HAPUS & TAMBAH SOAL ---
async function deleteQuestion(index) {
  if (!isAdminAuthenticated) return;
  if (confirm(`Apakah Anda yakin ingin menghapus soal nomor ${index + 1}?`)) {
    questions.splice(index, 1);
    saveQuestions();
    await renderAdminDashboard();
  }
}

async function deleteResult(index) {
  if (!isAdminAuthenticated) return;
  if (confirm("Apakah Anda yakin ingin menghapus riwayat nilai peserta ini?")) {
    const rawResults = JSON.parse(localStorage.getItem('qm_results')) || [];
    rawResults.splice(index, 1);
    await saveResults(rawResults);
    await renderAdminDashboard();
  }
}

async function clearAllResults() {
  if (!isAdminAuthenticated) return;
  if (confirm("Apakah Anda yakin ingin mengosongkan SEMUA hasil pengerjaan peserta?")) {
    await saveResults([]);
    await renderAdminDashboard();
  }
}

function toggleQuestionTypeInput() {
  const qType = document.getElementById('add-q-type').value;
  const pgContainer = document.getElementById('pg-options-container');
  if (qType === 'essay') {
    pgContainer.classList.add('hidden');
  } else {
    pgContainer.classList.remove('hidden');
  }
}

async function handleAddQuestion(e) {
  e.preventDefault();
  if (!isAdminAuthenticated) return;

  const qType = document.getElementById('add-q-type').value;
  const qText = document.getElementById('add-q-text').value;

  let newQ = {
    id: Date.now(),
    type: qType,
    question: qText
  };

  if (qType === 'pg') {
    const opt0 = document.getElementById('add-opt-0').value;
    const opt1 = document.getElementById('add-opt-1').value;
    const opt2 = document.getElementById('add-opt-2').value;
    const opt3 = document.getElementById('add-opt-3').value;
    const correctIdx = parseInt(document.getElementById('add-correct-index').value);

    newQ.options = [opt0, opt1, opt2, opt3];
    newQ.answerHash = await hashString(`${correctIdx}_${SECRET_SALT}`);
  }

  questions.push(newQ);
  saveQuestions();
  e.target.reset();
  
  toggleQuestionTypeInput();
  await renderAdminDashboard();
}

function switchAdminSubTab(sub) {
  if (!isAdminAuthenticated) return;
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