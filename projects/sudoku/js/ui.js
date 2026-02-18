/**
 * UI Rendering Module
 * Handles all DOM manipulation and visual updates
 */

class SudokuUI {
  constructor(game) {
    this.game = game;

    // DOM elements
    this.boardEl = document.getElementById('sudoku-board');
    this.timerEl = document.getElementById('timer');
    this.errorCountEl = document.getElementById('error-count');
    this.difficultyEl = document.getElementById('difficulty');
    this.hintCountEl = document.getElementById('hint-count');
    this.pauseOverlay = document.getElementById('pause-overlay');
    this.numberPad = document.getElementById('number-pad');

    // Buttons
    this.undoBtn = document.getElementById('undo-btn');
    this.redoBtn = document.getElementById('redo-btn');
    this.eraseBtn = document.getElementById('erase-btn');
    this.pencilBtn = document.getElementById('pencil-btn');
    this.hintBtn = document.getElementById('hint-btn');
    this.newGameBtn = document.getElementById('new-game-btn');
    this.restartBtn = document.getElementById('restart-btn');
    this.pauseBtn = document.getElementById('pause-btn');
    this.resumeBtn = document.getElementById('resume-btn');

    // Modals
    this.difficultyModal = document.getElementById('difficulty-modal');
    this.victoryModal = document.getElementById('victory-modal');

    // Store cell elements for quick access
    this.cells = [];

    // Difficulty display names
    this.difficultyNames = {
      easy: '简单',
      medium: '中等',
      hard: '困难',
      expert: '专家'
    };
  }

  /**
   * Initialize the UI
   */
  init() {
    this.createBoard();
    this.bindEvents();
    this.setupGameCallbacks();
  }

