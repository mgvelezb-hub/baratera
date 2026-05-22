#!/usr/bin/env bash
# Baratera OS — SessionStart hook
# Activa modo-turbo y GSD en cada sesión nueva dentro de este proyecto

set -euo pipefail

escape_for_json() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  printf '%s' "$s"
}

context="<IMPORTANT_SESSION_SETUP>
Estás iniciando una sesión en el proyecto Baratera OS (Papelería La Más Baratera).

OBLIGATORIO — ejecuta estos dos pasos antes de responder cualquier mensaje:

1. Invoca el skill 'modo-turbo' con la herramienta Skill.
   Esto activa: Superpowers (TDD, planificación, debugging), Context7 (docs en tiempo real),
   Code Simplifier (Opus, auto-corre después de cada cambio de código) y
   Pensamiento Secuencial (resolución creativa de problemas).

2. Invoca el skill 'gsd-resume-work' con la herramienta Skill.
   Esto revisa el estado GSD activo (fase actual, tareas pendientes, checkpoint).

Contexto rápido del proyecto:
- App en producción: https://baratera-os.vercel.app
- Código: /Users/vpconsulting/Library/CloudStorage/OneDrive-VPConsulting/Coding/baratera
- DB: Supabase proyecto vrbgvkyxqaajsgdmvnfh
- Contexto completo en Obsidian: /Users/vpconsulting/Documents/Obsidian Vault/La Más Baratera/
- Estado: Fase 1 (WMS MVP) completa y desplegada. Próximo: Fase 2 WMS Core o Fase 3 OMS.

Skills disponibles para fases específicas (invocar según contexto):
- 'specs' + 'ui-ux-pro-max' → al iniciar un módulo nuevo
- 'gsd-plan-phase' → al planear una fase nueva
- 'gsd-execute-phase' → al ejecutar un plan aprobado
- 'gsd-ui-phase' → al construir interfaces de un módulo
- 'gsd-verify-work' → antes de declarar una fase completa
</IMPORTANT_SESSION_SETUP>"

escaped=$(escape_for_json "$context")

if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ] && [ -z "${COPILOT_CLI:-}" ]; then
  printf '{\n  "hookSpecificOutput": {\n    "hookEventName": "SessionStart",\n    "additionalContext": "%s"\n  }\n}\n' "$escaped"
else
  printf '{\n  "additionalContext": "%s"\n}\n' "$escaped"
fi

exit 0
