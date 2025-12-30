#!/usr/bin/env node
// ABOUTME: Main CLI entry point for jgoogle
// ABOUTME: Routes commands to Gmail, Calendar, and Drive services

import * as dotenv from "dotenv";
dotenv.config(); // Load .env for local dev (credentials embedded at compile time)

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { parseArgs } from "util";
import { AccountStorage } from "./account-storage.js";
import { OAuthFlow } from "./oauth-flow.js";
import { GmailService } from "./services/gmail.js";
import { CalendarService } from "./services/calendar.js";
import { DriveService } from "./services/drive.js";
import { ExitCode, exitWithCode } from "./utils/errors.js";

const accountStorage = new AccountStorage();
const gmailService = new GmailService(accountStorage);
const calendarService = new CalendarService(accountStorage);
const driveService = new DriveService(accountStorage);

function usage(): void {
  console.error(`
jgoogle - Google CLI (Gmail, Calendar, Drive)

USAGE

  jgoogle accounts <action>                    Account management
  jgoogle <email> mail <command> [options]     Gmail operations
  jgoogle <email> cal <command> [options]      Calendar operations
  jgoogle <email> drive <command> [options]    Drive operations

ACCOUNT COMMANDS

  jgoogle accounts list                        List configured accounts
  jgoogle accounts add <email> [--manual]      Add account (--manual for browserless OAuth)
  jgoogle accounts remove <email>              Remove account

GMAIL COMMANDS (jgoogle <email> mail ...)

  search <query> [--max N] [--page TOKEN]  Search threads
  thread <threadId>                        Get thread with messages
  labels list                              List all labels
  labels <threadIds...> [--add L] [--remove L]  Modify labels
  drafts list                              List drafts
  drafts delete <draftId>                  Delete draft
  drafts send <draftId>                    Send draft
  send --to <emails> --subject <s> --body <b>  Send email
  url <threadIds...>                       Generate Gmail URLs

CALENDAR COMMANDS (jgoogle <email> cal ...)

  calendars                                List calendars
  acl <calendarId>                         List calendar ACL
  events [calendarId] [--max N]            List events
  event <calendarId> <eventId>             Get event details
  create <calendarId> --title <t> --start <s> --end <e>  Create event
  update <calendarId> <eventId> [--title] [--start] [--end]  Update event
  delete <calendarId> <eventId>            Delete event
  freebusy <calendarIds> --start <s> --end <e>  Check availability

DRIVE COMMANDS (jgoogle <email> drive ...)

  ls [folderId] [--max N]                  List files
  search <query> [--max N]                 Search files
  get <fileId>                             Get file metadata
  download <fileId> [destPath]             Download file
  permissions <fileId>                     List permissions
  url <fileIds...>                         Generate Drive URLs

EXAMPLES

  jgoogle accounts add you@gmail.com
  jgoogle you@gmail.com mail search "in:inbox is:unread"
  jgoogle you@gmail.com cal events
  jgoogle you@gmail.com drive ls

DATA STORAGE

  ~/.jgoogle/accounts.json      Account tokens
  ~/.jgoogle/downloads/         Downloaded files
`);
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toISOString().replace("T", " ").substring(0, 16);
}

async function handleAccounts(args: string[]): Promise<void> {
  const action = args[0];

  if (action === "list") {
    const accounts = accountStorage.getAllAccounts();
    if (accounts.length === 0) {
      console.log("No accounts configured. Run: jgoogle accounts add <email>");
    } else {
      for (const acc of accounts) {
        console.log(acc.email);
      }
    }
    return;
  }

  if (action === "add") {
    const email = args[1];
    const manual = args.includes("--manual");
    if (!email) {
      exitWithCode(ExitCode.INVALID_INPUT, "Missing email address");
    }
    if (accountStorage.hasAccount(email)) {
      exitWithCode(ExitCode.INVALID_INPUT, `Account '${email}' already exists`);
    }
    const creds = accountStorage.getCredentials();
    const oauthFlow = new OAuthFlow(creds.clientId, creds.clientSecret);
    const refreshToken = await oauthFlow.authorize(manual);
    accountStorage.addAccount({
      email,
      oauth2: { clientId: creds.clientId, clientSecret: creds.clientSecret, refreshToken },
    });
    console.log(`Account '${email}' added`);
    return;
  }

  if (action === "remove") {
    const email = args[1];
    if (!email) {
      exitWithCode(ExitCode.INVALID_INPUT, "Missing email address");
    }
    if (accountStorage.deleteAccount(email)) {
      console.log(`Account '${email}' removed`);
    } else {
      exitWithCode(ExitCode.NOT_FOUND, `Account '${email}' not found`);
    }
    return;
  }

  exitWithCode(ExitCode.INVALID_INPUT, `Unknown accounts action: ${action}`);
}

