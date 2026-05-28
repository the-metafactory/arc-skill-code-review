# Cortex-shape Tricky Glossary — Parser Stress Test

Test fixture mirroring the **actual** `_Avoid_:` patterns from
`/Users/andreas/Developer/cortex/CONTEXT.md`. The naive `split(',')` parser
breaks on these — they are the regression cases for the §2 alias-extraction
algorithm.

## Identities

**Principal**:
The human or organization on whose behalf the system acts — the owner of the work.
_Avoid_: operator, user, owner, human, org

**Stack**:
A deployment of the full Myelin layer set at a given site.
_Avoid_: deployment, instance, node. Never use `stack` for the M1–M7 architecture — that is the **Myelin layer model**.

**Network**:
The set of stacks that interoperate over the bus.
_Avoid_: federation (that is the relationship, not the thing), mesh, fabric, org, cluster

## Bus

**Agent**:
The stack-local, long-lived runtime identity (daemon) that hosts an assistant on the bus.
_Avoid_: bot, persona, daemon (as the domain term)

**Subject**:
A NATS subject — the bus address an envelope is published on.
_Avoid_: topic (the Kafka/MQTT word — NATS subjects have different semantics), channel, path

**Capability**:
A named, dispatchable behaviour an assistant offers.
_Avoid_: skill (that is the SOMA implementation term), ability, function, command, tool

**Dispatch**:
The act of routing an envelope from an originator to a sink.
_Avoid_: routing, assignment, hand-off. Never call the Offer mode "broadcast" — exactly one assistant claims an offered task, not all.

**Domain**:
The functional-domain segment of a subject — groups related signals.
_Avoid_: channel, category — and never use `domain` for the DDD bounded-context sense (that is always written **bounded context**).