  /**
   * Create the 9x9 board grid
   */
  createBoard() {
    this.boardEl.innerHTML = '';
    this.cells = [];

    for (let row = 0; row < 9; row++) {
      this.cells[row] = [];
      for (let col = 0; col < 9; col++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = row;
        cell.dataset.col = col;

        // Create value container
        const valueEl = document.createElement('span');
        valueEl.className = 'cell-value';
        cell.appendChild(valueEl);

        // Create candidates container
        const candidatesEl = document.createElement('div');
        candidatesEl.className = 'cell-candidates';
        for (let n = 1; n <= 9; n++) {
          const candidateEl = document.createElement('span');
          candidateEl.className = 'candidate';
          candidateEl.dataset.num = n;
          candidatesEl.appendChild(candidateEl);
        }
        cell.appendChild(candidatesEl);

        this.boardEl.appendChild(cell);
        this.cells[row][col] = cell;
      }
    }
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Cell clicks
    this.boardEl.addEventListener('click', (e) => {
      const cell = e.target.closest('.cell');
      if (cell) {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        this.game.selectCell(row, col);
      }
    });

    // Number pad clicks
    this.numberPad.addEventListener('click', (e) => {
      const btn = e.target.closest('.number-btn');
      if (btn && !btn.classList.contains('completed')) {
        const num = parseInt(btn.dataset.number);
        this.game.fillNumber(num);
      }
    });

    // Toolbar buttons
    this.undoBtn.addEventListener('click', () => this.game.undo());
    this.redoBtn.addEventListener('click', () => this.game.redo());
    this.eraseBtn.addEventListener('click', () => this.game.eraseNumber());
    this.pencilBtn.addEventListener('click', () => {
      this.game.togglePencilMode();
      this.updatePencilButton();
    });
    this.hintBtn.addEventListener('click', () => this.game.getHint());

    // Game control buttons
    this.newGameBtn.addEventListener('click', () => this.showDifficultyModal());
    this.restartBtn.addEventListener('click', () => this.game.restart());
    this.pauseBtn.addEventListener('click', () => this.game.togglePause());
    this.resumeBtn.addEventListener('click', () => this.game.togglePause());

    // Difficulty selection
    this.difficultyModal.querySelectorAll('.difficulty-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const difficulty = btn.dataset.difficulty;
        this.hideDifficultyModal();
        this.game.newGame(difficulty);
      });
    });

    // Victory modal
    document.getElementById('play-again-btn').addEventListener('click', () => {
      this.hideVictoryModal();
      this.showDifficultyModal();
    });

    // Close modal on background click
    this.difficultyModal.addEventListener('click', (e) => {
      if (e.target === this.difficultyModal) {
        this.hideDifficultyModal();
      }
    });

    // Keyboard input
    document.addEventListener('keydown', (e) => {
      this.handleKeyboard(e);
    });
  }

  /**
   * Handle keyboard input
   * @param {KeyboardEvent} e
   */
  handleKeyboard(e) {
    if (this.game.isPaused || this.game.isCompleted) return;

    const key = e.key;

    // Number input (1-9)
    if (/^[1-9]$/.test(key)) {
      this.game.fillNumber(parseInt(key));
      return;
    }

    // Arrow keys for navigation
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
      e.preventDefault();
      this.handleArrowKey(key);
      return;
    }

    // Delete/Backspace to erase
    if (key === 'Delete' || key === 'Backspace') {
      e.preventDefault();
      this.game.eraseNumber();
      return;
    }

    // Ctrl+Z for undo
    if ((e.ctrlKey || e.metaKey) && key === 'z') {
      e.preventDefault();
      this.game.undo();
      return;
    }

    // Ctrl+Y for redo
    if ((e.ctrlKey || e.metaKey) && key === 'y') {
      e.preventDefault();
      this.game.redo();
      return;
    }

    // Space to toggle pencil mode
    if (key === ' ') {
      e.preventDefault();
      this.game.togglePencilMode();
      this.updatePencilButton();
      return;
    }
  }

  /**
   * Handle arrow key navigation
   * @param {string} key - Arrow key name
   */
  handleArrowKey(key) {
    let row = this.game.selectedRow;
    let col = this.game.selectedCol;

    if (row < 0 || col < 0) {
      row = 0;
      col = 0;
    } else {
      switch (key) {
        case 'ArrowUp':
          row = (row - 1 + 9) % 9;
          break;
        case 'ArrowDown':
          row = (row + 1) % 9;
          break;
        case 'ArrowLeft':
          col = (col - 1 + 9) % 9;
          break;
        case 'ArrowRight':
          col = (col + 1) % 9;
          break;
      }
    }

    this.game.selectCell(row, col);
  }

  /**
   * Setup game state callbacks
   */
  setupGameCallbacks() {
    this.game.onBoardUpdate = () => this.renderBoard();
    this.game.onCellUpdate = (row, col) => this.updateCell(row, col);
    this.game.onSelectionChange = (row, col) => this.updateSelection(row, col);
    this.game.onTimerUpdate = (seconds) => this.updateTimer(seconds);
    this.game.onErrorUpdate = (count, max) => this.updateErrorCount(count, max);
    this.game.onHintUpdate = (count) => this.updateHintCount(count);
    this.game.onGameComplete = (time, errors, diff) => this.showVictory(time, errors, diff);
    this.game.onPauseChange = (isPaused) => this.updatePauseState(isPaused);
  }

  /**
   * Render the entire board
   */
  renderBoard() {
    this.difficultyEl.textContent = this.difficultyNames[this.game.difficulty];

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        this.updateCell(row, col);
      }
    }

    this.updateNumberStats();
    this.updateToolbarButtons();
  }

  /**
   * Update a single cell
   * @param {number} row
   * @param {number} col
   */
  updateCell(row, col) {
    const cell = this.cells[row][col];
    const value = this.game.getCellValue(row, col);
    const candidates = this.game.getCellCandidates(row, col);
    const isOriginal = this.game.isCellOriginal(row, col);
    const isHint = this.game.isCellHint(row, col);
    const hasError = this.game.hasCellError(row, col);

    // Update classes
    cell.classList.toggle('original', isOriginal);
    cell.classList.toggle('hint', isHint);
    cell.classList.toggle('error', hasError);

    // Update value display
    const valueEl = cell.querySelector('.cell-value');
    valueEl.textContent = value || '';

    // Update candidates display
    const candidatesEl = cell.querySelector('.cell-candidates');
    candidatesEl.style.display = value ? 'none' : 'grid';

    if (!value) {
      const candidateEls = candidatesEl.querySelectorAll('.candidate');
      candidateEls.forEach((el, i) => {
        const num = i + 1;
        el.textContent = candidates.has(num) ? num : '';
      });
    }

    // Animation
    if (value) {
      cell.classList.add('pop');
      setTimeout(() => cell.classList.remove('pop'), 200);
    }

    if (hasError) {
      cell.classList.add('shake');
      setTimeout(() => cell.classList.remove('shake'), 300);
    }

    this.updateNumberStats();
    this.updateToolbarButtons();
  }

  /**
   * Update selection highlight
   * @param {number} selectedRow
   * @param {number} selectedCol
   */
  updateSelection(selectedRow, selectedCol) {
    const selectedValue = selectedRow >= 0 && selectedCol >= 0
      ? this.game.getCellValue(selectedRow, selectedCol)
      : 0;

    // Get related cells for highlight
    const relatedCells = selectedRow >= 0 && selectedCol >= 0
      ? new Set(Sudoku.getRelatedCells(selectedRow, selectedCol).map(([r, c]) => `${r},${c}`))
      : new Set();

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const cell = this.cells[row][col];
        const isSelected = row === selectedRow && col === selectedCol;
        const isRelated = relatedCells.has(`${row},${col}`);
        const value = this.game.getCellValue(row, col);
        const candidates = this.game.getCellCandidates(row, col);
        
        // Check if cell has same number (including pencil marks)
        const isSameNumber = selectedValue > 0 && value === selectedValue && !isSelected;
        const hasSameCandidate = selectedValue > 0 && !value && candidates.has(selectedValue);

        cell.classList.toggle('selected', isSelected);
        cell.classList.toggle('highlighted', isRelated && !isSelected);
        cell.classList.toggle('same-number', isSameNumber);
        cell.classList.toggle('same-candidate', hasSameCandidate);
        
        // Highlight matching candidate numbers within the cell
        if (selectedValue > 0 && !value) {
          const candidateEls = cell.querySelectorAll('.candidate');
          candidateEls.forEach((el, i) => {
            const num = i + 1;
            el.classList.toggle('highlight', num === selectedValue && candidates.has(num));
          });
        }
      }
    }

    // Update number pad highlight
    this.updateNumberPadHighlight(selectedValue);
  }

  /**
   * Update number pad button highlight
   * @param {number} selectedValue
   */
  updateNumberPadHighlight(selectedValue) {
    this.numberPad.querySelectorAll('.number-btn').forEach(btn => {
      const num = parseInt(btn.dataset.number);
      btn.classList.toggle('selected', num === selectedValue);
    });
  }

  /**
   * Update number statistics (show remaining count for each number)
   */
  updateNumberStats() {
    const counts = this.game.getNumberCounts();
    this.numberPad.querySelectorAll('.number-btn').forEach(btn => {
      const num = parseInt(btn.dataset.number);
      const remaining = 9 - (counts[num] || 0);
      const isCompleted = remaining <= 0;
      
      btn.classList.toggle('completed', isCompleted);
      
      // Update the remaining count display
      let countEl = btn.querySelector('.remaining-count');
      if (!countEl) {
        countEl = document.createElement('span');
        countEl.className = 'remaining-count';
        btn.appendChild(countEl);
      }
      
      if (isCompleted) {
        countEl.textContent = '';
      } else {
        countEl.textContent = remaining;
      }
    });
  }

  /**
   * Update toolbar button states
   */
  updateToolbarButtons() {
    this.undoBtn.classList.toggle('disabled', !this.game.canUndo());
    this.redoBtn.classList.toggle('disabled', !this.game.canRedo());
  }

  /**
   * Update pencil button state
   */
  updatePencilButton() {
    this.pencilBtn.classList.toggle('active', this.game.isPencilMode);
  }

  /**
   * Update timer display
   * @param {number} seconds
   */
  updateTimer(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    this.timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  /**
   * Update error count display
   * @param {number} count
   * @param {number} max
   */
  updateErrorCount(count, max) {
    this.errorCountEl.textContent = `${count}/${max}`;
    this.errorCountEl.classList.toggle('error', count > 0);
  }

  /**
   * Update hint count display
   * @param {number} count
   */
  updateHintCount(count) {
    this.hintCountEl.textContent = count;
    this.hintBtn.classList.toggle('disabled', count <= 0);
  }

  /**
   * Update pause state
   * @param {boolean} isPaused
   */
  updatePauseState(isPaused) {
    this.pauseOverlay.classList.toggle('active', isPaused);
    this.pauseBtn.textContent = isPaused ? '继续' : '暂停';
  }

  /**
   * Show difficulty selection modal
   */
  showDifficultyModal() {
    this.difficultyModal.classList.add('active');
  }

  /**
   * Hide difficulty selection modal
   */
  hideDifficultyModal() {
    this.difficultyModal.classList.remove('active');
  }

  /**
   * Show victory modal
   * @param {number} time - Time in seconds
   * @param {number} errors - Error count
   * @param {string} difficulty
   */
  showVictory(time, errors, difficulty) {
    const mins = Math.floor(time / 60);
    const secs = time % 60;
    const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    document.getElementById('victory-time').textContent = timeStr;
    document.getElementById('victory-errors').textContent = errors;
    document.getElementById('victory-difficulty').textContent = this.difficultyNames[difficulty];

    this.victoryModal.classList.add('active');

    // Animate
    const content = this.victoryModal.querySelector('.victory-content');
    content.classList.add('animate');
    setTimeout(() => content.classList.remove('animate'), 500);
  }

  /**
   * Hide victory modal
   */
  hideVictoryModal() {
    this.victoryModal.classList.remove('active');
  }
}
