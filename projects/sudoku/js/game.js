/**
 * Game State Management Module
 * Handles all game logic and state
 */

class SudokuGame {
  constructor() {
    this.puzzle = [];       // Original puzzle (0 = empty)
    this.solution = [];     // Correct solution
    this.board = [];        // Current board state
    this.candidates = [];   // Candidate numbers for each cell
    this.isOriginal = [];   // Track which cells are original puzzle numbers
    this.isHint = [];       // Track which cells were revealed by hint

    this.difficulty = 'medium';
    this.timer = 0;
    this.timerInterval = null;
    this.isPaused = false;
    this.errorCount = 0;
    this.maxErrors = 3;
    this.hintCount = 3;
    this.maxHints = 3;
    this.isCompleted = false;
    this.isPencilMode = false;

    this.selectedRow = -1;
    this.selectedCol = -1;

    this.history = new HistoryManager();

    // Callbacks for UI updates
    this.onBoardUpdate = null;
    this.onCellUpdate = null;
    this.onSelectionChange = null;
    this.onTimerUpdate = null;
    this.onErrorUpdate = null;
    this.onHintUpdate = null;
    this.onGameComplete = null;
    this.onPauseChange = null;
  }

  /**
   * Start a new game with specified difficulty
   * @param {string} difficulty - 'easy', 'medium', 'hard', or 'expert'
   */
  newGame(difficulty = 'medium') {
    this.difficulty = difficulty;
    const { puzzle, solution } = Sudoku.generatePuzzle(difficulty);

    this.puzzle = puzzle;
    this.solution = solution;
    this.board = puzzle.map(row => [...row]);
    this.candidates = Array.from({ length: 9 }, () =>
      Array.from({ length: 9 }, () => new Set())
    );
    this.isOriginal = puzzle.map(row => row.map(cell => cell !== 0));
    this.isHint = Array.from({ length: 9 }, () => Array(9).fill(false));

    this.timer = 0;
    this.isPaused = false;
    this.errorCount = 0;
    this.hintCount = this.maxHints;
    this.isCompleted = false;
    this.isPencilMode = false;

    this.selectedRow = -1;
    this.selectedCol = -1;

    this.history.clear();

    this.startTimer();

    if (this.onBoardUpdate) this.onBoardUpdate();
    if (this.onTimerUpdate) this.onTimerUpdate(this.timer);
    if (this.onErrorUpdate) this.onErrorUpdate(this.errorCount, this.maxErrors);
    if (this.onHintUpdate) this.onHintUpdate(this.hintCount);
  }

  /**
   * Restart current game (keep same puzzle)
   */
  restart() {
    this.board = this.puzzle.map(row => [...row]);
    this.candidates = Array.from({ length: 9 }, () =>
      Array.from({ length: 9 }, () => new Set())
    );
    this.isHint = Array.from({ length: 9 }, () => Array(9).fill(false));

    this.timer = 0;
    this.isPaused = false;
    this.errorCount = 0;
    this.hintCount = this.maxHints;
    this.isCompleted = false;

    this.selectedRow = -1;
    this.selectedCol = -1;

    this.history.clear();

    this.startTimer();

    if (this.onBoardUpdate) this.onBoardUpdate();
    if (this.onTimerUpdate) this.onTimerUpdate(this.timer);
    if (this.onErrorUpdate) this.onErrorUpdate(this.errorCount, this.maxErrors);
    if (this.onHintUpdate) this.onHintUpdate(this.hintCount);
  }

  /**
   * Select a cell
   * @param {number} row - Row index (0-8)
   * @param {number} col - Column index (0-8)
   */
  selectCell(row, col) {
    if (this.isPaused || this.isCompleted) return;

    this.selectedRow = row;
    this.selectedCol = col;

    if (this.onSelectionChange) {
      this.onSelectionChange(row, col);
    }
  }

  /**
   * Deselect current cell
   */
  deselectCell() {
    this.selectedRow = -1;
    this.selectedCol = -1;

    if (this.onSelectionChange) {
      this.onSelectionChange(-1, -1);
    }
  }

