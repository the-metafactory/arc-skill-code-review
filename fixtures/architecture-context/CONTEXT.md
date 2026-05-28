# Sample Repo — Context

Test fixture for the Architecture lens. Models the cortex CONTEXT.md shape so the
lens' regex-based glossary parser can be exercised against a stable input.

## Language

### Assistants & agents

**Assistant**:
The named being the bot runs — Luna, Echo, Forge, Pilot. Has a persona and continuity of identity.
_Avoid_: persona, bot, DA, character

**Agent**:
The stack-local, long-lived runtime identity (daemon) that hosts an assistant on the bus.
_Avoid_: bot, persona, daemon

### The bus

**Originator**:
The identity that produced an envelope — populated by the adapter when a dispatch enters the bus.
_Avoid_: dispatch-source, sender, publisher

**Envelope**:
The signed wrapper that travels on a subject — metadata around a payload. Every bus message is an envelope.
_Avoid_: message, packet

### Surfaces

**Adapter**:
A platform-specific entry point (Discord, Mattermost) that translates external events into envelopes and resolves identities before publishing onto the bus. Resolution belongs at the adapter, not at the listener.
_Avoid_: connector, gateway, plugin

**Renderer**:
A read-only presentation component — turns envelopes into display output for humans. Renderers display; they MUST NOT execute side effects, mutate state, or perform identity resolution.
_Avoid_: executor, dispatcher, handler
