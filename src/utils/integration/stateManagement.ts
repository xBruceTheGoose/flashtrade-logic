
import { logger } from '../monitoring/loggingService';

/**
 * Application state types
 */
export enum AppState {
  INITIALIZING = 'initializing',
  READY = 'ready',
  MONITORING = 'monitoring',
  TRADING = 'trading',
  PAUSED = 'paused',
  ERROR = 'error'
}

/**
 * State change listener type
 */
type StateChangeListener = (newState: AppState, oldState: AppState) => void;

/**
 * Central state manager for application-wide state
 */
export class AppStateManager {
  private currentState: AppState = AppState.INITIALIZING;
  private listeners: StateChangeListener[] = [];
  private moduleStates: Record<string, any> = {};
  
  constructor() {
    logger.info('state', 'State manager initialized');
  }
  
  /**
   * Get current application state
   */
  getState(): AppState {
    return this.currentState;
  }
  
  /**
   * Update application state
   */
  setState(newState: AppState): void {
    const oldState = this.currentState;
    
    if (oldState === newState) {
      return;
    }
    
    this.currentState = newState;
    logger.info('state', `App state changed: ${oldState} -> ${newState}`);
    
    // Notify all listeners
    this.notifyListeners(newState, oldState);
  }
  
  /**
   * Add state change listener
   */
  addListener(listener: StateChangeListener): () => void {
    this.listeners.push(listener);
    
    // Return a function to remove this listener
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
  
  /**
   * Notify all listeners of state change
   */
  private notifyListeners(newState: AppState, oldState: AppState): void {
    this.listeners.forEach(listener => {
      try {
        listener(newState, oldState);
      } catch (error) {
        logger.error('state', 'Error in state change listener', { error });
      }
    });
  }
  
  /**
   * Set module-specific state
   */
  setModuleState(module: string, state: any): void {
    this.moduleStates[module] = state;
    logger.debug('state', `Module state updated: ${module}`, { state });
  }
  
  /**
   * Get module-specific state
   */
  getModuleState<T>(module: string): T | undefined {
    return this.moduleStates[module] as T;
  }
  
  /**
   * Get all module states
   */
  getAllModuleStates(): Record<string, any> {
    return { ...this.moduleStates };
  }
  
  /**
   * Check if application is in a specific state
   */
  isInState(state: AppState): boolean {
    return this.currentState === state;
  }
  
  /**
   * Check if application can transition to a state
   */
  canTransitionTo(targetState: AppState): boolean {
    const currentState = this.currentState;
    
    // Define valid state transitions
    switch (currentState) {
      case AppState.INITIALIZING:
        return targetState === AppState.READY || targetState === AppState.ERROR;
      case AppState.READY:
        return targetState !== AppState.INITIALIZING;
      case AppState.MONITORING:
        return targetState !== AppState.INITIALIZING;
      case AppState.TRADING:
        return targetState !== AppState.INITIALIZING;
      case AppState.PAUSED:
        return targetState !== AppState.INITIALIZING;
      case AppState.ERROR:
        return targetState === AppState.INITIALIZING || targetState === AppState.READY;
      default:
        return false;
    }
  }
}

// Export singleton instance
export const appState = new AppStateManager();
