# algeria-mcp

An MCP server that lets AI assistants answer questions about Algeria's 69
wilayas and 1541 communes from the Journal officiel, and check Algerian
formats such as phone numbers and RIP keys.

Ask your assistant things like:

- Which wilaya is Bou Saada in since 2026?
- Which communes moved to the wilaya of El Kantara?
- Which commune is the point 36.365, 6.6147 in?
- Is the RIP 007 99999 0000000200 91 well formed?

## Setup

Also listed in the official MCP Registry as `io.github.syscli/algeria-mcp`.

Claude Code:

```sh
claude mcp add algeria -- npx -y @syscli/algeria-mcp
```

Claude Desktop, Cursor and other clients, in their MCP configuration file:

```json
{
  "mcpServers": {
    "algeria": {
      "command": "npx",
      "args": ["-y", "@syscli/algeria-mcp"]
    }
  }
}
```

It runs locally over stdio, needs Node.js 18 or later, and makes no network
calls: all the data ships with the package.

## Tools

| tool | |
|---|---|
| `search_communes` | find communes by name in French or Arabic, with old names, transliterations and typos |
| `get_wilaya` | a wilaya by code or name, with its communes |
| `get_commune` | a commune by ONS code, with its wilaya under the 69, 58 and 48 maps |
| `wilaya_changes` | communes moved by the 2026 or 2019 reform |
| `locate_point` | the commune and wilaya of a GPS point |
| `validate` | check a phone number, RIB, RIP, CCP, plate, postal code, NIN, NIF, NIS, RC, wilaya or commune |

All tools are read-only.

## Data

- Wilayas and communes: [@syscli/algeria](https://github.com/syscli/algeria),
  from the Journal officiel. MIT.
- Boundaries used by `locate_point`: OpenStreetMap via geoBoundaries,
  CC BY-SA 2.0. (c) OpenStreetMap contributors.
- Format rules: [@syscli/dz-format](https://github.com/syscli/dz-format), with
  the source of each rule.

## Releases and security

Versions are listed in [CHANGELOG.md](CHANGELOG.md). Releases are published
from GitHub Actions with npm provenance; `npm audit signatures` checks them.
To report a security problem, see [SECURITY.md](SECURITY.md).

## License

MIT
