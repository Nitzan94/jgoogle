// ABOUTME: Unified account storage for Gmail, Calendar, and Drive
// ABOUTME: Manages OAuth credentials and account persistence in ~/.jgoogle/

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const CONFIG_DIR = path.join(os.homedir(), ".jgoogle");
const ACCOUNTS_FILE = path.join(CONFIG_DIR, "accounts.json");

// OAuth credentials from environment (embedded at build time)
// Project: joseph-481914
const EMBEDDED_CREDENTIALS = {
  clientId: process.env['GOOGLE_CLIENT_ID'] || "",
  clientSecret: process.env['GOOGLE_CLIENT_SECRET'] || ""
};

export interface OAuth2Credentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessToken?: string;
}

export interface EmailAccount {
  email: string;
  oauth2: OAuth2Credentials;
}

export interface ClientCredentials {
  clientId: string;
  clientSecret: string;
}

export class AccountStorage {
  private accounts = new Map<string, EmailAccount>();

  constructor() {
    this.ensureConfigDir();
    this.loadAccounts();
  }

  private ensureConfigDir(): void {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
  }

  private loadAccounts(): void {
    if (fs.existsSync(ACCOUNTS_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf8"));
        for (const account of data) {
          this.accounts.set(account.email, account);
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  private saveAccounts(): void {
    fs.writeFileSync(
      ACCOUNTS_FILE,
      JSON.stringify(Array.from(this.accounts.values()), null, 2)
    );
  }

  addAccount(account: EmailAccount): void {
    this.accounts.set(account.email, account);
    this.saveAccounts();
  }

  getAccount(email: string): EmailAccount | undefined {
    return this.accounts.get(email);
  }

  getAllAccounts(): EmailAccount[] {
    return Array.from(this.accounts.values());
  }

  deleteAccount(email: string): boolean {
    const deleted = this.accounts.delete(email);
    if (deleted) this.saveAccounts();
    return deleted;
  }

  hasAccount(email: string): boolean {
    return this.accounts.has(email);
  }

  getCredentials(): ClientCredentials {
    return EMBEDDED_CREDENTIALS;
  }

  getConfigDir(): string {
    return CONFIG_DIR;
  }
}
