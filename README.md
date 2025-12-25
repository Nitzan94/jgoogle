# jgoogle - Google CLI

CLI for Google services - Gmail, Calendar, Drive. OAuth credentials embedded.

## Installation

```bash
npm install -g jgoogle
```

## Quick Start

```bash
# Add Google account
jgoogle accounts add you@gmail.com

# Search emails
jgoogle you@gmail.com mail search "in:inbox is:unread"

# List calendar events
jgoogle you@gmail.com cal events

# List Drive files
jgoogle you@gmail.com drive ls
```

## Commands

### Account Management

```bash
jgoogle accounts list                    # List configured accounts
jgoogle accounts add <email>             # Add account (OAuth flow)
jgoogle accounts add <email> --manual    # Manual OAuth (no browser)
jgoogle accounts remove <email>          # Remove account
```

### Gmail

```bash
jgoogle <email> mail search <query> [--max N]     # Search threads
jgoogle <email> mail thread <threadId>            # Get full thread
jgoogle <email> mail labels list                  # List labels
jgoogle <email> mail send --to <e> --subject <s> --body <b>  # Send email
jgoogle <email> mail drafts list                  # List drafts
jgoogle <email> mail drafts send <draftId>        # Send draft
jgoogle <email> mail url <threadIds...>           # Generate Gmail URLs
```

### Calendar

```bash
jgoogle <email> cal calendars                     # List calendars
jgoogle <email> cal events [calendarId] [--max N] # List events
jgoogle <email> cal event <calendarId> <eventId>  # Get event details
jgoogle <email> cal freebusy <calIds> --start <s> --end <e>
```

### Drive

```bash
jgoogle <email> drive ls [folderId] [--max N]     # List files
jgoogle <email> drive search <query> [--max N]    # Search files
jgoogle <email> drive get <fileId>                # Get metadata
jgoogle <email> drive download <fileId> [dest]    # Download file
jgoogle <email> drive permissions <fileId>        # List permissions
jgoogle <email> drive url <fileIds...>            # Generate URLs
```

## Data Storage

```
~/.jgoogle/
├── accounts.json    # OAuth tokens
└── downloads/       # Downloaded files
```

## OAuth Scopes

- Gmail: read, compose (send)
- Calendar: read only
- Drive: read only

## Requirements

- Node.js >= 18

## Exit Codes (for LLM/Agents)

| Code | Meaning | Solution |
|------|---------|----------|
| 0 | Success | - |
| 1 | Auth error (token expired) | Run `jgoogle accounts add <email>` |
| 2 | Network error | Check internet connection |
| 3 | Not found (email/file/event) | Check ID/query |
| 4 | Invalid input | Check `jgoogle --help` |
| 5 | API error (quota/permissions) | Check Google Cloud Console |

## License

MIT
