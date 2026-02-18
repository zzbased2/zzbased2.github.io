/**
 * History Manager Module
 * Handles undo/redo functionality
 */

class HistoryManager {
  constructor() {
    this.history = [];
    this.currentIndex = -1;
  }

  /**
   * Record an action to history
   * @param {object} action - Action object with type, row, col, oldValue, newValue
   */
  record(action) {
    // Remove any redo history when new action is recorded
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    this.history.push(action);
    this.currentIndex++;
  }

  /**
   * Undo the last action
   * @returns {object|null} - The action to undo, or null if nothing to undo
   */
  undo() {
    if (!this.canUndo()) return null;

    const action = this.history[this.currentIndex];
    this.currentIndex--;
    return action;
  }

  /**
   * Redo the previously undone action
   * @returns {object|null} - The action to redo, or null if nothing to redo
   */
  redo() {
    if (!this.canRedo()) return null;

    this.currentIndex++;
    return this.history[this.currentIndex];
  }

  /**
   * Check if undo is available
   * @returns {boolean}
   */
  canUndo() {
    return this.currentIndex >= 0;
  }

  /**
   * Check if redo is available
   * @returns {boolean}
   */
  canRedo() {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * Clear all history
   */
  clear() {
    this.history = [];
    this.currentIndex = -1;
  }

  /**
   * Get current history length
   * @returns {number}
   */
  get length() {
    return this.history.length;
  }
}