async function handleMail(email: string, args: string[]): Promise<void> {
  const command = args[0];

  if (command === "search") {
    const query = args[1];
    if (!query) {
      exitWithCode(ExitCode.INVALID_INPUT, "Missing search query");
    }
    const { values } = parseArgs({
      args: args.slice(2),
      options: { max: { type: "string" }, page: { type: "string" } },
      allowPositionals: true,
    });
    const result = await gmailService.searchThreads(
      email,
      query,
      parseInt(values.max || "10"),
      values.page
    );
    console.log("ID\tDATE\tFROM\tSUBJECT\tLABELS");
    for (const t of result.threads) {
      console.log(`${t.id}\t${formatDate(t.date)}\t${t.from}\t${t.subject}\t${t.labels.join(",")}`);
    }
    if (result.nextPageToken) {
      console.log(`\n# Next page: --page ${result.nextPageToken}`);
    }
    return;
  }

  if (command === "thread") {
    const threadId = args[1];
    if (!threadId) {
      exitWithCode(ExitCode.INVALID_INPUT, "Missing thread ID");
    }
    const thread = await gmailService.getThread(email, threadId);
    console.log(`Thread: ${thread.id}\n`);
    for (const msg of thread.messages) {
      console.log(`--- Message ${msg.id} ---`);
      console.log(`From: ${msg.from}`);
      console.log(`To: ${msg.to}`);
      console.log(`Date: ${msg.date}`);
      console.log(`Subject: ${msg.subject}`);
      console.log(`Labels: ${msg.labels.join(", ")}`);
      if (msg.attachments.length > 0) {
        console.log(`Attachments: ${msg.attachments.map((a) => a.filename).join(", ")}`);
      }
      console.log(`\n${msg.body}\n`);
    }
    return;
  }

  if (command === "labels") {
    if (args[1] === "list") {
      const labels = await gmailService.listLabels(email);
      console.log("ID\tNAME\tTYPE");
      for (const l of labels) {
        console.log(`${l.id}\t${l.name}\t${l.type}`);
      }
      return;
    }
    // Modify labels on threads
    const { values, positionals } = parseArgs({
      args: args.slice(1),
      options: { add: { type: "string" }, remove: { type: "string" } },
      allowPositionals: true,
    });
    if (positionals.length === 0) {
      exitWithCode(ExitCode.INVALID_INPUT, "Missing thread IDs");
    }
    const addLabels = values.add?.split(",") || [];
    const removeLabels = values.remove?.split(",") || [];
    await gmailService.modifyLabels(email, positionals, addLabels, removeLabels);
    console.log("Labels modified");
    return;
  }

  if (command === "drafts") {
    const subCmd = args[1];
    if (subCmd === "list") {
      const drafts = await gmailService.listDrafts(email);
      console.log("ID\tMESSAGE_ID");
      for (const d of drafts) {
        console.log(`${d.id}\t${d.messageId || ""}`);
      }
      return;
    }
    if (subCmd === "delete") {
      const draftId = args[2];
      if (!draftId) {
        exitWithCode(ExitCode.INVALID_INPUT, "Missing draft ID");
      }
      await gmailService.deleteDraft(email, draftId);
      console.log("Draft deleted");
      return;
    }
    if (subCmd === "send") {
      const draftId = args[2];
      if (!draftId) {
        exitWithCode(ExitCode.INVALID_INPUT, "Missing draft ID");
      }
      const messageId = await gmailService.sendDraft(email, draftId);
      console.log(`Sent: ${messageId}`);
      return;
    }
    exitWithCode(ExitCode.INVALID_INPUT, `Unknown drafts command: ${subCmd}`);
  }

  if (command === "send") {
    const { values } = parseArgs({
      args: args.slice(1),
      options: {
        to: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
        cc: { type: "string" },
        bcc: { type: "string" },
        attach: { type: "string", multiple: true },
        "reply-to": { type: "string" },
      },
      allowPositionals: true,
    });
    if (!values.to || !values.subject || !values.body) {
      exitWithCode(ExitCode.INVALID_INPUT, "--to, --subject, and --body are required");
    }
    const messageId = await gmailService.sendMessage(
      email,
      values.to.split(","),
      values.subject,
      values.body,
      {
        cc: values.cc?.split(","),
        bcc: values.bcc?.split(","),
        attachments: values.attach,
        replyToMessageId: values["reply-to"],
      }
    );
    console.log(`Sent: ${messageId}`);
    return;
  }

  if (command === "url") {
    const threadIds = args.slice(1);
    if (threadIds.length === 0) {
      exitWithCode(ExitCode.INVALID_INPUT, "Missing thread IDs");
    }
    for (const id of threadIds) {
      console.log(gmailService.getThreadUrl(email, id));
    }
    return;
  }

  exitWithCode(ExitCode.INVALID_INPUT, `Unknown mail command: ${command}`);
}

