/**
 * Sudoku Core Algorithm Module
 * Handles puzzle generation, solving, and validation
 */

const Sudoku = (function() {
  // Difficulty settings: number of cells to remove
  const DIFFICULTY_SETTINGS = {
    easy: { min: 30, max: 35 },
    medium: { min: 40, max: 45 },
    hard: { min: 50, max: 55 },
    expert: { min: 55, max: 60 }
  };

  /**
   * Check if placing num at (row, col) is valid
   * @param {number[][]} board - 9x9 sudoku board
   * @param {number} row - Row index (0-8)
   * @param {number} col - Column index (0-8)
   * @param {number} num - Number to place (1-9)
   * @returns {boolean} - True if valid placement
   */
  function isValidPlacement(board, row, col, num) {
    // Check row
    for (let c = 0; c < 9; c++) {
      if (board[row][c] === num) return false;
    }

    // Check column
    for (let r = 0; r < 9; r++) {
      if (board[r][col] === num) return false;
    }

    // Check 3x3 box
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    for (let r = boxRow; r < boxRow + 3; r++) {
      for (let c = boxCol; c < boxCol + 3; c++) {
        if (board[r][c] === num) return false;
      }
    }

    return true;
  }

  /**
   * Find the next empty cell (value = 0)
   * @param {number[][]} board - 9x9 sudoku board
   * @returns {[number, number] | null} - [row, col] or null if no empty cell
   */
  function findEmptyCell(board) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 0) return [r, c];
      }
    }
    return null;
  }

  /**
   * Solve sudoku using backtracking
   * @param {number[][]} board - 9x9 sudoku board (modified in place)
   * @returns {boolean} - True if solved
   */
  function solve(board) {
    const empty = findEmptyCell(board);
    if (!empty) return true; // No empty cells = solved

    const [row, col] = empty;

    for (let num = 1; num <= 9; num++) {
      if (isValidPlacement(board, row, col, num)) {
        board[row][col] = num;
        if (solve(board)) return true;
        board[row][col] = 0; // Backtrack
      }
    }

    return false;
  }

  /**
   * Count solutions (for checking unique solution)
   * @param {number[][]} board - 9x9 sudoku board
   * @param {object} counter - { count: number }
   * @param {number} limit - Stop counting after this many solutions
   * @returns {boolean} - True to continue, false to stop
   */
  function countSolutions(board, counter, limit = 2) {
    const empty = findEmptyCell(board);
    if (!empty) {
      counter.count++;
      return counter.count < limit;
    }

    const [row, col] = empty;

    for (let num = 1; num <= 9; num++) {
      if (isValidPlacement(board, row, col, num)) {
        board[row][col] = num;
        if (!countSolutions(board, counter, limit)) {
          board[row][col] = 0;
          return false;
        }
        board[row][col] = 0;
      }
    }

    return true;
  }

  /**
   * Check if puzzle has exactly one solution
   * @param {number[][]} puzzle - 9x9 puzzle with 0s for empty cells
   * @returns {boolean} - True if unique solution exists
   */
  function hasUniqueSolution(puzzle) {
    const board = puzzle.map(row => [...row]);
    const counter = { count: 0 };
    countSolutions(board, counter, 2);
    return counter.count === 1;
  }

  /**
   * Shuffle array in place (Fisher-Yates)
   * @param {any[]} array - Array to shuffle
   */
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  /**
   * Generate a complete valid sudoku solution
   * @returns {number[][]} - 9x9 solved sudoku board
   */
  function generateSolution() {
    const board = Array.from({ length: 9 }, () => Array(9).fill(0));
    
    // Fill board using randomized backtracking
    function fillBoard(board) {
      const empty = findEmptyCell(board);
      if (!empty) return true;

      const [row, col] = empty;
      const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      shuffle(nums);

      for (const num of nums) {
        if (isValidPlacement(board, row, col, num)) {
          board[row][col] = num;
          if (fillBoard(board)) return true;
          board[row][col] = 0;
        }
      }

      return false;
    }

    fillBoard(board);
    return board;
  }

  /**
   * Generate a sudoku puzzle by removing cells from solution
   * @param {string} difficulty - 'easy', 'medium', 'hard', or 'expert'
   * @returns {object} - { puzzle: number[][], solution: number[][] }
   */
  function generatePuzzle(difficulty = 'medium') {
    const solution = generateSolution();
    const puzzle = solution.map(row => [...row]);
    
    const settings = DIFFICULTY_SETTINGS[difficulty] || DIFFICULTY_SETTINGS.medium;
    const cellsToRemove = Math.floor(Math.random() * (settings.max - settings.min + 1)) + settings.min;

    // Create list of all cell positions
    const positions = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        positions.push([r, c]);
      }
    }
    shuffle(positions);

    let removed = 0;
    for (const [row, col] of positions) {
      if (removed >= cellsToRemove) break;

      const backup = puzzle[row][col];
      puzzle[row][col] = 0;

      // Check if still has unique solution
      if (hasUniqueSolution(puzzle)) {
        removed++;
      } else {
        puzzle[row][col] = backup; // Restore if multiple solutions
      }
    }

    return { puzzle, solution };
  }

  /**
   * Check if the current board state is complete and valid
   * @param {number[][]} board - Current board state
   * @param {number[][]} solution - Correct solution
   * @returns {boolean} - True if completed correctly
   */
  function isComplete(board, solution) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] !== solution[r][c]) return false;
      }
    }
    return true;
  }

  /**
   * Get all conflicts for a number at position
   * @param {number[][]} board - Current board state
   * @param {number} row - Row index
   * @param {number} col - Column index
   * @param {number} num - Number to check
   * @returns {[number, number][]} - Array of conflicting [row, col] positions
   */
  function getConflicts(board, row, col, num) {
    const conflicts = [];

    // Check row
    for (let c = 0; c < 9; c++) {
      if (c !== col && board[row][c] === num) {
        conflicts.push([row, c]);
      }
    }

    // Check column
    for (let r = 0; r < 9; r++) {
      if (r !== row && board[r][col] === num) {
        conflicts.push([r, col]);
      }
    }

    // Check 3x3 box
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    for (let r = boxRow; r < boxRow + 3; r++) {
      for (let c = boxCol; c < boxCol + 3; c++) {
        if ((r !== row || c !== col) && board[r][c] === num) {
          conflicts.push([r, c]);
        }
      }
    }

    return conflicts;
  }

  /**
   * Get cells in the same row, column, or box
   * @param {number} row - Row index
   * @param {number} col - Column index
   * @returns {[number, number][]} - Array of related [row, col] positions
   */
  function getRelatedCells(row, col) {
    const related = new Set();

    // Same row
    for (let c = 0; c < 9; c++) {
      if (c !== col) related.add(`${row},${c}`);
    }

    // Same column
    for (let r = 0; r < 9; r++) {
      if (r !== row) related.add(`${r},${col}`);
    }

    // Same box
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    for (let r = boxRow; r < boxRow + 3; r++) {
      for (let c = boxCol; c < boxCol + 3; c++) {
        if (r !== row || c !== col) related.add(`${r},${c}`);
      }
    }

    return Array.from(related).map(pos => pos.split(',').map(Number));
  }

  // Public API
  return {
    generatePuzzle,
    generateSolution,
    solve,
    isValidPlacement,
    hasUniqueSolution,
    isComplete,
    getConflicts,
    getRelatedCells,
    DIFFICULTY_SETTINGS
  };
})();
