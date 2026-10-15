# Product Requirements Document (PRD) - Impostor Game

## Overview
A lightweight, web-based social deduction game where friends connect via mobile devices while viewing game progress on a shared central display (TV view). No user accounts or persistence layers are required.

## Target Platform
- **Hosting:** Render (Node.js environment)
- **Clients:** Web browsers (responsive design supporting both mobile phones and large displays)

## Core Gameplay & Flow
1. **Lobby Phase:** Players open the website, enter their display name, and join the room.
2. **Role Assignment:** Once the game starts, players receive a secret word on their phone screens. One random player is designated as the **Impostor** and receives a notification instead of the word.
3. **Clue Input Phase:** After a brief timer (5-10 seconds), every player inputs a word related to the secret word (duplicate words are restricted).
4. **Display Phase:** All submitted words are broadcast and displayed on the central TV view.
5. **Voting Phase:** Players discuss and vote on who they suspect the Impostor is.
6. **Win Conditions:**
   - If the Impostor is voted out, players win.
   - If the player count drops to a small threshold (e.g., 2 or 3 players left) without catching the Impostor, the Impostor wins.

## Out of Scope
- User accounts, authentication, or profiles
- Databases or any persistence layer
- Game history, stats, or leaderboards