async function handleCal(email: string, args: string[]): Promise<void> {
  const command = args[0];

  if (command === "calendars") {
    const calendars = await calendarService.listCalendars(email);
    console.log("ID\tNAME\tROLE");
    for (const c of calendars) {
      console.log(`${c.id}\t${c.name}\t${c.role}`);
    }
    return;
  }

  if (command === "acl") {
    const calendarId = args[1] || "primary";
    const acl = await calendarService.getCalendarAcl(email, calendarId);
    console.log("ID\tROLE\tSCOPE");
    for (const a of acl) {
      console.log(`${a.id}\t${a.role}\t${a.scope.type}:${a.scope.value || ""}`);
    }
    return;
  }

  if (command === "events") {
    const { values, positionals } = parseArgs({
      args: args.slice(1),
      options: {
        max: { type: "string" },
        page: { type: "string" },
        from: { type: "string" },
        to: { type: "string" },
        q: { type: "string" },
      },
      allowPositionals: true,
    });
    const calendarId = positionals[0] || "primary";
    const result = await calendarService.listEvents(email, calendarId, {
      maxResults: parseInt(values.max || "10"),
      pageToken: values.page,
      timeMin: values.from,
      timeMax: values.to,
      query: values.q,
    });
    console.log("ID\tSTART\tEND\tSUMMARY");
    for (const e of result.events) {
      console.log(`${e.id}\t${e.start}\t${e.end}\t${e.summary}`);
    }
    if (result.nextPageToken) {
      console.log(`\n# Next page: --page ${result.nextPageToken}`);
    }
    return;
  }

  if (command === "event") {
    const calendarId = args[1];
    const eventId = args[2];
    if (!calendarId || !eventId) {
      exitWithCode(ExitCode.INVALID_INPUT, "Missing calendar ID or event ID");
    }
    const event = await calendarService.getEvent(email, calendarId, eventId);
    console.log(`ID: ${event.id}`);
    console.log(`Summary: ${event.summary}`);
    console.log(`Start: ${event.start}`);
    console.log(`End: ${event.end}`);
    if (event.location) console.log(`Location: ${event.location}`);
    if (event.description) console.log(`Description: ${event.description}`);
    if (event.attendees) {
      console.log(`Attendees: ${event.attendees.map((a) => `${a.email} (${a.responseStatus})`).join(", ")}`);
    }
    if (event.htmlLink) console.log(`Link: ${event.htmlLink}`);
    return;
  }

  if (command === "create") {
    const calendarId = args[1];
    if (!calendarId) {
      exitWithCode(ExitCode.INVALID_INPUT, "Missing calendar ID");
    }
    const { values } = parseArgs({
      args: args.slice(2),
      options: {
        title: { type: "string" },
        start: { type: "string" },
        end: { type: "string" },
        description: { type: "string" },
        location: { type: "string" },
        attendees: { type: "string" },
        allday: { type: "boolean" },
      },
      allowPositionals: true,
    });
    if (!values.title || !values.start || !values.end) {
      exitWithCode(ExitCode.INVALID_INPUT, "--title, --start, and --end are required");
    }
    const event = await calendarService.createEvent(email, calendarId, {
      summary: values.title,
      start: values.start,
      end: values.end,
      description: values.description,
      location: values.location,
      attendees: values.attendees?.split(","),
      allDay: values.allday,
    });
    console.log(`Created: ${event.id}`);
    if (event.htmlLink) console.log(`Link: ${event.htmlLink}`);
    return;
  }

  if (command === "update") {
    const calendarId = args[1];
    const eventId = args[2];
    if (!calendarId || !eventId) {
      exitWithCode(ExitCode.INVALID_INPUT, "Missing calendar ID or event ID");
    }
    const { values } = parseArgs({
      args: args.slice(3),
      options: {
        title: { type: "string" },
        start: { type: "string" },
        end: { type: "string" },
        description: { type: "string" },
        location: { type: "string" },
        attendees: { type: "string" },
        allday: { type: "boolean" },
      },
      allowPositionals: true,
    });
    const event = await calendarService.updateEvent(email, calendarId, eventId, {
      summary: values.title,
      start: values.start,
      end: values.end,
      description: values.description,
      location: values.location,
      attendees: values.attendees?.split(","),
      allDay: values.allday,
    });
    console.log(`Updated: ${event.id}`);
    return;
  }

  if (command === "delete") {
    const calendarId = args[1];
    const eventId = args[2];
    if (!calendarId || !eventId) {
      exitWithCode(ExitCode.INVALID_INPUT, "Missing calendar ID or event ID");
    }
    await calendarService.deleteEvent(email, calendarId, eventId);
    console.log("Event deleted");
    return;
  }

  if (command === "freebusy") {
    const { values, positionals } = parseArgs({
      args: args.slice(1),
      options: { start: { type: "string" }, end: { type: "string" } },
      allowPositionals: true,
    });
    if (!values.start || !values.end || positionals.length === 0) {
      exitWithCode(ExitCode.INVALID_INPUT, "Calendar IDs and --start, --end are required");
    }
    const result = await calendarService.getFreeBusy(email, positionals, values.start, values.end);
    for (const [calId, busy] of result) {
      console.log(`\n${calId}:`);
      if (busy.length === 0) {
        console.log("  Free");
      } else {
        for (const b of busy) {
          console.log(`  Busy: ${b.start} - ${b.end}`);
        }
      }
    }
    return;
  }

  exitWithCode(ExitCode.INVALID_INPUT, `Unknown cal command: ${command}`);
}

