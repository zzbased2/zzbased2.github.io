/**
 * Main Entry Point
 * Initialize game and UI
 */

(function() {
  'use strict';

  // Wait for DOM to be ready
  document.addEventListener('DOMContentLoaded', () => {
    // Create game instance
    const game = new SudokuGame();

    // Create UI instance
    const ui = new SudokuUI(game);

    // Initialize UI
    ui.init();

    // Expose to window for debugging
    window.game = game;
    window.ui = ui;

    // Show difficulty modal to start
    ui.showDifficultyModal();

    console.log('Sudoku game initialized!');
    console.log('Debug: Access window.game and window.ui for debugging');
  });
})();
