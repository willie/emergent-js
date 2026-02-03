#!/bin/bash
# Conductor setup script - runs when creating new workspaces

# Symlink .env.local from repository root
if [ -f "$CONDUCTOR_ROOT_PATH/.env.local" ]; then
  ln -sf "$CONDUCTOR_ROOT_PATH/.env.local" .env.local
  echo "✓ Linked .env.local from repository root"
else
  echo "⚠️  Warning: .env.local not found in repository root"
  echo "   Create it at: $CONDUCTOR_ROOT_PATH/.env.local"
fi