async function handleDrive(email: string, args: string[]): Promise<void> {
  const command = args[0];

  if (command === "ls") {
    const { values, positionals } = parseArgs({
      args: args.slice(1),
      options: {
        max: { type: "string" },
        page: { type: "string" },
        query: { type: "string" },
      },
      allowPositionals: true,
    });
    const folderId = positionals[0];
    const result = await driveService.listFiles(email, {
      folderId,
      maxResults: parseInt(values.max || "20"),
      pageToken: values.page,
      query: values.query,
    });
    console.log("ID\tNAME\tTYPE\tSIZE\tMODIFIED");
    for (const f of result.files) {
      const type = f.mimeType.includes("folder") ? "folder" : "file";
      console.log(`${f.id}\t${f.name}\t${type}\t${formatSize(f.size)}\t${formatDate(f.modifiedTime)}`);
    }
    if (result.nextPageToken) {
      console.log(`\n# Next page: --page ${result.nextPageToken}`);
    }
    return;
  }

  if (command === "search") {
    const query = args[1];
    if (!query) {
      exitWithCode(ExitCode.INVALID_INPUT, "Missing search query");
    }
    const { values } = parseArgs({
      args: args.slice(2),
      options: { max: { type: "string" }, page: { type: "string" } },
      allowPositionals: true,
    });
    const result = await driveService.search(
      email,
      query,
      parseInt(values.max || "20"),
      values.page
    );
    console.log("ID\tNAME\tTYPE\tSIZE\tMODIFIED");
    for (const f of result.files) {
      const type = f.mimeType.includes("folder") ? "folder" : "file";
      console.log(`${f.id}\t${f.name}\t${type}\t${formatSize(f.size)}\t${formatDate(f.modifiedTime)}`);
    }
    if (result.nextPageToken) {
      console.log(`\n# Next page: --page ${result.nextPageToken}`);
    }
    return;
  }

  if (command === "get") {
    const fileId = args[1];
    if (!fileId) {
      exitWithCode(ExitCode.INVALID_INPUT, "Missing file ID");
    }
    const file = await driveService.getFile(email, fileId);
    console.log(`ID: ${file.id}`);
    console.log(`Name: ${file.name}`);
    console.log(`Type: ${file.mimeType}`);
    console.log(`Size: ${formatSize(file.size)}`);
    console.log(`Modified: ${file.modifiedTime}`);
    if (file.description) console.log(`Description: ${file.description}`);
    if (file.webViewLink) console.log(`Link: ${file.webViewLink}`);
    return;
  }

  if (command === "download") {
    const fileId = args[1];
    const destPath = args[2];
    if (!fileId) {
      exitWithCode(ExitCode.INVALID_INPUT, "Missing file ID");
    }
    const result = await driveService.download(email, fileId, destPath);
    if (result.success) {
      console.log(`Downloaded: ${result.path} (${formatSize(result.size || 0)})`);
    } else {
      exitWithCode(ExitCode.API_ERROR, result.error);
    }
    return;
  }

  if (command === "permissions") {
    const fileId = args[1];
    if (!fileId) {
      exitWithCode(ExitCode.INVALID_INPUT, "Missing file ID");
    }
    const permissions = await driveService.listPermissions(email, fileId);
    console.log("ID\tTYPE\tROLE\tEMAIL");
    for (const p of permissions) {
      console.log(`${p.id}\t${p.type}\t${p.role}\t${p.email || ""}`);
    }
    return;
  }

  if (command === "url") {
    const fileIds = args.slice(1);
    if (fileIds.length === 0) {
      exitWithCode(ExitCode.INVALID_INPUT, "Missing file IDs");
    }
    for (const id of fileIds) {
      console.log(driveService.getFileUrl(id));
    }
    return;
  }

  exitWithCode(ExitCode.INVALID_INPUT, `Unknown drive command: ${command}`);
}

