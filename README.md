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
jgoogle <email> mail url <threadIds...>           # Generate Gmail URLs
```

### Calendar

```bash
jgoogle <email> cal calendars                     # List calendars
jgoogle <email> cal events [calendarId] [--max N] # List events
jgoogle <email> cal event <calendarId> <eventId>  # Get event details
jgoogle <email> cal create <calId> --title <t> --start <s> --end <e>
jgoogle <email> cal update <calId> <eventId> [--title] [--start] [--end]
jgoogle <email> cal delete <calId> <eventId>      # Delete event
jgoogle <email> cal freebusy <calIds> --start <s> --end <e>
```

### Drive

```bash
jgoogle <email> drive ls [folderId] [--max N]     # List files
jgoogle <email> drive search <query> [--max N]    # Search files
jgoogle <email> drive get <fileId>                # Get metadata
jgoogle <email> drive download <fileId> [dest]    # Download file
jgoogle <email> drive upload <path> [--name N] [--folder F]
jgoogle <email> drive mkdir <name> [--parent F]   # Create folder
jgoogle <email> drive delete <fileId>             # Delete file
jgoogle <email> drive move <fileId> <newParent>   # Move file
jgoogle <email> drive share <fileId> [--anyone] [--email E]
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

- Gmail: read, send, modify, labels
- Calendar: read, write events
- Drive: read, write files

## Requirements

- Node.js >= 18

## License

MIT
