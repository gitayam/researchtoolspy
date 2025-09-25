export interface AutoSaveData {
  id: string;
  timestamp: number;
  data: any;
}

export class AutoSaveService {
  static async getMigrationData(): Promise<AutoSaveData[]> {
    // Mock implementation for now
    return [];
  }

  static async clearMigrationData(): Promise<void> {
    // Mock implementation for now
  }

  static async importData(data: AutoSaveData[]): Promise<void> {
    // Mock implementation for now
  }
}

export interface FrameworkSession {
  id: string;
  framework: string;
  title: string;
  data: any;
  timestamp: number;
}

export default AutoSaveService;