const JGOOGLE_DIR = path.join(os.homedir(), ".jgoogle");

function ensureReadme(): void {
  try {
    const readmeDest = path.join(JGOOGLE_DIR, "README.md");
    if (fs.existsSync(readmeDest)) return;

    if (!fs.existsSync(JGOOGLE_DIR)) {
      fs.mkdirSync(JGOOGLE_DIR, { recursive: true });
    }

    const packageRoot = path.resolve(__dirname, "..");
    const readmeSrc = path.join(packageRoot, "README.md");

    if (fs.existsSync(readmeSrc)) {
      fs.copyFileSync(readmeSrc, readmeDest);
    }
  } catch { /* ignore */ }
}

async function main(): Promise<void> {
  ensureReadme();
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    usage();
    process.exit(0);
  }

  try {
    // Handle accounts commands
    if (args[0] === "accounts") {
      await handleAccounts(args.slice(1));
      return;
    }

    // Service commands: jgoogle <email> <service> <command>
    const email = args[0];
    const service = args[1];
    const serviceArgs = args.slice(2);

    if (!email.includes("@")) {
      exitWithCode(ExitCode.INVALID_INPUT, `Invalid email address: ${email}`);
    }

    if (!accountStorage.hasAccount(email)) {
      exitWithCode(ExitCode.NOT_FOUND, `Account '${email}' not found. Run: jgoogle accounts add ${email}`);
    }

    if (service === "mail") {
      await handleMail(email, serviceArgs);
    } else if (service === "cal") {
      await handleCal(email, serviceArgs);
    } else if (service === "drive") {
      await handleDrive(email, serviceArgs);
    } else {
      exitWithCode(ExitCode.INVALID_INPUT, `Unknown service: ${service}. Use: mail, cal, or drive`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    exitWithCode(ExitCode.API_ERROR, msg);
  }
}

main();