  /**
   * Fill number in selected cell
   * @param {number} num - Number to fill (1-9)
   */
  fillNumber(num) {
    if (this.isPaused || this.isCompleted) return;
    if (this.selectedRow < 0 || this.selectedCol < 0) return;
    if (this.isOriginal[this.selectedRow][this.selectedCol]) return;

    const row = this.selectedRow;
    const col = this.selectedCol;

    if (this.isPencilMode) {
      this.toggleCandidate(num);
      return;
    }

    const oldValue = this.board[row][col];
    const oldCandidates = new Set(this.candidates[row][col]);

    // If same number, erase it
    if (oldValue === num) {
      this.eraseNumber();
      return;
    }

    // Record action for undo
    this.history.record({
      type: 'fill',
      row,
      col,
      oldValue,
      newValue: num,
      oldCandidates,
      newCandidates: new Set()
    });

    // Fill the number
    this.board[row][col] = num;
    this.candidates[row][col].clear();

    // Check if correct
    const isCorrect = num === this.solution[row][col];
    if (!isCorrect) {
      this.errorCount++;
      if (this.onErrorUpdate) {
        this.onErrorUpdate(this.errorCount, this.maxErrors);
      }
    } else {
      // Auto-remove candidates from related cells
      this.removeCandidateFromRelated(row, col, num);
    }

    if (this.onCellUpdate) {
      this.onCellUpdate(row, col);
    }

    // Check completion
    this.checkCompletion();
  }

  /**
   * Erase number from selected cell
   */
  eraseNumber() {
    if (this.isPaused || this.isCompleted) return;
    if (this.selectedRow < 0 || this.selectedCol < 0) return;
    if (this.isOriginal[this.selectedRow][this.selectedCol]) return;

    const row = this.selectedRow;
    const col = this.selectedCol;
    const oldValue = this.board[row][col];
    const oldCandidates = new Set(this.candidates[row][col]);

    if (oldValue === 0 && oldCandidates.size === 0) return;

    // Record action for undo
    this.history.record({
      type: 'erase',
      row,
      col,
      oldValue,
      newValue: 0,
      oldCandidates,
      newCandidates: new Set()
    });

    this.board[row][col] = 0;
    this.candidates[row][col].clear();

    if (this.onCellUpdate) {
      this.onCellUpdate(row, col);
    }
  }

  /**
   * Toggle pencil/notes mode
   */
  togglePencilMode() {
    this.isPencilMode = !this.isPencilMode;
  }

  /**
   * Toggle candidate number in selected cell
   * @param {number} num - Candidate number (1-9)
   */
  toggleCandidate(num) {
    if (this.isPaused || this.isCompleted) return;
    if (this.selectedRow < 0 || this.selectedCol < 0) return;
    if (this.isOriginal[this.selectedRow][this.selectedCol]) return;
    if (this.board[this.selectedRow][this.selectedCol] !== 0) return;

    const row = this.selectedRow;
    const col = this.selectedCol;
    const oldCandidates = new Set(this.candidates[row][col]);
    const newCandidates = new Set(this.candidates[row][col]);

    if (newCandidates.has(num)) {
      newCandidates.delete(num);
    } else {
      newCandidates.add(num);
    }

    // Record action for undo
    this.history.record({
      type: 'candidate',
      row,
      col,
      oldValue: 0,
      newValue: 0,
      oldCandidates,
      newCandidates
    });

    this.candidates[row][col] = newCandidates;

    if (this.onCellUpdate) {
      this.onCellUpdate(row, col);
    }
  }

  /**
   * Remove candidate from all related cells
   * @param {number} row - Row index
   * @param {number} col - Column index
   * @param {number} num - Number to remove
   */
  removeCandidateFromRelated(row, col, num) {
    const relatedCells = Sudoku.getRelatedCells(row, col);
    for (const [r, c] of relatedCells) {
      if (this.candidates[r][c].has(num)) {
        this.candidates[r][c].delete(num);
        if (this.onCellUpdate) {
          this.onCellUpdate(r, c);
        }
      }
    }
  }

  /**
   * Get hint for selected cell
   */
  getHint() {
    if (this.isPaused || this.isCompleted) return;
    if (this.hintCount <= 0) return;
    if (this.selectedRow < 0 || this.selectedCol < 0) return;
    if (this.isOriginal[this.selectedRow][this.selectedCol]) return;

    const row = this.selectedRow;
    const col = this.selectedCol;

    // If already correct, don't use hint
    if (this.board[row][col] === this.solution[row][col]) return;

    const oldValue = this.board[row][col];
    const oldCandidates = new Set(this.candidates[row][col]);
    const correctValue = this.solution[row][col];

    // Record action for undo
    this.history.record({
      type: 'hint',
      row,
      col,
      oldValue,
      newValue: correctValue,
      oldCandidates,
      newCandidates: new Set(),
      wasHint: this.isHint[row][col]
    });

    this.board[row][col] = correctValue;
    this.candidates[row][col].clear();
    this.isHint[row][col] = true;
    this.hintCount--;

    // Auto-remove candidates from related cells
    this.removeCandidateFromRelated(row, col, correctValue);

    if (this.onHintUpdate) {
      this.onHintUpdate(this.hintCount);
    }
    if (this.onCellUpdate) {
      this.onCellUpdate(row, col);
    }

    // Check completion
    this.checkCompletion();
  }

