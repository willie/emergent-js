# Emergent JS: Core Architecture Concepts

This document outlines the key design philosophies and architectural patterns used in the Emergent JS system. The system combines traditional text adventure mechanics with modern Generative Agent research to create a dynamic, living world.

## 1. The Narrator-Tool Protocol (Game Master Loop)

The central mechanic is the **Stateful Narrator**, which acts as a Game Master (GM). Unlike a standard chatbot conversation, the system enforces a strict separation between *Narration* (what is said) and *State* (what is true).

### How it Works
1.  **Impersonation**: The System Prompt explicitly instructs the LLM to roleplay as a Narrator/GM.
2.  **Tool Enforcement**: The Narrator is forbidden from simply stating facts; it must use *Tools* to enact them.
    *   *Incorrect*: "You see a goblin." (Text only)
    *   *Correct*: "You see a goblin." -> calling `discoverCharacter("Goblin")` (Text + State Update)
3.  **Result**: This allows the LLM to improvise freely while the code captures structured data (entities, locations, inventory) from the narrative stream.

### Inspiration & References
*   **Voyager (Wang et al., 2023)**: [Voyager: An Open-Ended Embodied Agent with Large Language Models](https://voyager.minedojo.org/). The concept of an LLM driving an external "body" (tools) in a game loop.
*   **ReAct (Yao et al., 2022)**: [ReAct: Synergizing Reasoning and Acting in Language Models](https://react-lm.github.io/). The fundamental pattern of Thought -> Action -> Observation used here.

## 2. Distributed Memory & Witnessing

To prevent "God Mode" omniscience where every NPC knows everything, the system implements a strict witnessing model for background simulation.

### The "Witnessed" Constraint
*   **Off-Screen Simulation**: When the player is absent, the simulation engine groups characters by location. Events generated here are tagged with `witnessedByIds` (those present). Only these characters receive the event in their `knowledge` array.
*   **On-Screen Ambiguity**: During active play, the Narrator has access to global recent events but is instructed to "play dumb" for characters who weren't there. This is a known limitation of current LLM context windows (the "Leaky Context" problem).

### Inspiration & References
*   **Generative Agents (Park et al., 2023)**: [Generative Agents: Interactive Simulacra of Human Behavior](https://arxiv.org/abs/2304.03442). The seminal paper on persistent agent memory streams. Our implementation simplifies their full memory retrieval tree into a more performant `recent` vs `archived` list, but keeps the core concept of private observation streams.

## 3. Just-In-Time Discovery (Procedural Registration)

One of the most unique features is the handling of hallucination as a **Procedural Generation Engine**.

### The Problem
In traditional games, if an NPC isn't in the database, it doesn't exist. In LLM text adventures, the model often invents characters ("The bartender, Joe, says hello") that the code knows nothing about.

### The Solution: `discoverCharacter`
The system prompt contains a critical instruction:
> *"If you introduce... you MUST call the discoverCharacter tool."*

This turns hallucination into a feature.
1.  **Narrative**: "You see a merchant named Silva."
2.  **Trigger**: The model recognizes it introduced a new entity.
3.  **Action**: Calls `discoverCharacter("Silva", "A merchant...")`.
4.  **State Update**: The backend creates a new `Character` entry, persists it to the database, and now "Silva" is a permanent part of the world who can be simulated later.

## 4. Off-Screen Simulation (The Living World)

The world continues to run when the player isn't looking. This is achieved via the `lib/world/simulation.ts` module.

*   **Mechanism**: A periodic tick (or movement-triggered update) checks for characters not in the player's location.
*   **Abstraction**: It does not simulate every second. Instead, it generates *summaries* or *short interactions* proportional to the time elapsed.
*   **Goal**: To ensure that when the player returns to a location, things have changed (e.g., NPCs have moved, formed new opinions, or completed tasks).

---

## Technical Summary

| Feature | Pattern | Purpose |
| :--- | :--- | :--- |
| **Narrator** | ReAct / Tool-Use | Decouples narrative improvisation from game state. |
| **Improvisation** | Procedural Generation | Turns hallucinations into persistent entities via `discoverCharacter`. |
| **Memory** | Agentic Memory Stream | Prevents hive-mind knowledge; ensures privacy of events. |
| **Simulation** | Level-of-Detail (LOD) | Simulates background events at lower fidelity to save compute. |
