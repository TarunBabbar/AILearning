# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# cli
- Keep shell commands quiet to avoid flooding the user's terminal with excessive output. Confidence: 0.85
- Work silently behind the scenes without writing anything to the terminal, only updating when done. Confidence: 0.75

# communication
- Provide implementation details only when explicitly asked; default to concise task-completion updates. Confidence: 0.70
- Consolidate source references at the end of a response instead of showing inline resource names next to every piece of content. Confidence: 0.78

# embeddings
- Use text-embedding-3-small (OpenAI) as the embedding model, configured as EMBEDDING_MODEL=openai/text-embedding-3-small. Confidence: 0.70

# workflow
- Maintain a project state tracking (.md) file that documents implemented features, and always consult it first before starting new work or answering questions. Confidence: 0.85

# embeddings
- Use text-embedding-3-small (OpenAI) as the embedding model, configured as EMBEDDING_MODEL=openai/text-embedding-3-small. Confidence: 0.70
- Chunk documents based on character count (using configured chunk size like 1536) rather than paragraph/section-aware logic, and chunk as soon as the document arrives. Confidence: 0.75

# git
- When pushing to a monorepo (e.g., AILearning), place each project's code inside its own named folder (e.g., qaragplatform/) before committing and pushing. Confidence: 0.85