  /**
   * Undo last action
   */
  undo() {
    if (this.isPaused || this.isCompleted) return;

    const action = this.history.undo();
    if (!action) return;

    const { row, col, oldValue, oldCandidates } = action;

    this.board[row][col] = oldValue;
    this.candidates[row][col] = oldCandidates;

    // Restore hint status if it was a hint
    if (action.type === 'hint') {
      this.isHint[row][col] = action.wasHint || false;
      this.hintCount++;
      if (this.onHintUpdate) {
        this.onHintUpdate(this.hintCount);
      }
    }

    if (this.onCellUpdate) {
      this.onCellUpdate(row, col);
    }
  }

  /**
   * Redo previously undone action
   */
  redo() {
    if (this.isPaused || this.isCompleted) return;

    const action = this.history.redo();
    if (!action) return;

    const { row, col, newValue, newCandidates } = action;

    this.board[row][col] = newValue;
    this.candidates[row][col] = newCandidates;

    // Handle hint redo
    if (action.type === 'hint') {
      this.isHint[row][col] = true;
      this.hintCount--;
      if (this.onHintUpdate) {
        this.onHintUpdate(this.hintCount);
      }
    }

    if (this.onCellUpdate) {
      this.onCellUpdate(row, col);
    }
  }

  /**
   * Check if game is completed
   */
  checkCompletion() {
    // Check if all cells are filled
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.board[r][c] === 0) return;
      }
    }

    // Check if all cells are correct
    if (Sudoku.isComplete(this.board, this.solution)) {
      this.isCompleted = true;
      this.stopTimer();

      if (this.onGameComplete) {
        this.onGameComplete(this.timer, this.errorCount, this.difficulty);
      }
    }
  }

  /**
   * Start the timer
   */
  startTimer() {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      if (!this.isPaused) {
        this.timer++;
        if (this.onTimerUpdate) {
          this.onTimerUpdate(this.timer);
        }
      }
    }, 1000);
  }

  /**
   * Stop the timer
   */
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * Toggle pause state
   */
  togglePause() {
    if (this.isCompleted) return;

    this.isPaused = !this.isPaused;

    if (this.onPauseChange) {
      this.onPauseChange(this.isPaused);
    }
  }

  /**
   * Get cell value
   * @param {number} row - Row index
   * @param {number} col - Column index
   * @returns {number} - Cell value (0 if empty)
   */
  getCellValue(row, col) {
    return this.board[row][col];
  }

  /**
   * Get candidates for a cell
   * @param {number} row - Row index
   * @param {number} col - Column index
   * @returns {Set<number>} - Set of candidate numbers
   */
  getCellCandidates(row, col) {
    return this.candidates[row][col];
  }

  /**
   * Check if cell is original puzzle number
   * @param {number} row - Row index
   * @param {number} col - Column index
   * @returns {boolean}
   */
  isCellOriginal(row, col) {
    return this.isOriginal[row][col];
  }

  /**
   * Check if cell was revealed by hint
   * @param {number} row - Row index
   * @param {number} col - Column index
   * @returns {boolean}
   */
  isCellHint(row, col) {
    return this.isHint[row][col];
  }

  /**
   * Check if cell value has error (conflicts)
   * @param {number} row - Row index
   * @param {number} col - Column index
   * @returns {boolean}
   */
  hasCellError(row, col) {
    const value = this.board[row][col];
    if (value === 0) return false;
    return value !== this.solution[row][col];
  }

  /**
   * Get count of each number on board
   * @returns {object} - { 1: count, 2: count, ... }
   */
  getNumberCounts() {
    const counts = {};
    for (let n = 1; n <= 9; n++) counts[n] = 0;

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = this.board[r][c];
        if (val > 0) counts[val]++;
      }
    }

    return counts;
  }

  /**
   * Check if undo is available
   * @returns {boolean}
   */
  canUndo() {
    return this.history.canUndo();
  }

  /**
   * Check if redo is available
   * @returns {boolean}
   */
  canRedo() {
    return this.history.canRedo();
  }
}
