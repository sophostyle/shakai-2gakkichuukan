/* =========================================================
   社会 歴史4択クイズ - app.js
   説明文（meaning）を表示し、正しい用語（term）を4択から選ぶ。
   選択肢は「紛らわしい者同士」を意図してグループ化した category を
   優先的に使い、足りない分だけ他のカテゴリーから補う。
   構成は英単語クイズ版と同じ考え方なので、拡張の入り口もほぼ共通。
   ========================================================= */

(() => {
  "use strict";

  /* ---------- DOM参照 ---------- */
  const el = {
    screenStart: document.getElementById("screen-start"),
    screenQuiz: document.getElementById("screen-quiz"),
    screenResult: document.getElementById("screen-result"),

    dataStatus: document.getElementById("data-status"),
    countOptions: document.getElementById("count-options"),
    startBtn: document.getElementById("start-btn"),
    startHint: document.getElementById("start-hint"),

    progressText: document.getElementById("progress-text"),
    scoreText: document.getElementById("score-text"),
    progressFill: document.getElementById("progress-fill"),

    meaningDisplay: document.getElementById("meaning-display"),
    choices: document.getElementById("choices"),
    feedback: document.getElementById("feedback"),
    nextBtn: document.getElementById("next-btn"),

    scoreFraction: document.getElementById("score-fraction"),
    scoreRate: document.getElementById("score-rate"),
    wrongSection: document.getElementById("wrong-section"),
    wrongList: document.getElementById("wrong-list"),
    reviewBtn: document.getElementById("review-btn"),
    retryBtn: document.getElementById("retry-btn"),
  };

  /* ---------- 状態 ---------- */
  const state = {
    allWords: [],          // words.json の全データ（term / meaning / category）
    selectedCount: 20,
    sessionWords: [],
    currentIndex: 0,
    correctCount: 0,
    wrongWords: [],         // 今回間違えた項目 {term, meaning}
    currentChoices: [],
    answered: false,
    lastResultWrongWords: [],
  };

  /* ---------- データ読み込み ---------- */
  async function loadWords() {
    try {
      const res = await fetch("words.json");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();

      if (!Array.isArray(data)) throw new Error("words.json の形式が不正です");

      const valid = data.filter(
        (w) => w && typeof w.term === "string" && typeof w.meaning === "string" &&
               w.term.trim() !== "" && w.meaning.trim() !== ""
      );

      state.allWords = valid;

      if (valid.length < 2) {
        showDataError("問題データが不足しています（2問以上必要です）。words.json を確認してください。");
        return;
      }

      if (valid.length !== data.length) {
        el.dataStatus.textContent = `注意: words.json 内に読み込めない項目が ${data.length - valid.length} 件ありました。`;
      }

      el.startHint.textContent = `全 ${valid.length} 問を読み込みました。`;
      el.startBtn.disabled = false;
    } catch (err) {
      console.error(err);
      showDataError(
        "words.json を読み込めませんでした。ブラウザで直接 index.html を開いている場合、" +
        "ローカルサーバーやホスティング経由（Vercel等）で開き直してください。"
      );
    }
  }

  function showDataError(message) {
    el.dataStatus.textContent = message;
    el.startHint.textContent = "";
    el.startBtn.disabled = true;
  }

  /* ---------- ユーティリティ ---------- */
  function shuffle(array) {
    const a = array.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // 優先順位: ① 同じ category（紛らわしい者同士）から誤答を集める → ② 足りない分だけ他から補う
  function buildChoices(word) {
    const correctTerm = word.term;
    const used = new Set([correctTerm]);
    const wrong = [];

    if (word.category) {
      const samePool = state.allWords.filter(
        (w) => w.category === word.category && !used.has(w.term)
      );
      const uniqueSame = Array.from(new Set(samePool.map((w) => w.term)));
      for (const term of shuffle(uniqueSame)) {
        if (wrong.length >= 3) break;
        wrong.push(term);
        used.add(term);
      }
    }

    if (wrong.length < 3) {
      const rest = state.allWords.filter((w) => !used.has(w.term));
      const uniqueRest = Array.from(new Set(rest.map((w) => w.term)));
      for (const term of shuffle(uniqueRest)) {
        if (wrong.length >= 3) break;
        wrong.push(term);
        used.add(term);
      }
    }

    return shuffle([correctTerm, ...wrong]).map((term) => ({
      term,
      isCorrect: term === correctTerm,
    }));
  }

  function pickSessionWords(count) {
    const pool = shuffle(state.allWords);
    if (count === "all") return pool;
    return pool.slice(0, Math.min(count, pool.length));
  }

  /* ---------- 画面遷移・レンダリング ---------- */
  function showScreen(name) {
    el.screenStart.classList.toggle("hidden", name !== "start");
    el.screenQuiz.classList.toggle("hidden", name !== "quiz");
    el.screenResult.classList.toggle("hidden", name !== "result");
  }

  function renderCountOptions() {
    const buttons = el.countOptions.querySelectorAll(".count-btn");
    buttons.forEach((btn) => {
      btn.classList.toggle("is-selected", btn.dataset.count === String(state.selectedCount));
    });
  }

  function renderQuestion() {
    state.answered = false;
    const word = state.sessionWords[state.currentIndex];

    const total = state.sessionWords.length;
    const current = state.currentIndex + 1;
    el.progressText.textContent = `第 ${current} 問 / ${total} 問`;
    el.scoreText.textContent = `正解 ${state.correctCount}`;
    el.progressFill.style.width = `${((current - 1) / total) * 100}%`;

    el.meaningDisplay.textContent = word.meaning;

    state.currentChoices = buildChoices(word);
    el.choices.innerHTML = "";
    const letters = ["A", "B", "C", "D"];

    state.currentChoices.forEach((choice, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice-btn";
      btn.dataset.term = choice.term;
      btn.innerHTML = `
        <span class="choice-badge">${letters[idx]}</span>
        <span class="choice-text"></span>
      `;
      btn.querySelector(".choice-text").textContent = choice.term;
      btn.addEventListener("click", () => handleChoiceClick(choice, btn));
      el.choices.appendChild(btn);
    });

    el.feedback.className = "feedback hidden";
    el.feedback.innerHTML = "";
    el.nextBtn.classList.add("hidden");
  }

  function handleChoiceClick(choice, buttonEl) {
    if (state.answered) return;
    state.answered = true;

    const word = state.sessionWords[state.currentIndex];
    const allButtons = el.choices.querySelectorAll(".choice-btn");

    allButtons.forEach((btn) => {
      btn.disabled = true;
      if (btn.dataset.term === word.term) {
        btn.classList.add("is-correct");
      } else if (btn !== buttonEl) {
        btn.classList.add("is-dimmed");
      }
    });

    if (choice.isCorrect) {
      state.correctCount++;
      el.feedback.className = "feedback is-correct";
      el.feedback.textContent = "正解！";
    } else {
      buttonEl.classList.remove("is-dimmed");
      buttonEl.classList.add("is-wrong");
      el.feedback.className = "feedback is-wrong";
      el.feedback.innerHTML = `不正解<span class="feedback-sub">正解：${word.term}</span>`;
      state.wrongWords.push(word);
    }

    el.scoreText.textContent = `正解 ${state.correctCount}`;
    const total = state.sessionWords.length;
    el.progressFill.style.width = `${((state.currentIndex + 1) / total) * 100}%`;

    const isLast = state.currentIndex === state.sessionWords.length - 1;
    el.nextBtn.textContent = isLast ? "結果を見る" : "次の問題";
    el.nextBtn.classList.remove("hidden");
  }

  function goToNextQuestion() {
    state.currentIndex++;
    if (state.currentIndex >= state.sessionWords.length) {
      showResult();
    } else {
      renderQuestion();
    }
  }

  function showResult() {
    const total = state.sessionWords.length;
    const percent = total > 0 ? Math.round((state.correctCount / total) * 100) : 0;

    el.scoreFraction.textContent = `${state.correctCount} / ${total} 正解`;
    el.scoreRate.textContent = `${percent}%`;

    state.lastResultWrongWords = state.wrongWords.slice();

    if (state.lastResultWrongWords.length > 0) {
      el.wrongSection.classList.remove("hidden");
      el.reviewBtn.classList.remove("hidden");
      el.wrongList.innerHTML = "";
      state.lastResultWrongWords.forEach((w) => {
        const li = document.createElement("li");
        li.innerHTML = `<span class="w-en"></span><span class="w-ja"></span>`;
        li.querySelector(".w-en").textContent = w.term;
        li.querySelector(".w-ja").textContent = w.meaning;
        el.wrongList.appendChild(li);
      });
    } else {
      el.wrongSection.classList.add("hidden");
      el.reviewBtn.classList.add("hidden");
      el.wrongList.innerHTML = "";
    }

    showScreen("result");
  }

  /* ---------- イベントハンドラ ---------- */
  function startQuiz(count) {
    state.sessionWords = pickSessionWords(count);
    state.currentIndex = 0;
    state.correctCount = 0;
    state.wrongWords = [];

    if (state.sessionWords.length === 0) {
      showDataError("出題できる問題がありません。");
      showScreen("start");
      return;
    }

    showScreen("quiz");
    renderQuestion();
  }

  function startReview() {
    const reviewSource = state.lastResultWrongWords;
    if (reviewSource.length === 0) return;

    state.sessionWords = shuffle(reviewSource);
    state.currentIndex = 0;
    state.correctCount = 0;
    state.wrongWords = [];

    showScreen("quiz");
    renderQuestion();
  }

  el.countOptions.addEventListener("click", (e) => {
    const btn = e.target.closest(".count-btn");
    if (!btn) return;
    const raw = btn.dataset.count;
    state.selectedCount = raw === "all" ? "all" : Number(raw);
    renderCountOptions();
  });

  el.startBtn.addEventListener("click", () => {
    startQuiz(state.selectedCount);
  });

  el.nextBtn.addEventListener("click", goToNextQuestion);

  el.retryBtn.addEventListener("click", () => {
    startQuiz(state.selectedCount);
  });

  el.reviewBtn.addEventListener("click", startReview);

  // キーボード操作（PC向け補助機能）: 1〜4キーで選択肢を選べるようにする
  document.addEventListener("keydown", (e) => {
    if (el.screenQuiz.classList.contains("hidden")) return;
    if (state.answered) return;
    const idx = ["1", "2", "3", "4"].indexOf(e.key);
    if (idx === -1) return;
    const buttons = el.choices.querySelectorAll(".choice-btn");
    const btn = buttons[idx];
    if (btn) btn.click();
  });

  /* ---------- 初期化 ---------- */
  renderCountOptions();
  loadWords();

  /* =========================================================
     今後の機能拡張メモ
     - 用語→説明の逆方向モード: renderQuestion / buildChoices の
       表示対象を term/meaning で入れ替えれば作れる（タイピング版も同様）
     - セクション（時代）ごとの出題フィルター: words.json に既にある
       category を使って、出題範囲を絞るUIを追加できる
     - 正解率の保存・学習履歴: localStorage 等に記録する関数を追加
     ========================================================= */
})();
