// import fs from 'fs';
// import path from 'path';
// import os from 'os';

// export interface UserConfig {
//   accessToken?: string;
//   apiUrl?: string;
// }

// export class ConfigLoader {
//   private configDir: string;
//   private configFile: string;

//   constructor() {
//     this.configDir = path.join(os.homedir(), '.config', '1x1');
//     this.configFile = path.join(this.configDir, 'config.json');
//   }

//   load(): UserConfig {
//     if (!fs.existsSync(this.configFile)) return {};
//     try {
//       return JSON.parse(fs.readFileSync(this.configFile, 'utf-8'));
//     } catch {
//       return {};
//     }
//   }

//   save(newConfig: Partial<UserConfig>) {
//     const current = this.load();
//     const final = { ...current, ...newConfig };
//     if (!fs.existsSync(this.configDir)) {
//       fs.mkdirSync(this.configDir, { recursive: true });
//     }
//     fs.writeFileSync(this.configFile, JSON.stringify(final, null, 2));
//   }
// }