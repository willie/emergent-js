# User-Global Memories

## OpenRouter "Exacto" Models
- **Description**: "Exacto" providers (suffix `:exacto`) are a curated subset of providers on OpenRouter that demonstrate significantly higher tool-calling accuracy and reliability compared to the general pool.
- **Why use them**: They are specifically optimized for agentic workflows where precise tool usage is critical. They are NOT "simpler" or "dumber"; they are "more exact".
- **Reference**: [Provider Variance: Introducing Exacto](https://openrouter.ai/announcements/provider-variance-introducing-exacto)
- **Learned**: 2026-02-03

## Model Preferences & Capabilities
- **Claude 3.5 Sonnet**: While capable, it can be overly censored or refused to engage with certain content, making it less suitable for unrestricted narrative generation or uninhibited roleplay compared to less censored open models (like GLM-4.6 or others designated for such tasks).
- **Preference**: Avoid Sonnet for creative/narrative tasks where censorship might block valid user intent. Favor models like `exacto` variants or open weights when possible.

## Data Preservation & Testing
- **CRITICAL**: NEVER reset the game state, clear local storage, or delete data during testing unless the user *explicitly typographically* asks you to "reset".
- **Testing**: When running browser tests, do NOT click "New Game" -> "Reset" or use any "Reset World" debugging tools. Always test *additively* (e.g. by adding a new item/character) or ask the user for permission if a clean slate is absolutely required. Preserving the user's ongoing game/story is paramount.
